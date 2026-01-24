import { t } from '../../i18n/index.js';
import { getTheme } from '../themes/index.js';
import { promptCheckbox, promptSelect } from '../components/prompt.js';
import { successBox, infoBox } from '../components/box.js';
import { withSpinner } from '../components/spinner.js';
import { gitService } from '../../services/git-service.js';
import { logger } from '../../utils/logger.js';
import { isLevel } from '../../utils/level-helper.js';
import { execSync } from 'child_process';

export interface AddResult {
  staged: string[];
  cancelled: boolean;
}

type AddAction = 'add_all' | 'add_patch' | 'select' | 'back';

export async function showAddMenu(): Promise<AddResult> {
  const theme = getTheme();

  logger.raw('\n' + theme.title(t('commands.add.title')) + '\n');

  try {
    const status = await gitService.getStatus();

    // Collect all files that can be staged
    const unstaged = [
      ...status.modified.map(f => ({ name: f, status: 'modified' as const })),
      ...status.deleted.map(f => ({ name: f, status: 'deleted' as const })),
      ...status.untracked.map(f => ({ name: f, status: 'untracked' as const }))
    ];

    if (unstaged.length === 0) {
      logger.raw(infoBox(t('commands.add.noFiles')));
      return { staged: [], cancelled: false };
    }

    // Show files that can be staged
    logger.raw(theme.textMuted(`${unstaged.length} file(s) to stage:\n`));
    unstaged.forEach(f => logger.raw(theme.file(f.name, f.status)));
    logger.raw('');

    let filesToStage: string[];
    let addedAll = false;

    // Build menu choices based on level
    const choices: Array<{ name: string; value: AddAction }> = [];

    if (isLevel('expert')) {
      // Expert mode: git commands
      choices.push({
        name: theme.menuItem('A', 'git add -A'),
        value: 'add_all'
      });
      choices.push({
        name: theme.menuItem('P', 'git add -p'),
        value: 'add_patch'
      });
      choices.push({
        name: theme.menuItem('S', t('commands.add.selectFiles')),
        value: 'select'
      });
    } else if (isLevel('intermediate')) {
      // Intermediate mode: short labels
      choices.push({
        name: theme.menuItem('A', t('commands.add.allFiles')),
        value: 'add_all'
      });
      choices.push({
        name: theme.menuItem('S', t('commands.add.selectFiles')),
        value: 'select'
      });
    } else {
      // Beginner mode: descriptive labels
      choices.push({
        name: theme.menuItem('A', `${t('commands.add.allFiles')} (${unstaged.length} files)`),
        value: 'add_all'
      });
      choices.push({
        name: theme.menuItem('S', t('commands.add.selectFiles')),
        value: 'select'
      });
    }

    // Back option for ALL levels
    choices.push({
      name: theme.menuItem('R', t('menu.back')),
      value: 'back'
    });

    const action = await promptSelect<AddAction>(t('commands.add.title'), choices);

    switch (action) {
      case 'back':
        return { staged: [], cancelled: true };

      case 'add_all':
        filesToStage = unstaged.map(f => f.name);
        addedAll = true;
        break;

      case 'add_patch':
        // Launch interactive git add -p (expert only)
        logger.command('git add -p');
        try {
          execSync('git add -p', { stdio: 'inherit' });
          const stagedFiles = await gitService.getStagedFiles();
          logger.raw('\n' + successBox(
            t('commands.add.success', { count: stagedFiles.length }),
            t('success.title')
          ));
          return { staged: stagedFiles, cancelled: false };
        } catch {
          return { staged: [], cancelled: true };
        }

      case 'select':
        const result = await selectFilesToStage(unstaged, theme);
        if (result.cancelled) {
          return { staged: [], cancelled: true };
        }
        filesToStage = result.files;
        if (filesToStage.length === 0) {
          logger.raw(theme.textMuted(t('prompts.cancel')) + '\n');
          return { staged: [], cancelled: true };
        }
        break;

      default:
        return { staged: [], cancelled: true };
    }

    // Stage the selected files
    if (addedAll) {
      logger.command('git add -A');
    } else {
      filesToStage.forEach(f => logger.command(`git add "${f}"`));
    }

    await withSpinner(
      `Staging ${filesToStage.length} file(s)...`,
      async () => {
        await gitService.add(filesToStage);
      },
      t('commands.add.success', { count: filesToStage.length })
    );

    // Show what was staged
    logger.raw('\n' + successBox(
      filesToStage.map(f => t('commands.add.staged', { file: f })).join('\n'),
      t('success.title')
    ));

    return { staged: filesToStage, cancelled: false };
  } catch (error) {
    logger.error(t('errors.generic', { message: error instanceof Error ? error.message : 'Unknown error' }));
    return { staged: [], cancelled: true };
  }
}

/**
 * Show file selection with Back option
 */
async function selectFilesToStage(
  unstaged: Array<{ name: string; status: 'modified' | 'deleted' | 'untracked' }>,
  theme: ReturnType<typeof getTheme>
): Promise<{ files: string[]; cancelled: boolean }> {
  // Create checkbox choices with files
  const choices = unstaged.map(file => ({
    name: theme.file(file.name, file.status),
    value: file.name,
    checked: false
  }));

  // Add instruction about how to go back
  logger.raw(theme.textMuted(`(${t('prompts.cancel')}: ${t('menu.back')} = Esc or select nothing)\n`));

  const selectedFiles = await promptCheckbox<string>(
    t('commands.add.selectFiles'),
    choices
  );

  // Empty selection = back/cancel
  if (selectedFiles.length === 0) {
    return { files: [], cancelled: true };
  }

  return { files: selectedFiles, cancelled: false };
}
