import { t } from '../../i18n/index.js';
import { getTheme } from '../themes/index.js';
import { promptInput, promptConfirm, promptSelect } from '../components/prompt.js';
import { successBox, warningBox, infoBox, errorBox } from '../components/box.js';
import { withSpinner, createSpinner } from '../components/spinner.js';
import { gitService } from '../../services/git-service.js';
import { copilotService } from '../../services/copilot-service.js';
import { preventionService } from '../../services/prevention-service.js';
import { userConfig } from '../../config/user-config.js';
import { isValidCommitMessage, isConventionalCommit } from '../../utils/validators.js';
import { logger } from '../../utils/logger.js';
import { shouldShowWarning, shouldShowExplanation, shouldConfirm, isLevel } from '../../utils/level-helper.js';

export interface CommitResult {
  committed: boolean;
  hash?: string;
  message?: string;
}

type CommitAction = 'ai' | 'manual' | 'back';

export async function showCommitMenu(): Promise<CommitResult> {
  const theme = getTheme();

  logger.raw('\n' + theme.title(t('commands.commit.title')) + '\n');

  try {
    // Check for merge conflicts first
    const hasConflicts = await gitService.hasConflicts();
    if (hasConflicts) {
      const conflictedFiles = await gitService.getConflictedFiles();
      logger.raw(errorBox(
        t('commands.commit.conflictsDetected') || 'Merge conflicts detected! Resolve them before committing.',
        t('errors.title')
      ));
      logger.raw(theme.warning(t('commands.commit.conflictedFiles') || 'Conflicted files:'));
      conflictedFiles.forEach(f => logger.raw(theme.file(f, 'conflict')));
      return { committed: false };
    }

    // Validate we can commit
    const validation = await preventionService.validateCommit();

    if (!validation.canProceed) {
      for (const warning of validation.warnings) {
        logger.raw(warningBox(warning.message, warning.title));
      }
      return { committed: false };
    }

    // Show warnings if any (level-based filtering)
    for (const warning of validation.warnings) {
      const category = warning.level === 'critical' ? 'critical' :
                       warning.level === 'warning' ? 'warning' : 'info';
      if (shouldShowWarning(category)) {
        logger.raw(warningBox(warning.message, warning.title));
      }
    }

    // Get staged files for context
    const stagedFiles = await gitService.getStagedFiles();
    logger.raw(theme.textMuted(t('commands.commit.stagedCount', { count: stagedFiles.length }) + '\n'));
    stagedFiles.forEach(f => logger.raw(theme.file(f, 'staged')));
    logger.raw('');

    // Show explanation for beginners
    if (shouldShowExplanation()) {
      logger.raw(infoBox(
        t('tips.beginner.commit'),
        t('commands.commit.title')
      ));
    }

    let commitMessage: string = '';

    // Check if Copilot CLI is available
    const copilotAvailable = await copilotService.isAvailable();
    const wantsAutoGenerate = userConfig.getAutoGenerateCommitMessages();

    // Expert mode: show action menu
    if (isLevel('expert')) {
      const choices: Array<{ name: string; value: CommitAction }> = [];

      if (copilotAvailable && wantsAutoGenerate) {
        choices.push({
          name: theme.menuItem('A', 'git commit (AI)'),
          value: 'ai'
        });
      }
      choices.push({
        name: theme.menuItem('M', 'git commit -m'),
        value: 'manual'
      });
      choices.push({
        name: theme.menuItem('R', t('menu.back')),
        value: 'back'
      });

      const action = await promptSelect<CommitAction>(t('commands.commit.title'), choices);

      if (action === 'back') {
        return { committed: false };
      }

      if (action === 'ai') {
        commitMessage = await generateAIMessage(theme);
        if (!commitMessage) {
          // AI failed, fall through to manual
        }
      }

      if (!commitMessage) {
        commitMessage = await getManualMessage(theme);
        if (!commitMessage) {
          return { committed: false };
        }
      }
    } else {
      // Beginner/Intermediate mode
      if (wantsAutoGenerate && copilotAvailable) {
        const useAI = await promptConfirm(t('commands.commit.generateAI'), true);

        if (useAI) {
          commitMessage = await generateAIMessage(theme);
        }
      } else if (!copilotAvailable && wantsAutoGenerate) {
        logger.raw(theme.textMuted(t('commands.commit.copilotUnavailable') || 'GitHub Copilot CLI not available'));
      }

      if (!commitMessage) {
        commitMessage = await getManualMessage(theme);
        if (!commitMessage) {
          return { committed: false };
        }
      }
    }

    // Suggest conventional commit format for intermediate/expert users
    const level = userConfig.getExperienceLevel();
    if (level !== 'beginner' && !isConventionalCommit(commitMessage)) {
      const convertToConventional = await promptSelect(
        t('commands.commit.convertToConventional'),
        [
          { name: t('commands.commit.keepAsIs'), value: 'keep' },
          { name: t('commands.commit.typeFeature'), value: 'feat' },
          { name: t('commands.commit.typeFix'), value: 'fix' },
          { name: t('commands.commit.typeDocs'), value: 'docs' },
          { name: t('commands.commit.typeRefactor'), value: 'refactor' },
          { name: t('commands.commit.typeChore'), value: 'chore' }
        ]
      );

      if (convertToConventional !== 'keep') {
        commitMessage = `${convertToConventional}: ${commitMessage}`;
      }
    }

    // Confirm before commit (level-based)
    if (shouldConfirm(false)) {
      logger.raw(theme.info(`\n${t('commands.commit.enterMessage')}: ${commitMessage}\n`));
      const confirm = await promptConfirm(t('prompts.confirm'), true);
      if (!confirm) {
        logger.raw(theme.textMuted(t('commands.commit.cancelled')));
        return { committed: false };
      }
    }

    // Perform the commit
    logger.command(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`);

    const hash = await withSpinner(
      t('commands.commit.committing'),
      async () => {
        return gitService.commit(commitMessage);
      },
      t('commands.commit.success', { message: commitMessage })
    );

    userConfig.incrementTotalCommits();

    logger.raw('\n' + successBox(
      `${t('commands.commit.success', { message: commitMessage })}\n\nCommit: ${theme.commitHash(hash)}`,
      t('success.title')
    ));

    return {
      committed: true,
      hash,
      message: commitMessage
    };
  } catch (error) {
    logger.error(t('errors.generic', { message: error instanceof Error ? error.message : 'Unknown error' }));
    return { committed: false };
  }
}

/**
 * Generate commit message using AI
 */
async function generateAIMessage(_theme: ReturnType<typeof getTheme>): Promise<string> {
  const spinner = createSpinner({ text: t('commands.commit.generating') });
  spinner.start();

  try {
    const diff = await gitService.getDiff(true);
    const suggestion = await copilotService.generateCommitMessage(diff);

    if (suggestion.success && suggestion.message) {
      spinner.succeed();
      logger.raw(infoBox(suggestion.message, t('commands.commit.suggested', { message: '' })));

      const useGenerated = await promptConfirm(t('commands.commit.useGenerated'), true);

      if (useGenerated) {
        userConfig.incrementAiCommitsGenerated();
        return suggestion.message;
      }
    } else {
      spinner.warn(t('commands.commit.aiGenerationFailed') || 'AI generation failed');
    }
  } catch {
    spinner.warn(t('commands.commit.aiGenerationFailed') || 'AI generation failed');
  }

  return '';
}

/**
 * Get commit message manually from user
 */
async function getManualMessage(theme: ReturnType<typeof getTheme>): Promise<string> {
  logger.raw(theme.textMuted(t('commands.commit.emptyToCancel') || '(Leave empty to cancel)'));

  const manualMessage = await promptInput(
    t('commands.commit.enterMessage'),
    '',
    (value) => {
      // Allow empty string for cancellation
      if (value.trim().length === 0) {
        return true;
      }
      if (!isValidCommitMessage(value)) {
        return t('commands.commit.messageTooShort') || 'Commit message must be at least 3 characters';
      }
      return true;
    }
  );

  if (!manualMessage || manualMessage.trim().length === 0) {
    logger.raw(theme.textMuted(t('commands.commit.cancelled')));
    return '';
  }

  return manualMessage;
}
