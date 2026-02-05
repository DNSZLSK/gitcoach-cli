import { t } from '../../i18n/index.js';
import { getTheme } from '../themes/index.js';
import { promptConfirm, promptSelect, promptInput } from '../components/prompt.js';
import { successBox, warningBox, errorBox, infoBox } from '../components/box.js';
import { withSpinner } from '../components/spinner.js';
import { gitService } from '../../services/git-service.js';
import { logger } from '../../utils/logger.js';
import { mapGitError, mapGitErrorWithAI } from '../../utils/error-mapper.js';
import { isValidRemoteUrl } from '../../utils/validators.js';
import { shouldShowExplanation, shouldConfirm, isLevel } from '../../utils/level-helper.js';

export interface PullResult {
  pulled: boolean;
  remote?: string;
  branch?: string;
}

type PullAction = 'pull' | 'back';
type UncommittedAction = 'commit' | 'stash' | 'continue';
type DivergenceAction = 'merge' | 'rebase' | 'cancel';
type ConflictAction = 'guided' | 'abort' | 'manual';

export async function showPullMenu(): Promise<PullResult> {
  const theme = getTheme();

  logger.raw('\n' + theme.title(t('commands.pull.title')) + '\n');

  try {
    // 1. Show explanation for beginners
    if (shouldShowExplanation()) {
      logger.raw(infoBox(
        t('tips.beginner.pull'),
        t('commands.pull.title')
      ));
    }

    // 2. Check if merge/rebase is already in progress
    const mergeInProgress = await gitService.isMergeInProgress();
    if (mergeInProgress) {
      logger.raw(warningBox(
        t('warnings.mergeInProgress') + '\n' + t('warnings.mergeInProgressAction'),
        t('warnings.title')
      ));
      const abortMerge = await promptConfirm(t('commands.pull.abortMerge'), false);
      if (abortMerge) {
        await gitService.abortMerge();
        logger.raw(successBox(t('commands.pull.abortSuccess')));
      }
      return { pulled: false };
    }

    const rebaseInProgress = await gitService.isRebaseInProgress();
    if (rebaseInProgress) {
      logger.raw(warningBox(
        t('warnings.rebaseInProgress') + '\n' + t('warnings.rebaseInProgressAction'),
        t('warnings.title')
      ));
      return { pulled: false };
    }

    // 3. Check remotes
    const remotes = await gitService.getRemotes();
    if (remotes.length === 0) {
      logger.raw(warningBox(t('commands.pull.noRemoteConfigured'), t('warnings.title')));

      const addRemote = await promptConfirm(t('commands.push.addRemoteQuestion'), true);
      if (!addRemote) {
        return { pulled: false };
      }

      const url = await promptInput(
        t('setup.remoteUrlPrompt'),
        undefined,
        (value: string) => {
          if (!value || value.trim().length === 0) {
            return t('setup.remoteUrlRequired');
          }
          if (!isValidRemoteUrl(value)) {
            return t('setup.remoteUrlInvalid');
          }
          return true;
        }
      );

      if (!url || url.trim().length === 0) {
        return { pulled: false };
      }

      await gitService.addRemote('origin', url);
      logger.raw(successBox(t('setup.remoteAdded', { url })));
    }

    // Select remote if multiple
    let remote = 'origin';
    if (remotes.length > 1) {
      remote = await promptSelect<string>(
        t('commands.pull.selectRemote'),
        remotes.map(r => ({ name: r, value: r }))
      );
    } else if (remotes.length === 1) {
      remote = remotes[0];
    }

    const status = await gitService.getStatus();
    const currentBranch = status.current;

    // 4. Check tracking branch / upstream
    const hasUpstream = await gitService.hasUpstream();
    if (!hasUpstream && currentBranch) {
      logger.raw(infoBox(
        t('commands.pull.noUpstream', { branch: currentBranch }),
        t('warnings.title')
      ));
      const setUpstream = await promptConfirm(
        t('commands.pull.setUpstreamQuestion', { remote, branch: currentBranch }),
        true
      );
      if (!setUpstream) {
        return { pulled: false };
      }
      // Will use --set-upstream-to during pull
    }

    // 5. Check uncommitted changes (WARNING level)
    if (!status.isClean) {
      logger.raw(warningBox(
        t('commands.pull.uncommittedWarning'),
        t('warnings.title')
      ));

      const uncommittedAction = await promptSelect<UncommittedAction>(
        t('commands.pull.uncommittedOptions'),
        [
          { name: t('commands.pull.optionCommit'), value: 'commit' },
          { name: t('commands.pull.optionStash'), value: 'stash' },
          { name: t('commands.pull.optionContinue'), value: 'continue' }
        ]
      );

      if (uncommittedAction === 'commit') {
        // Redirect to commit-menu, then re-run pull
        const { showCommitMenu } = await import('./commit-menu.js');
        await showCommitMenu();
        return showPullMenu();
      }

      if (uncommittedAction === 'stash') {
        await withSpinner(
          t('commands.stash.save'),
          async () => { await gitService.stash('Auto-stash before pull'); },
          t('commands.stash.saveSuccess')
        );
      }
      // 'continue' = proceed anyway
    }

    // Fetch to get latest remote state
    try {
      await gitService.fetch(remote);
    } catch {
      logger.debug('Fetch failed, continuing with local state');
    }

    // Re-check status after fetch
    const updatedStatus = await gitService.getStatus();

    // 6. Check divergence
    if (updatedStatus.ahead > 0 && updatedStatus.behind > 0) {
      logger.raw(warningBox(
        t('commands.pull.diverged') + '\n' +
        t('commands.pull.divergedExplain', { ahead: updatedStatus.ahead, behind: updatedStatus.behind }),
        t('warnings.title')
      ));

      const divergenceAction = await promptSelect<DivergenceAction>(
        t('commands.pull.mergeOrRebase'),
        [
          { name: t('commands.pull.optionMerge'), value: 'merge' },
          { name: t('commands.pull.optionRebase'), value: 'rebase' },
          { name: t('prompts.cancel'), value: 'cancel' }
        ]
      );

      if (divergenceAction === 'cancel') {
        return { pulled: false };
      }

      if (divergenceAction === 'rebase') {
        // Pull with rebase
        logger.command(`git pull --rebase ${remote} ${currentBranch || ''}`);
        try {
          await withSpinner(
            t('commands.pull.pulling', { remote }),
            async () => {
              await gitService.pull(remote, currentBranch || undefined, { '--rebase': null });
            },
            t('commands.pull.success', { count: updatedStatus.behind })
          );
        } catch (error) {
          // Check for conflicts after rebase pull
          return await handlePostPullConflicts(theme, error);
        }

        logger.raw('\n' + successBox(
          t('commands.pull.success', { count: updatedStatus.behind }),
          t('success.title')
        ));

        return { pulled: true, remote, branch: currentBranch || undefined };
      }

      // Fall through to merge (default pull behavior)
    }

    // Check if there's anything to pull
    if (updatedStatus.behind === 0 && updatedStatus.ahead >= 0) {
      logger.raw(infoBox(t('commands.pull.upToDate')));
      return { pulled: false };
    }

    // Expert mode: show action menu
    if (isLevel('expert')) {
      const action = await promptSelect<PullAction>(t('commands.pull.title'), [
        {
          name: theme.menuItem('P', `git pull ${remote} ${currentBranch || ''}`),
          value: 'pull'
        },
        {
          name: theme.menuItem('R', t('menu.back')),
          value: 'back'
        }
      ]);

      if (action === 'back') {
        return { pulled: false };
      }
    }

    // Confirm before pull (level-based)
    if (shouldConfirm(false)) {
      const confirm = await promptConfirm(
        t('commands.pull.pulling', { remote }) + ' ?',
        true
      );
      if (!confirm) {
        return { pulled: false };
      }
    }

    // 7. Execute the pull
    logger.command(`git pull ${remote} ${currentBranch || ''}`);

    try {
      await withSpinner(
        t('commands.pull.pulling', { remote }),
        async () => {
          await gitService.pull(remote, currentBranch || undefined);
        },
        t('commands.pull.success', { count: updatedStatus.behind || 1 })
      );
    } catch (error) {
      // 8. Check for conflicts post-pull
      return await handlePostPullConflicts(theme, error);
    }

    logger.raw('\n' + successBox(
      t('commands.pull.success', { count: updatedStatus.behind || 1 }),
      t('success.title')
    ));

    return {
      pulled: true,
      remote,
      branch: currentBranch || undefined
    };
  } catch (error) {
    const message = await mapGitErrorWithAI(error, { command: 'git pull' });
    logger.raw(errorBox(message));
    return { pulled: false };
  }
}

