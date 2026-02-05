import { readFileSync, writeFileSync } from 'fs';
import { t } from '../../i18n/index.js';
import { getTheme } from '../themes/index.js';
import { promptSelect, promptInput, promptConfirm } from '../components/prompt.js';
import { successBox, warningBox, errorBox, infoBox } from '../components/box.js';
import { createSpinner } from '../components/spinner.js';
import { gitService } from '../../services/git-service.js';
import { copilotService } from '../../services/copilot-service.js';
import { logger } from '../../utils/logger.js';
import { mapGitError } from '../../utils/error-mapper.js';

export interface ConflictBlock {
  localContent: string;
  remoteContent: string;
  startLine: number;
  endLine: number;
}

type ResolutionChoice = 'local' | 'remote' | 'both' | 'edit' | 'copilot' | 'back';

const CONFLICT_START = '<<<<<<<';
const CONFLICT_SEPARATOR = '=======';
const CONFLICT_END = '>>>>>>>';
const UTF8_BOM = '\uFEFF';

function normalizeContent(content: string): string {
  // Strip UTF-8 BOM
  if (content.startsWith(UTF8_BOM)) {
    content = content.slice(1);
  }
  // Normalize CRLF to LF
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function parseConflictBlocks(fileContent: string): ConflictBlock[] {
  const lines = normalizeContent(fileContent).split('\n');
  const blocks: ConflictBlock[] = [];

  let inConflict = false;
  let inLocal = false;
  let startLine = -1;
  let localLines: string[] = [];
  let remoteLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith(CONFLICT_START)) {
      inConflict = true;
      inLocal = true;
      startLine = i;
      localLines = [];
      remoteLines = [];
    } else if (inConflict && line.startsWith(CONFLICT_SEPARATOR)) {
      inLocal = false;
    } else if (inConflict && line.startsWith(CONFLICT_END)) {
      blocks.push({
        localContent: localLines.join('\n'),
        remoteContent: remoteLines.join('\n'),
        startLine,
        endLine: i
      });
      inConflict = false;
      inLocal = false;
    } else if (inConflict) {
      if (inLocal) {
        localLines.push(line);
      } else {
        remoteLines.push(line);
      }
    }
  }

  return blocks;
}

export function resolveConflictBlock(
  fileContent: string,
  block: ConflictBlock,
  choice: 'local' | 'remote' | 'both'
): string {
  const lines = normalizeContent(fileContent).split('\n');

  let replacement: string;
  switch (choice) {
    case 'local':
      replacement = block.localContent;
      break;
    case 'remote':
      replacement = block.remoteContent;
      break;
    case 'both':
      replacement = block.localContent + '\n' + block.remoteContent;
      break;
  }

  // Replace the conflict block (startLine through endLine inclusive)
  const before = lines.slice(0, block.startLine);
  const after = lines.slice(block.endLine + 1);

  return [...before, replacement, ...after].join('\n');
}

export function hasConflictMarkers(content: string): boolean {
  const normalized = normalizeContent(content);
  return normalized.includes(CONFLICT_START) && normalized.includes(CONFLICT_END);
}

