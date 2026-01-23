import { t } from '../../i18n/index.js';
import { getTheme } from '../themes/index.js';
import { promptInput, promptConfirm, promptSelect } from '../components/prompt.js';
import { successBox, warningBox, infoBox } from '../components/box.js';
import { withSpinner, createSpinner } from '../components/spinner.js';
import { gitService } from '../../services/git-service.js';
import { copilotService } from '../../services/copilot-service.js';
import { preventionService } from '../../services/prevention-service.js';
import { userConfig } from '../../config/user-config.js';
import { isValidCommitMessage, isConventionalCommit } from '../../utils/validators.js';
import { logger } from '../../utils/logger.js';

export interface CommitResult {
  committed: boolean;
  hash?: string;
  message?: string;
}

export async function showCommitMenu(): Promise<CommitResult> {
  const theme = getTheme();

  logger.raw('\n' + theme.title(t('commands.commit.title')) + '\n');

  try {
    // Validate we can commit
    const validation = await preventionService.validateCommit();

    if (!validation.canProceed) {
      for (const warning of validation.warnings) {
        logger.raw(warningBox(warning.message, warning.title));
      }
      return { committed: false };
    }

    // Show warnings if any
    for (const warning of validation.warnings) {
      if (warning.level !== 'info') {
        logger.raw(warningBox(warning.message, warning.title));
      }
    }

    // Get staged files for context
    const stagedFiles = await gitService.getStagedFiles();
    logger.raw(theme.textMuted(`${stagedFiles.length} file(s) staged:\n`));
    stagedFiles.forEach(f => logger.raw(theme.file(f, 'staged')));
    logger.raw('');

    let commitMessage: string = '';
    let copilotFailed = false;

    // Check if Copilot CLI is available and offer AI generation
    const copilotAvailable = await copilotService.isAvailable();
    const wantsAutoGenerate = userConfig.getAutoGenerateCommitMessages();

    if (wantsAutoGenerate) {
      if (copilotAvailable) {
        const useAI = await promptConfirm(t('commands.commit.generateAI'), true);

        if (useAI) {
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
                commitMessage = suggestion.message;
                userConfig.incrementAiCommitsGenerated();
              }
            } else {
              spinner.warn(t('commands.commit.aiGenerationFailed') || 'AI generation failed');
              copilotFailed = true;
            }
          } catch {
            spinner.warn(t('commands.commit.aiGenerationFailed') || 'AI generation failed');
            copilotFailed = true;
          }
        }
      } else {
        // Copilot not available - show info message
        logger.raw(theme.textMuted(t('commands.commit.copilotUnavailable') || 'GitHub Copilot CLI not available'));
      }
    }

    // If no AI message, prompt for manual entry
    if (!commitMessage) {
      if (copilotFailed) {
        logger.raw(theme.textMuted(t('commands.commit.enterManually') || 'Please enter your commit message manually:'));
      }
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
        return { committed: false };
      }

      commitMessage = manualMessage;
    }

    // Suggest conventional commit format for intermediate/expert users
    const level = userConfig.getExperienceLevel();
    if (level !== 'beginner' && !isConventionalCommit(commitMessage)) {
      const convertToConventional = await promptSelect(
        'Convert to conventional commit format?',
        [
          { name: 'No, keep as is', value: 'keep' },
          { name: 'feat: (new feature)', value: 'feat' },
          { name: 'fix: (bug fix)', value: 'fix' },
          { name: 'docs: (documentation)', value: 'docs' },
          { name: 'refactor: (code refactor)', value: 'refactor' },
          { name: 'chore: (maintenance)', value: 'chore' }
        ]
      );

      if (convertToConventional !== 'keep') {
        commitMessage = `${convertToConventional}: ${commitMessage}`;
      }
    }

    // Perform the commit
    logger.command(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`);

    const hash = await withSpinner(
      'Committing changes...',
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