async function handlePostPullConflicts(
  theme: ReturnType<typeof getTheme>,
  error: unknown
): Promise<PullResult> {
  // Check if conflicts exist
  const hasConflicts = await gitService.hasConflicts();

  if (hasConflicts) {
    const conflictedFiles = await gitService.getConflictedFiles();

    logger.raw('\n' + errorBox(
      t('commands.pull.conflictsDetected', { count: conflictedFiles.length }),
      t('warnings.title')
    ));

    // List conflicted files
    logger.raw(theme.warning(t('commands.pull.conflictedFiles')));
    conflictedFiles.forEach(f => logger.raw(theme.file(f, 'conflict')));
    logger.raw('');

    // Show resolve instructions
    logger.raw(infoBox(t('commands.pull.resolveInstructions')));

    // Offer options
    const action = await promptSelect<ConflictAction>(
      t('commands.pull.resolveOptions'),
      [
        { name: t('commands.pull.guidedResolution'), value: 'guided' },
        { name: t('commands.pull.abortMerge'), value: 'abort' },
        { name: t('commands.pull.continueMerge'), value: 'manual' }
      ]
    );

    if (action === 'guided') {
      const { showConflictResolutionMenu } = await import('./conflict-resolution-menu.js');
      const result = await showConflictResolutionMenu();
      if (result.resolved) {
        return { pulled: true };
      }
      return { pulled: false };
    }

    if (action === 'abort') {
      try {
        await gitService.abortMerge();
        logger.raw(successBox(t('commands.pull.abortSuccess')));
      } catch (abortError) {
        logger.raw(warningBox(mapGitError(abortError)));
      }
    }

    return { pulled: false };
  }

  // Not a conflict error - show generic mapped error with AI explanation
  const message = await mapGitErrorWithAI(error, { command: 'git pull' });
  logger.raw(errorBox(message));
  return { pulled: false };
}
