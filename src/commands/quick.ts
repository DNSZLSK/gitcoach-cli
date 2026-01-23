import { Command, Flags } from '@oclif/core';
import { initI18n, t } from '../i18n/index.js';
import { gitService } from '../services/git-service.js';
import { copilotService } from '../services/copilot-service.js';
import { preventionService } from '../services/prevention-service.js';
import { userConfig } from '../config/user-config.js';
import { logger } from '../utils/logger.js';
import { getTheme } from '../ui/themes/index.js';
import { successBox, errorBox, warningBox } from '../ui/components/box.js';
import { withSpinner } from '../ui/components/spinner.js';
import { promptConfirm, promptInput } from '../ui/components/prompt.js';

export default class Quick extends Command {
  static override description = 'Quick commit and push (expert mode)';

  static override examples = [
    '<%= config.bin %> quick',
    '<%= config.bin %> quick -m "fix: resolve login issue"',
    '<%= config.bin %> quick --all'
  ];

  static override flags = {
    message: Flags.string({
      char: 'm',
      description: 'Commit message'
    }),
    all: Flags.boolean({
      char: 'a',
      description: 'Stage all changes before committing',
      default: false
    }),
    push: Flags.boolean({
      char: 'p',
      description: 'Push after committing',
      default: true
    })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Quick);

    await initI18n();

    const theme = getTheme();

    // Check if we're in a git repository
    const isRepo = await gitService.isGitRepo();
    if (!isRepo) {
      logger.raw(errorBox(t('warnings.notGitRepo')));
      return;
    }

    try {
      const status = await gitService.getStatus();

      // Stage all if requested
      if (flags.all) {
        const unstaged = [...status.modified, ...status.untracked, ...status.deleted];
        if (unstaged.length > 0) {
          await withSpinner(
            'Staging all changes...',
            async () => {
              await gitService.addAll();
            },
            `Staged ${unstaged.length} file(s)`
          );
        }
      }

      // Check for staged changes
      const stagedFiles = await gitService.getStagedFiles();
      if (stagedFiles.length === 0) {
        logger.raw(warningBox(t('commands.commit.noStaged')));
        return;
      }

      // Get or generate commit message
      let commitMessage = flags.message;

      if (!commitMessage) {
        // Try to generate with AI
        const diff = await gitService.getDiff(true);
        const suggestion = await copilotService.generateCommitMessage(diff);

        if (suggestion.success) {
          logger.raw(theme.info(`Suggested: ${suggestion.message}`));
          const useGenerated = await promptConfirm('Use this message?', true);

          if (useGenerated) {
            commitMessage = suggestion.message;
            userConfig.incrementAiCommitsGenerated();
          }
        }

        // Prompt for manual input if no AI message
        if (!commitMessage) {
          commitMessage = await promptInput('Enter commit message:');
        }
      }

      if (!commitMessage || commitMessage.trim().length === 0) {
        logger.raw(theme.textMuted('Commit cancelled.'));
        return;
      }

      // Commit
      const hash = await withSpinner(
        'Committing...',
        async () => {
          return gitService.commit(commitMessage as string);
        },
        'Committed successfully'
      );

      userConfig.incrementTotalCommits();
      logger.raw(theme.success(`Commit: ${theme.commitHash(hash)}`));

      // Push if requested
      if (flags.push) {
        const validation = await preventionService.validatePush(false);

        if (validation.warnings.length > 0) {
          for (const warning of validation.warnings) {
            logger.raw(warningBox(warning.message));
          }
        }

        if (validation.canProceed) {
          await withSpinner(
            'Pushing to origin...',
            async () => {
              await gitService.push();
            },
            'Pushed successfully'
          );
        }
      }

      logger.raw('\n' + successBox('Quick commit complete!'));
    } catch (error) {
      logger.raw(errorBox(
        t('errors.generic', { message: error instanceof Error ? error.message : 'Unknown error' })
      ));
    }
  }
}
