import { t } from '../../i18n/index.js';
import { getTheme } from '../themes/index.js';
import { promptSelect, promptInput, promptConfirm } from '../components/prompt.js';
import { successBox, warningBox, errorBox, infoBox } from '../components/box.js';
import { branchTable } from '../components/table.js';
import { withSpinner } from '../components/spinner.js';
import { gitService } from '../../services/git-service.js';
import { preventionService } from '../../services/prevention-service.js';
import { isValidBranchName } from '../../utils/validators.js';
import { logger } from '../../utils/logger.js';
import { shouldShowExplanation, shouldConfirm, shouldShowWarning } from '../../utils/level-helper.js';

export type BranchAction = 'list' | 'create' | 'switch' | 'merge' | 'delete' | 'back';

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

      case 'delete':
        return await deleteBranch();

      case 'back':
      default:
        return { action: 'back', success: true };
    }
  } catch (error) {
    logger.error(t('errors.generic', { message: error instanceof Error ? error.message : 'Unknown error' }));
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
        return 'Invalid branch name';
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
    `Creating branch ${branchName}...`,
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
    logger.raw(warningBox('No other branches available'));
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
      return { action: 'switch', success: false };
    }

    // Only ask for confirmation if warnings were shown
    const hasVisibleWarnings = validation.warnings.some(w =>
      shouldShowWarning(w.level === 'critical' ? 'critical' : 'warning')
    );
    if (hasVisibleWarnings) {
      const proceed = await promptConfirm(t('prompts.continue'), false);
      if (!proceed) {
        return { action: 'switch', success: false };
      }
    }
  }

  logger.command(`git checkout ${selectedBranch}`);
  await withSpinner(
    `Switching to ${selectedBranch}...`,
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
    `Deleting branch ${selectedBranch}...`,
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
