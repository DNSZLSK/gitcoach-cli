import { t } from '../../i18n/index.js';
import { getTheme } from '../themes/index.js';
import { promptConfirm, promptSelect } from '../components/prompt.js';
import { successBox, warningBox, errorBox, infoBox } from '../components/box.js';
import { withSpinner } from '../components/spinner.js';
import { gitService } from '../../services/git-service.js';
import { preventionService } from '../../services/prevention-service.js';
import { logger } from '../../utils/logger.js';
import { shouldConfirm, shouldShowWarning, shouldShowExplanation } from '../../utils/level-helper.js';

// Re-export for use in other modules

export interface PushResult {
  pushed: boolean;
  remote?: string;
  branch?: string;
}

type PushAction = 'pull_then_push' | 'force' | 'cancel';

export async function showPushMenu(): Promise<PushResult> {
  const theme = getTheme();

  logger.raw('\n' + theme.title(t('commands.push.title')) + '\n');

  try {
    // Show explanation for beginners
    if (shouldShowExplanation()) {
      logger.raw(infoBox(
        t('tips.beginner.push'),
        t('commands.push.title')
      ));
    }

    const status = await gitService.getStatus();
    const currentBranch = status.current;
    const remote = 'origin';
    const hasTracking = !!status.tracking;

    // Check if there's anything to push
    // When no upstream is set, status.ahead is 0, so we need to check differently
    const hasUnpushedCommits = await gitService.hasUnpushedCommits();

    if (!hasUnpushedCommits && status.behind === 0) {
      logger.raw(infoBox(t('commands.push.nothingToPush')));
      return { pushed: false };
    }

    // Show info about first push if no tracking
    if (!hasTracking && hasUnpushedCommits) {
      const commitCount = await gitService.getUnpushedCommitCount();
      logger.raw(infoBox(
        t('commands.push.noUpstream', { branch: currentBranch, count: commitCount }),
        t('commands.push.firstPush')
      ));
    }

    // PREVENTION: Check if remote is ahead (need to pull first)
    if (status.behind > 0) {
      logger.raw(warningBox(
        t('commands.push.remoteBehind', { count: status.behind }),
        t('warnings.title')
      ));

      const choices = [
        {
          name: theme.menuItem('P', t('commands.push.pullThenPush')),
          value: 'pull_then_push' as PushAction
        },
        {
          name: theme.menuItem('F', t('commands.push.forcePush') + ' (' + t('warnings.dangerous') + ')'),
          value: 'force' as PushAction
        },
        {
          name: theme.menuItem('C', t('prompts.cancel')),
          value: 'cancel' as PushAction
        }
      ];

      const action = await promptSelect<PushAction>(t('commands.push.behindAction'), choices);

      if (action === 'cancel') {
        return { pushed: false };
      }

      if (action === 'pull_then_push') {
        // Pull first
        logger.command(`git pull ${remote} ${currentBranch || ''}`);
        await withSpinner(
          t('commands.pull.pulling', { remote }),
          async () => {
            await gitService.pull(remote, currentBranch || undefined);
          },
          t('commands.pull.success', { count: status.behind })
        );
        logger.raw(theme.success(t('commands.pull.success', { count: status.behind })) + '\n');
      }

      if (action === 'force') {
        return showForcePushMenu();
      }
    }

    // Check if there's anything to push after potential pull
    const updatedStatus = await gitService.getStatus();
    const updatedHasUnpushed = await gitService.hasUnpushedCommits();
    const needsSetUpstream = !updatedStatus.tracking;

    if (!updatedHasUnpushed) {
      logger.raw(infoBox(t('commands.push.nothingToPush')));
      return { pushed: false };
    }

    // Validate push
    const validation = await preventionService.validatePush(false);

    if (validation.warnings.length > 0) {
      for (const warning of validation.warnings) {
        const category = warning.level === 'critical' ? 'critical' :
                         warning.level === 'warning' ? 'warning' : 'info';

        // Critical warnings always shown
        if (warning.level === 'critical') {
          logger.raw(errorBox(warning.message, warning.title));
        } else if (shouldShowWarning(category)) {
          logger.raw(warningBox(warning.message, warning.title));
        }
      }

      if (!validation.canProceed) {
        return { pushed: false };
      }
    }

    // Get commit count for display
    const commitCount = await gitService.getUnpushedCommitCount();

    // Show what will be pushed
    logger.raw(theme.info(t('commands.push.confirm', {
      count: commitCount,
      remote,
      branch: currentBranch
    })) + '\n');

    // Confirm push (level-based: experts skip confirmation for non-destructive push)
    if (shouldConfirm(false)) {
      const confirmPush = await promptConfirm(t('prompts.confirm'), true);
      if (!confirmPush) {
        return { pushed: false };
      }
    }

    // Perform push (with -u flag if no upstream is set)
    if (needsSetUpstream) {
      logger.command(`git push -u ${remote} ${currentBranch || ''}`);
    } else {
      logger.command(`git push ${remote} ${currentBranch || ''}`);
    }

    await withSpinner(
      t('commands.push.pushing', { remote }),
      async () => {
        await gitService.push(remote, currentBranch || undefined, false, needsSetUpstream);
      },
      t('commands.push.success', { remote, branch: currentBranch })
    );

    logger.raw('\n' + successBox(
      t('commands.push.success', { remote, branch: currentBranch }),
      t('success.title')
    ));

    return {
      pushed: true,
      remote,
      branch: currentBranch || undefined
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.raw(errorBox(t('commands.push.failed', { error: errorMessage })));
    return { pushed: false };
  }
}

export async function showForcePushMenu(): Promise<PushResult> {
  const theme = getTheme();

  logger.raw('\n' + theme.title(t('commands.push.forcePush')) + '\n');

  // Show critical warning
  const forcePushWarning = await preventionService.checkForcePush();
  if (forcePushWarning) {
    logger.raw(errorBox(forcePushWarning.message, forcePushWarning.title));
    logger.raw(warningBox(forcePushWarning.action));
  }

  // Double confirmation for force push
  const confirmFirst = await promptConfirm(t('commands.push.forcePushWarning'), false);

  if (!confirmFirst) {
    return { pushed: false };
  }

  const confirmSecond = await promptConfirm('Are you absolutely sure? This cannot be undone.', false);

  if (!confirmSecond) {
    return { pushed: false };
  }

  const status = await gitService.getStatus();
  const currentBranch = status.current;
  const remote = 'origin';

  try {
    logger.command(`git push --force ${remote} ${currentBranch || ''}`);
    await withSpinner(
      `Force pushing to ${remote}...`,
      async () => {
        await gitService.push(remote, currentBranch || undefined, true);
      },
      t('commands.push.success', { remote, branch: currentBranch })
    );

    logger.raw('\n' + successBox(
      t('commands.push.success', { remote, branch: currentBranch }),
      t('success.title')
    ));

    return {
      pushed: true,
      remote,
      branch: currentBranch || undefined
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.raw(errorBox(t('commands.push.failed', { error: errorMessage })));
    return { pushed: false };
  }
}
