import { t } from '../../i18n/index.js';
import { getTheme } from '../themes/index.js';
import { promptConfirm } from '../components/prompt.js';
import { successBox, warningBox, errorBox, infoBox } from '../components/box.js';
import { withSpinner } from '../components/spinner.js';
import { gitService } from '../../services/git-service.js';
import { preventionService } from '../../services/prevention-service.js';
import { logger } from '../../utils/logger.js';

export interface PullResult {
  pulled: boolean;
  remote?: string;
  branch?: string;
}

export async function showPullMenu(): Promise<PullResult> {
  const theme = getTheme();

  logger.raw('\n' + theme.title(t('commands.pull.title')) + '\n');

  try {
    const status = await gitService.getStatus();
    const currentBranch = status.current;
    const remote = 'origin';

    // Validate pull
    const validation = await preventionService.validatePull();

    if (validation.warnings.length > 0) {
      for (const warning of validation.warnings) {
        if (warning.level === 'critical') {
          logger.raw(errorBox(warning.message, warning.title));
          return { pulled: false };
        } else if (warning.level === 'warning') {
          logger.raw(warningBox(warning.message, warning.title));
        } else {
          logger.raw(infoBox(warning.message));
        }
      }

      // Ask to continue if there are uncommitted changes
      if (validation.warnings.some(w => w.message.includes('uncommitted'))) {
        const proceed = await promptConfirm(t('prompts.continue'), false);
        if (!proceed) {
          return { pulled: false };
        }
      }
    }

    // Check if there's anything to pull
    if (status.behind === 0) {
      logger.raw(infoBox(t('commands.pull.upToDate')));
      return { pulled: false };
    }

    logger.raw(theme.info(`${status.behind} commit(s) to download from ${remote}/${currentBranch}`) + '\n');

    // Perform pull
    logger.command(`git pull ${remote} ${currentBranch || ''}`);
    await withSpinner(
      t('commands.pull.pulling', { remote }),
      async () => {
        await gitService.pull(remote, currentBranch || undefined);
      },
      t('commands.pull.success', { count: status.behind })
    );

    logger.raw('\n' + successBox(
      t('commands.pull.success', { count: status.behind }),
      t('success.title')
    ));

    return {
      pulled: true,
      remote,
      branch: currentBranch || undefined
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for merge conflicts
    if (errorMessage.toLowerCase().includes('conflict')) {
      logger.raw(errorBox(t('commands.pull.conflicts')));
    } else {
      logger.raw(errorBox(t('commands.pull.failed', { error: errorMessage })));
    }

    return { pulled: false };
  }
}
