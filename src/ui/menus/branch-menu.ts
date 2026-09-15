import { t } from '../../i18n/index.js';
import { getTheme } from '../themes/index.js';
import { promptSelect, promptInput, promptConfirm } from '../components/prompt.js';
import { successBox, warningBox, errorBox, infoBox } from '../components/box.js';
import { branchTable } from '../components/table.js';
import { withSpinner } from '../components/spinner.js';
import { gitService } from '../../services/git-service.js';
import { preventionService } from '../../services/prevention-service.js';
import { userConfig } from '../../config/user-config.js';
import { isValidBranchName } from '../../utils/validators.js';
import { logger } from '../../utils/logger.js';
import { mapGitErrorWithAI } from '../../utils/error-mapper.js';
import { shouldShowExplanation, shouldConfirm, shouldShowWarning } from '../../utils/level-helper.js';

export type BranchAction =
  | 'list'
  | 'create'
  | 'switch'
  | 'merge'
  | 'rebase'
  | 'squash'
  | 'delete'
  | 'back';

export interface BranchResult {
  action: BranchAction;
  branch?: string;
  success: boolean;
}

export async function showBranchMenu(): Promise<BranchResult> {
  const theme = getTheme();

  logger.raw('\n' + theme.title(t('commands.branch.title')) + '\n');

  try {
    const currentBranch = await gitService.getCurrentBranch();
    logger.raw(theme.branch(t('commands.branch.current', { branch: currentBranch || 'unknown' })) + '\n');

    const action = await promptSelect<BranchAction>(t('prompts.select'), [
      { name: t('commands.branch.list'), value: 'list' },
      { name: t('commands.branch.create'), value: 'create' },
      { name: t('commands.branch.switch'), value: 'switch' },
      { name: t('commands.branch.merge'), value: 'merge' },
      { name: t('commands.branch.rebase'), value: 'rebase' },
      { name: t('commands.branch.squash'), value: 'squash' },
      { name: t('commands.branch.delete'), value: 'delete' },
      { name: t('menu.back'), value: 'back' }
    ]);

    switch (action) {
      case 'list':
        return await listBranches();

      case 'create':
        return await createBranch();

      case 'switch':
        return await switchBranch();

      case 'merge':
        return await mergeBranch();

      case 'rebase':
        return await rebaseBranch(currentBranch);

      case 'squash':
        return await squashCommits();

      case 'delete':
        return await deleteBranch();

      case 'back':
      default:
        return { action: 'back', success: true };
    }
  } catch (error) {
    const message = await mapGitErrorWithAI(error, { command: 'git branch' });
    logger.error(message);
    return { action: 'back', success: false };
  }
}

async function listBranches(): Promise<BranchResult> {
  const theme = getTheme();

  logger.command('git branch');
  const branches = await gitService.getLocalBranches();

  logger.raw('\n' + theme.subtitle(t('commands.branch.list')) + '\n');
  logger.raw(branchTable(branches));

  return { action: 'list', success: true };
}

async function createBranch(): Promise<BranchResult> {
  const branchName = await promptInput(
    t('commands.branch.enterName'),
    '',
    (value) => {
      if (!isValidBranchName(value)) {
        return t('commands.branch.invalidName');
      }
      return true;
    }
  );

  if (!branchName) {
    return { action: 'create', success: false };
  }

  // Check if branch already exists
  const branches = await gitService.getBranches();
  if (branches.some(b => b.name === branchName)) {
    logger.raw(errorBox(t('errors.branchExists', { branch: branchName })));
    return { action: 'create', success: false };
  }

  logger.command(`git checkout -b ${branchName}`);
  await withSpinner(
    t('commands.branch.creating', { branch: branchName }),
    async () => {
      await gitService.createBranch(branchName, true);
    },
    t('commands.branch.createSuccess', { branch: branchName })
  );

  logger.raw('\n' + successBox(
    t('commands.branch.createSuccess', { branch: branchName }),
    t('success.title')
  ));

  return { action: 'create', branch: branchName, success: true };
}

async function switchBranch(): Promise<BranchResult> {
  const theme = getTheme();
  const branches = await gitService.getLocalBranches();

  // Filter out current branch
  const otherBranches = branches.filter(b => !b.current);

  if (otherBranches.length === 0) {
    logger.raw(warningBox(t('commands.branch.noBranchesAvailable')));
    return { action: 'switch', success: false };
  }

  const selectedBranch = await promptSelect<string>(
    t('commands.branch.switch'),
    otherBranches.map(b => ({
      name: theme.branchName(b.name, false),
      value: b.name
    }))
  );

  // Check for uncommitted changes
  const validation = await preventionService.validateCheckout(selectedBranch);

  if (validation.warnings.length > 0) {
    // Filter and display warnings based on level
    for (const warning of validation.warnings) {
      const category = warning.level === 'critical' ? 'critical' : 'warning';
      if (shouldShowWarning(category)) {
        logger.raw(warningBox(warning.message, warning.title));
      }
    }

    if (!validation.canProceed) {
      userConfig.incrementErrorsPrevented();
      return { action: 'switch', success: false };
    }

    // Only ask for confirmation if warnings were shown
    const hasVisibleWarnings = validation.warnings.some(w =>
      shouldShowWarning(w.level === 'critical' ? 'critical' : 'warning')
    );
    if (hasVisibleWarnings) {
      const proceed = await promptConfirm(t('prompts.continue'), false);
      if (!proceed) {
        userConfig.incrementErrorsPrevented();
        return { action: 'switch', success: false };
      }
    }
  }

  logger.command(`git checkout ${selectedBranch}`);
  await withSpinner(
    t('commands.branch.switching', { branch: selectedBranch }),
    async () => {
      await gitService.checkout(selectedBranch);
    },
    t('commands.branch.switchSuccess', { branch: selectedBranch })
  );

  logger.raw('\n' + successBox(
    t('commands.branch.switchSuccess', { branch: selectedBranch }),
    t('success.title')
  ));

  return { action: 'switch', branch: selectedBranch, success: true };
}