export async function showConflictResolutionMenu(): Promise<{ resolved: boolean }> {
  const theme = getTheme();

  logger.raw('\n' + theme.title(t('commands.conflicts.title')) + '\n');

  try {
    const conflictedFiles = await gitService.getConflictedFiles();

    if (conflictedFiles.length === 0) {
      logger.raw(infoBox(t('commands.pull.upToDate')));
      return { resolved: true };
    }

    const total = conflictedFiles.length;
    let resolvedCount = 0;

    for (let i = 0; i < conflictedFiles.length; i++) {
      const file = conflictedFiles[i];
      const current = i + 1;

      logger.raw('\n' + theme.textBold(
        t('commands.conflicts.fileProgress', { current, total })
      ));
      logger.raw(theme.file(file, 'conflict') + '\n');

      let fileContent: string;
      try {
        fileContent = readFileSync(file, 'utf-8');
      } catch {
        logger.raw(warningBox(mapGitError(new Error(`Cannot read file: ${file}`))));
        continue;
      }

      const blocks = parseConflictBlocks(fileContent);

      if (blocks.length === 0) {
        // No conflict markers found - file may already be resolved
        logger.raw(theme.textMuted(`  ${file}: no conflict markers found`));
        await gitService.add(file);
        resolvedCount++;
        continue;
      }

      // Resolve blocks from last to first to preserve line numbers
      const blocksReversed = [...blocks].reverse();

      for (const block of blocksReversed) {
        // Display the two versions
        logger.raw(theme.info(t('commands.conflicts.localVersion')));
        logger.raw(theme.dim('  ' + (block.localContent || '(empty)').split('\n').join('\n  ')));
        logger.raw('');
        logger.raw(theme.warning(t('commands.conflicts.remoteVersion')));
        logger.raw(theme.dim('  ' + (block.remoteContent || '(empty)').split('\n').join('\n  ')));
        logger.raw('');

        const choices: Array<{ name: string; value: ResolutionChoice }> = [
          { name: t('commands.conflicts.keepLocal'), value: 'local' },
          { name: t('commands.conflicts.keepRemote'), value: 'remote' },
          { name: t('commands.conflicts.keepBoth'), value: 'both' },
          { name: t('commands.conflicts.editManually'), value: 'edit' },
        ];

        if (await copilotService.isAvailable()) {
          choices.push({ name: t('commands.conflicts.askCopilot'), value: 'copilot' });
        }

        choices.push({ name: t('menu.back'), value: 'back' });

        const choice = await promptSelect<ResolutionChoice>(
          t('commands.conflicts.chooseResolution'),
          choices
        );

        if (choice === 'back') {
          return { resolved: false };
        }

        if (choice === 'copilot') {
          const spinner = createSpinner({ text: t('copilot.analyzing') });
          spinner.start();
          const suggestion = await copilotService.suggestConflictResolution(
            file, block.localContent, block.remoteContent
          );
          spinner.stop();

          if (suggestion) {
            logger.raw(infoBox(
              `${t('commands.conflicts.copilotSuggests')}: ${suggestion.recommendation.toUpperCase()}\n\n${suggestion.explanation}`
            ));

            const accept = await promptConfirm(t('commands.conflicts.acceptSuggestion'), true);

            if (accept) {
              if (suggestion.recommendation === 'custom' && suggestion.customContent) {
                // Replace the block with custom content
                const lines = normalizeContent(fileContent).split('\n');
                const before = lines.slice(0, block.startLine);
                const after = lines.slice(block.endLine + 1);
                fileContent = [...before, suggestion.customContent, ...after].join('\n');
              } else if (suggestion.recommendation === 'local' || suggestion.recommendation === 'remote' || suggestion.recommendation === 'both') {
                fileContent = resolveConflictBlock(fileContent, block, suggestion.recommendation);
              }
              continue; // Move to next block
            }
            // If not accepted, fall through to re-show menu (loop will re-iterate)
            continue;
          }
          // If suggestion is null, fall through to re-show menu
          continue;
        }

        if (choice === 'edit') {
          // Manual editing flow
          logger.raw(infoBox(
            t('commands.conflicts.editInstructions', { file }),
            t('commands.conflicts.title')
          ));

          await promptInput(t('commands.conflicts.pressEnterWhenDone'), '');

          // Re-read the file and check for remaining markers
          try {
            fileContent = readFileSync(file, 'utf-8');
          } catch {
            logger.raw(warningBox(mapGitError(new Error(`Cannot read file: ${file}`))));
            continue;
          }

          if (hasConflictMarkers(fileContent)) {
            logger.raw(warningBox(
              t('commands.conflicts.markersRemaining', { file }),
              t('warnings.title')
            ));
            // Don't mark as resolved, let the user fix it
            continue;
          }

          // File was manually resolved - break out of blocks loop for this file
          break;
        } else {
          // Apply automatic resolution
          fileContent = resolveConflictBlock(fileContent, block, choice);
        }
      }

      // Write the resolved file (if not manually edited or if auto-resolved)
      if (!hasConflictMarkers(fileContent)) {
        try {
          writeFileSync(file, fileContent, 'utf-8');
          await gitService.add(file);
          resolvedCount++;
          logger.raw(successBox(
            t('commands.conflicts.fileResolved', { file, current, total }),
            t('success.title')
          ));
        } catch (writeError) {
          logger.raw(warningBox(mapGitError(writeError)));
        }
      }
    }

    // Summary
    if (resolvedCount === total) {
      logger.raw('\n' + successBox(
        t('commands.conflicts.allResolved', { count: total }),
        t('commands.conflicts.title')
      ));

      // Offer to finalize merge commit
      const { promptConfirm } = await import('../components/prompt.js');
      const finalize = await promptConfirm(t('commands.conflicts.finalizeCommit'), true);

      if (finalize) {
        try {
          logger.command('git commit --no-edit');
          const hash = await gitService.commitNoEdit();
          logger.raw(successBox(
            `Merge commit: ${theme.commitHash(hash)}`,
            t('success.title')
          ));
          return { resolved: true };
        } catch (commitError) {
          logger.raw(warningBox(mapGitError(commitError)));
        }
      }

      return { resolved: true };
    } else {
      logger.raw(warningBox(
        `${resolvedCount}/${total} files resolved. Remaining files need manual resolution.`,
        t('commands.conflicts.title')
      ));
      return { resolved: false };
    }
  } catch (error) {
    logger.raw(errorBox(mapGitError(error)));
    return { resolved: false };
  }
}
