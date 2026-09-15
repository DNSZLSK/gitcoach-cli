import { t } from '../../i18n/index.js';
import { getTheme } from '../themes/index.js';
import { promptSelect } from '../components/prompt.js';
import { successBox, warningBox, errorBox, infoBox } from '../components/box.js';
import { gitService } from '../../services/git-service.js';
import { logger } from '../../utils/logger.js';
import { mapGitError } from '../../utils/error-mapper.js';
import { shouldShowExplanation } from '../../utils/level-helper.js';

/**
 * An operation git started and could not finish on its own.
 *
 * GitCoach already detected these states and warned about them, but offered no
 * way out, which left the user stranded in the one situation where they most
 * need guidance. This flow provides the exits.
 */
export type InProgressKind = 'rebase' | 'cherryPick' | 'merge' | 'bisect';

type InProgressAction = 'continue' | 'skip' | 'abort' | 'resolve' | 'ignore';

/**
 * Which operation is interrupted, if any.
 *
 * Only one can be in progress at a time, and the order matters: a rebase that
 * stops on a conflict also leaves merge state behind, so rebase is checked
 * first to avoid reporting it as a plain merge.
 */
export async function detectInProgress(): Promise<InProgressKind | null> {
  if (await gitService.isRebaseInProgress()) return 'rebase';
  if (await gitService.isCherryPickInProgress()) return 'cherryPick';
  if (await gitService.isBisectInProgress()) return 'bisect';
  if (await gitService.isMergeInProgress()) return 'merge';
  return null;
}

/**
 * Offer the ways out of an interrupted operation.
 *
 * Returns true when the repository state changed, so the caller can refresh
 * anything it read before.
 */
export async function runInProgressFlow(kind: InProgressKind): Promise<boolean> {
  const theme = getTheme();

  logger.raw('\n' + theme.title(t('commands.inProgress.title')) + '\n');
  logger.raw(warningBox(t(`commands.inProgress.${kind}`)));

  if (kind === 'rebase') {
    const progress = await gitService.getRebaseProgress();
    if (progress) {
      logger.raw(theme.textMuted(
        `  ${t('commands.inProgress.rebaseProgress', progress)}\n`
      ));
    }
  }

  if (shouldShowExplanation()) {
    logger.raw(infoBox(t('commands.inProgress.explain')));
  }

  const conflicted = kind === 'bisect' ? [] : await gitService.getConflictedFiles();
  const blocked = conflicted.length > 0;

  if (blocked) {
    logger.raw(warningBox(
      t('commands.inProgress.conflictsRemain', { count: conflicted.length })
    ));
  } else if (kind !== 'bisect') {
    logger.raw(infoBox(t('commands.inProgress.readyToContinue')));
  }

  const action = await promptSelect<InProgressAction>(
    t('commands.inProgress.selectAction'),
    buildChoices(kind, blocked)
  );

  return runAction(action, kind);
}

function buildChoices(
  kind: InProgressKind,
  blocked: boolean
): { name: string; value: InProgressAction }[] {
  const theme = getTheme();
  const choices: { name: string; value: InProgressAction }[] = [];

  // Bisect is a search, not a merge: there is nothing to continue from here and
  // no conflict to resolve, only ending the session.
  if (kind === 'bisect') {
    choices.push({ name: theme.menuItem('A', t('commands.inProgress.abort')), value: 'abort' });
    choices.push({ name: theme.menuItem('I', t('commands.inProgress.ignore')), value: 'ignore' });
    return choices;
  }

  if (blocked) {
    // Continuing is impossible while markers remain, so it is not offered.
    choices.push({
      name: theme.menuItem('R', t('commands.inProgress.resolveFirst')),
      value: 'resolve'
    });
  } else {
    choices.push({
      name: theme.menuItem('C', t('commands.inProgress.continue')),
      value: 'continue'
    });
  }

  if (kind === 'rebase') {
    choices.push({ name: theme.menuItem('S', t('commands.inProgress.skip')), value: 'skip' });
  }

  choices.push({ name: theme.menuItem('A', t('commands.inProgress.abort')), value: 'abort' });
  choices.push({ name: theme.menuItem('I', t('commands.inProgress.ignore')), value: 'ignore' });

  return choices;
}

async function runAction(action: InProgressAction, kind: InProgressKind): Promise<boolean> {
  switch (action) {
    case 'ignore':
      return false;

    case 'resolve': {
      // The guided resolver is a full menu; load it only when actually needed.
      const { showConflictResolutionMenu } = await import('../menus/conflict-resolution-menu.js');
      const { resolved } = await showConflictResolutionMenu();
      return resolved;
    }

    case 'continue':
      return continueOperation(kind);

    case 'skip':
      return skipCommit();

    case 'abort':
      return abortOperation(kind);
  }
}

async function continueOperation(kind: InProgressKind): Promise<boolean> {
  try {
    let finished: boolean;

    switch (kind) {
      case 'rebase':
        logger.command('git rebase --continue');
        finished = await gitService.continueRebase();
        break;
      case 'cherryPick':
        logger.command('git cherry-pick --continue');
        finished = await gitService.continueCherryPick();
        break;
      case 'merge':
        // Finishing a merge is committing the merge git already staged.
        logger.command('git commit --no-edit');
        await gitService.commitNoEdit();
        finished = !(await gitService.isMergeInProgress());
        break;
      case 'bisect':
        return false;
    }

    // Never announce success on the strength of "no exception thrown":
    // simple-git resolves even when git refuses to continue, so the repository
    // state is the only trustworthy signal.
    if (!finished) {
      logger.raw(warningBox(t('commands.inProgress.continueFailed')));
      return false;
    }

    logger.raw(successBox(t('commands.inProgress.continued')));
    return true;
  } catch (error) {
    logger.raw(errorBox(mapGitError(error)));
    return false;
  }
}

async function skipCommit(): Promise<boolean> {
  if (shouldShowExplanation()) {
    logger.raw(infoBox(t('commands.inProgress.skipExplain')));
  }

  try {
    logger.command('git rebase --skip');
    await gitService.skipRebase();
    logger.raw(successBox(t('commands.inProgress.skipped')));
    return true;
  } catch (error) {
    logger.raw(errorBox(mapGitError(error)));
    return false;
  }
}

async function abortOperation(kind: InProgressKind): Promise<boolean> {
  if (shouldShowExplanation() && kind !== 'bisect') {
    logger.raw(infoBox(t('commands.inProgress.abortExplain')));
  }

  try {
    switch (kind) {
      case 'rebase':
        logger.command('git rebase --abort');
        await gitService.abortRebase();
        break;
      case 'cherryPick':
        logger.command('git cherry-pick --abort');
        await gitService.abortCherryPick();
        break;
      case 'merge':
        logger.command('git merge --abort');
        await gitService.abortMerge();
        break;
      case 'bisect':
        logger.command('git bisect reset');
        await gitService.abortBisect();
        logger.raw(successBox(t('commands.inProgress.bisectAborted')));
        return true;
    }

    logger.raw(successBox(t('commands.inProgress.aborted')));
    return true;
  } catch (error) {
    logger.raw(errorBox(mapGitError(error)));
    return false;
  }
}