async function deleteBranch(): Promise<BranchResult> {
  const theme = getTheme();
  const branches = await gitService.getLocalBranches();

  // Filter out current branch
  const deletableBranches = branches.filter(b => !b.current);

  if (deletableBranches.length === 0) {
    logger.raw(warningBox(t('commands.branch.cannotDeleteCurrent')));
    return { action: 'delete', success: false };
  }

  const selectedBranch = await promptSelect<string>(
    t('commands.branch.delete'),
    deletableBranches.map(b => ({
      name: theme.branchName(b.name, false),
      value: b.name
    }))
  );

  // Validate deletion
  const validation = await preventionService.validateBranchDelete(selectedBranch);

  if (!validation.canProceed) {
    for (const warning of validation.warnings) {
      logger.raw(errorBox(warning.message, warning.title));
    }
    return { action: 'delete', success: false };
  }

  // Confirm deletion
  const confirmDelete = await promptConfirm(
    t('commands.branch.deleteConfirm', { branch: selectedBranch }),
    false
  );

  if (!confirmDelete) {
    return { action: 'delete', success: false };
  }

  logger.command(`git branch -d ${selectedBranch}`);
  await withSpinner(
    t('commands.branch.deleting', { branch: selectedBranch }),
    async () => {
      await gitService.deleteBranch(selectedBranch);
    },
    t('commands.branch.deleteSuccess', { branch: selectedBranch })
  );

  logger.raw('\n' + successBox(
    t('commands.branch.deleteSuccess', { branch: selectedBranch }),
    t('success.title')
  ));

  return { action: 'delete', branch: selectedBranch, success: true };
}

async function mergeBranch(): Promise<BranchResult> {
  const theme = getTheme();
  const currentBranch = await gitService.getCurrentBranch();
  const branches = await gitService.getLocalBranches();

  // Filter out current branch
  const otherBranches = branches.filter(b => !b.current);

  if (otherBranches.length === 0) {
    logger.raw(warningBox(t('commands.branch.noOtherBranches') || 'No other branches available'));
    return { action: 'merge', success: false };
  }

  // Show educational explanation for beginners only
  if (shouldShowExplanation()) {
    logger.raw('\n' + infoBox(
      t('commands.branch.mergeExplain', { branch: currentBranch || 'current' }),
      t('commands.branch.merge')
    ));
  }

  const selectedBranch = await promptSelect<string>(
    t('commands.branch.selectToMerge') || 'Select branch to merge:',
    otherBranches.map(b => ({
      name: theme.branchName(b.name, false),
      value: b.name
    }))
  );

  // Show command preview
  const commandPreview = `git merge ${selectedBranch}`;
  logger.raw(theme.textMuted(`\n${t('commands.branch.willExecute') || 'Will execute:'} ${commandPreview}\n`));

  // Confirm merge (level-based: merge is not destructive but impactful)
  if (shouldConfirm(false)) {
    const confirmMerge = await promptConfirm(
      t('commands.branch.mergeConfirm', { branch: selectedBranch }),
      true
    );

    if (!confirmMerge) {
      return { action: 'merge', success: false };
    }
  }

  logger.command(commandPreview);

  try {
    await withSpinner(
      t('commands.branch.merging', { branch: selectedBranch }) || `Merging ${selectedBranch}...`,
      async () => {
        await gitService.merge(selectedBranch);
      },
      t('commands.branch.mergeSuccess', { branch: selectedBranch })
    );

    // Check for conflicts after merge
    const hasConflicts = await gitService.hasConflicts();
    if (hasConflicts) {
      const conflictedFiles = await gitService.getConflictedFiles();
      logger.raw('\n' + errorBox(
        t('commands.branch.mergeConflicts') || 'Merge conflicts detected!',
        t('warnings.title')
      ));
      logger.raw(theme.warning(t('commands.branch.conflictedFiles') || 'Conflicted files:'));
      conflictedFiles.forEach(f => logger.raw(theme.file(f, 'conflict')));
      return { action: 'merge', branch: selectedBranch, success: false };
    }

    logger.raw('\n' + successBox(
      t('commands.branch.mergeSuccess', { branch: selectedBranch }),
      t('success.title')
    ));

    return { action: 'merge', branch: selectedBranch, success: true };
  } catch (error) {
    // Check if it's a merge conflict
    const hasConflicts = await gitService.hasConflicts();
    if (hasConflicts) {
      const conflictedFiles = await gitService.getConflictedFiles();
      logger.raw('\n' + errorBox(
        t('commands.branch.mergeConflicts') || 'Merge conflicts detected!',
        t('warnings.title')
      ));
      logger.raw(theme.warning(t('commands.branch.conflictedFiles') || 'Conflicted files:'));
      conflictedFiles.forEach(f => logger.raw(theme.file(f, 'conflict')));
      return { action: 'merge', branch: selectedBranch, success: false };
    }
    throw error;
  }
}

/**
 * Replay the current branch on top of another.
 *
 * A rebase that stops on a conflict is not a failure here: the in-progress
 * flow picks it up on the next menu and walks the user through it.
 */
async function rebaseBranch(currentBranch: string | null): Promise<BranchResult> {
  if (await gitService.hasUncommittedChanges()) {
    logger.raw(warningBox(t('commands.branch.squashDirty')));
    return { action: 'rebase', success: false };
  }

  if (shouldShowExplanation()) {
    logger.raw(infoBox(t('commands.branch.rebaseExplain')));
  }

  const branches = await gitService.getLocalBranches();
  const others = branches.filter(branch => !branch.current);

  if (others.length === 0) {
    logger.raw(warningBox(t('commands.branch.noOtherBranches')));
    return { action: 'rebase', success: false };
  }

  const onto = await promptSelect<string>(t('commands.branch.rebaseSelect'), [
    ...others.map(branch => ({ name: branch.name, value: branch.name })),
    { name: t('menu.back'), value: '' }
  ]);

  if (!onto) {
    return { action: 'rebase', success: true };
  }

  const ahead = await gitService.getCommitsAhead(onto);

  if (ahead.length === 0) {
    logger.raw(infoBox(t('commands.branch.rebaseNothing')));
    return { action: 'rebase', success: true };
  }

  // Rewriting commits that are already published forces everyone else to
  // reconcile, so the count is spelled out before confirming.
  const unpushed = await gitService.getUnpushedCommitCount().catch(() => ahead.length);
  const published = Math.max(0, ahead.length - unpushed);
  if (published > 0 && shouldShowWarning('warning')) {
    logger.raw(warningBox(
      t('commands.branch.rebasePushedWarning', { count: published }),
      t('warnings.title')
    ));
  }

  const confirmed = await promptConfirm(
    t('commands.branch.rebaseConfirm', {
      count: ahead.length,
      branch: currentBranch || 'HEAD',
      onto
    }),
    false
  );

  if (!confirmed) {
    return { action: 'rebase', success: true };
  }

  logger.command(`git rebase ${onto}`);
  const finished = await gitService.rebaseOnto(onto);

  if (!finished) {
    logger.raw(warningBox(t('commands.branch.rebaseStopped')));
    return { action: 'rebase', branch: onto, success: false };
  }

  logger.raw('\n' + successBox(t('commands.branch.rebaseDone', { onto }), t('success.title')));
  return { action: 'rebase', branch: onto, success: true };
}

/**
 * Collapse the most recent commits into a single one.
 */
async function squashCommits(): Promise<BranchResult> {
  if (await gitService.hasUncommittedChanges()) {
    logger.raw(warningBox(t('commands.branch.squashDirty')));
    return { action: 'squash', success: false };
  }

  if (shouldShowExplanation()) {
    logger.raw(infoBox(t('commands.branch.squashExplain')));
  }

  const history = await gitService.getLog(20);

  if (history.length < 2) {
    logger.raw(warningBox(t('commands.branch.squashTooFew')));
    return { action: 'squash', success: false };
  }

  const max = history.length;
  const answer = await promptInput(t('commands.branch.squashCount'), '2', (value: string) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 2 || parsed > max) {
      return t('commands.branch.squashCountInvalid', { max });
    }
    return true;
  });

  const count = Number(answer);
  if (!Number.isInteger(count) || count < 2 || count > max) {
    return { action: 'squash', success: false };
  }

  const theme = getTheme();
  logger.raw('\n' + theme.textBold(t('commands.branch.squashPreview', { count })));
  for (const commit of history.slice(0, count)) {
    logger.raw(`  ${theme.commitHash(commit.hash.substring(0, 7))}  ${commit.message.split('\n')[0]}`);
  }
  logger.raw('');

  const message = await promptInput(t('commands.branch.squashMessage'), '', (value: string) => {
    return value.trim().length > 0 ? true : t('commands.commit.messageTooShort');
  });

  if (!message || message.trim().length === 0) {
    return { action: 'squash', success: false };
  }

  if (!(await promptConfirm(t('commands.branch.squashConfirm', { count }), false))) {
    return { action: 'squash', success: true };
  }

  logger.command(`git reset --soft HEAD~${count} && git commit -m "${message.trim()}"`);
  await gitService.squashCommits(count, message.trim());
  logger.raw('\n' + successBox(t('commands.branch.squashDone', { count }), t('success.title')));

  return { action: 'squash', success: true };
}
