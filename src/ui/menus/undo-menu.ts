import { t } from '../../i18n/index.js';
import { getTheme } from '../themes/index.js';
import { promptSelect, promptConfirm, promptCheckbox } from '../components/prompt.js';
import { successBox, warningBox, errorBox, infoBox } from '../components/box.js';
import { gitService } from '../../services/git-service.js';
import { logger } from '../../utils/logger.js';
import { mapGitError } from '../../utils/error-mapper.js';
import { shouldShowExplanation, shouldConfirm } from '../../utils/level-helper.js';
import { showRecoveryMenu } from './recovery-menu.js';
import { runAmendFlow } from '../flows/amend.js';

export type UndoAction =
  | 'amend'
  | 'revert'
  | 'soft_reset'
  | 'hard_reset'
  | 'unstage'
  | 'restore'
  | 'clean'
  | 'recover'
  | 'back';

export async function showUndoMenu(): Promise<void> {
  const theme = getTheme();

  logger.raw('\n' + theme.title(t('commands.undo.title')) + '\n');

  const choices = [
    {
      name: theme.menuItem('M', t('commands.undo.amend')),
      value: 'amend' as UndoAction,
      description: t('commands.undo.amendDesc')
    },
    {
      name: theme.menuItem('V', t('commands.undo.revert')),
      value: 'revert' as UndoAction,
      description: t('commands.undo.revertDesc')
    },
    {
      name: theme.menuItem('S', t('commands.undo.softReset')),
      value: 'soft_reset' as UndoAction,
      description: t('commands.undo.softResetDesc')
    },
    {
      name: theme.menuItem('H', t('commands.undo.hardReset') + ' ⚠️'),
      value: 'hard_reset' as UndoAction,
      description: t('commands.undo.hardResetDesc')
    },
    {
      name: theme.menuItem('U', t('commands.undo.unstage')),
      value: 'unstage' as UndoAction,
      description: t('commands.undo.unstageDesc')
    },
    {
      name: theme.menuItem('R', t('commands.undo.restore') + ' ⚠️'),
      value: 'restore' as UndoAction,
      description: t('commands.undo.restoreDesc')
    },
    {
      name: theme.menuItem('C', t('commands.undo.clean') + ' ⚠️'),
      value: 'clean' as UndoAction,
      description: t('commands.undo.cleanDesc')
    },
    {
      name: theme.menuItem('F', t('commands.recovery.menuItem')),
      value: 'recover' as UndoAction,
      description: t('commands.recovery.menuItemDesc')
    },
    {
      name: theme.dim('─'.repeat(40)),
      value: 'separator' as UndoAction,
      disabled: true
    },
    {
      name: theme.menuItem('B', t('menu.back')),
      value: 'back' as UndoAction
    }
  ];

  const action = await promptSelect<UndoAction>(t('commands.undo.selectAction'), choices);

  switch (action) {
    case 'amend':
      await runAmendFlow();
      break;

    case 'revert':
      await handleRevert();
      break;

    case 'soft_reset':
      await handleSoftReset();
      break;
    case 'hard_reset':
      await handleHardReset();
      break;
    case 'unstage':
      await handleUnstage();
      break;
    case 'restore':
      await handleRestore();
      break;
    case 'clean':
      await handleClean();
      break;
    case 'recover':
      await showRecoveryMenu();
      break;
    case 'back':
      return;
  }
}

async function handleSoftReset(): Promise<void> {
  const theme = getTheme();

  // Show explanation for beginners only
  if (shouldShowExplanation()) {
    logger.raw(infoBox(
      t('commands.undo.softResetExplain'),
      t('commands.undo.whatItDoes')
    ));
  }

  // Get last commits for context
  const commits = await gitService.getLog(3);
  if (commits.length === 0) {
    logger.raw(warningBox(t('commands.undo.noCommits')));
    return;
  }

  logger.raw('\n' + theme.textBold(t('commands.undo.lastCommit')) + '\n');
  const lastCommit = commits[0];
  logger.raw(`  ${theme.commitHash(lastCommit.hash)} ${lastCommit.message}\n`);

  // Soft reset is not destructive (files are kept), so use level-based confirmation
  if (shouldConfirm(false)) {
    const confirm = await promptConfirm(t('commands.undo.confirmSoftReset'), false);
    if (!confirm) {
      logger.raw(theme.textMuted(t('prompts.cancel')) + '\n');
      return;
    }
  }

  try {
    logger.command('git reset --soft HEAD~1');
    await gitService.reset('soft', 'HEAD~1');
    logger.raw('\n' + successBox(t('commands.undo.softResetSuccess')));
    logger.raw(theme.info(t('commands.undo.filesKept')) + '\n');
  } catch (error) {
    logger.raw(errorBox(mapGitError(error)));
  }
}

async function handleHardReset(): Promise<void> {
  const theme = getTheme();

  // Critical warning
  logger.raw(errorBox(
    t('commands.undo.hardResetWarning'),
    '⚠️ ' + t('warnings.dangerous')
  ));

  // Get last commit info
  const commits = await gitService.getLog(3);
  if (commits.length === 0) {
    logger.raw(warningBox(t('commands.undo.noCommits')));
    return;
  }

  logger.raw('\n' + theme.textBold(t('commands.undo.lastCommit')) + '\n');
  const lastCommit = commits[0];
  logger.raw(`  ${theme.commitHash(lastCommit.hash)} ${lastCommit.message}\n`);

  // Double confirmation
  const confirm1 = await promptConfirm(t('commands.undo.confirmHardReset'), false);
  if (!confirm1) {
    logger.raw(theme.textMuted(t('prompts.cancel')) + '\n');
    return;
  }

  const confirm2 = await promptConfirm(t('commands.undo.confirmHardReset2'), false);
  if (!confirm2) {
    logger.raw(theme.textMuted(t('prompts.cancel')) + '\n');
    return;
  }

  try {
    logger.command('git reset --hard HEAD~1');
    await gitService.reset('hard', 'HEAD~1');
    logger.raw('\n' + successBox(t('commands.undo.hardResetSuccess')));
  } catch (error) {
    logger.raw(errorBox(mapGitError(error)));
  }
}

async function handleUnstage(): Promise<void> {
  const theme = getTheme();

  // Show explanation for beginners only
  if (shouldShowExplanation()) {
    logger.raw(infoBox(
      t('commands.undo.unstageExplain'),
      t('commands.undo.whatItDoes')
    ));
  }

  const stagedFiles = await gitService.getStagedFiles();

  if (stagedFiles.length === 0) {
    logger.raw(warningBox(t('commands.undo.noStagedFiles')));
    return;
  }

  logger.raw('\n' + theme.textBold(t('commands.undo.stagedFiles')) + '\n');

  const choices = stagedFiles.map(file => ({
    name: theme.staged(file),
    value: file,
    checked: false
  }));

  const selectedFiles = await promptCheckbox<string>(
    t('commands.undo.selectFilesToUnstage'),
    choices
  );

  if (selectedFiles.length === 0) {
    logger.raw(theme.textMuted(t('prompts.cancel')) + '\n');
    return;
  }

  try {
    for (const file of selectedFiles) {
      logger.command(`git restore --staged "${file}"`);
      await gitService.reset('mixed', `HEAD -- ${file}`);
    }
    logger.raw('\n' + successBox(t('commands.undo.unstageSuccess', { count: selectedFiles.length })));
  } catch (error) {
    logger.raw(errorBox(mapGitError(error)));
  }
}

async function handleRestore(): Promise<void> {
  const theme = getTheme();

  // Critical warning
  logger.raw(errorBox(
    t('commands.undo.restoreWarning'),
    '⚠️ ' + t('warnings.dangerous')
  ));

  const status = await gitService.getStatus();
  const modifiedFiles = [...status.modified, ...status.deleted];

  if (modifiedFiles.length === 0) {
    logger.raw(warningBox(t('commands.undo.noModifiedFiles')));
    return;
  }

  logger.raw('\n' + theme.textBold(t('commands.undo.modifiedFiles')) + '\n');

  const choices = modifiedFiles.map(file => ({
    name: theme.modified(file),
    value: file,
    checked: false
  }));

  const selectedFiles = await promptCheckbox<string>(
    t('commands.undo.selectFilesToRestore'),
    choices
  );

  if (selectedFiles.length === 0) {
    logger.raw(theme.textMuted(t('prompts.cancel')) + '\n');
    return;
  }

  // Confirm data loss
  const confirm = await promptConfirm(
    t('commands.undo.confirmRestore', { count: selectedFiles.length }),
    false
  );

  if (!confirm) {
    logger.raw(theme.textMuted(t('prompts.cancel')) + '\n');
    return;
  }

  try {
    for (const file of selectedFiles) {
      logger.command(`git restore "${file}"`);
      await gitService.checkout(file);
    }
    logger.raw('\n' + successBox(t('commands.undo.restoreSuccess', { count: selectedFiles.length })));
  } catch (error) {
    logger.raw(errorBox(mapGitError(error)));
  }
}

/**
 * Undo a commit by adding one that cancels it, leaving history intact.
 */
async function handleRevert(): Promise<void> {
  const commits = await gitService.getLog(10);

  if (commits.length === 0) {
    logger.raw(warningBox(t('commands.undo.noCommitsToRevert')));
    return;
  }

  if (shouldShowExplanation()) {
    logger.raw(infoBox(t('commands.undo.revertExplain')));
  }

  const selected = await promptSelect<string>(t('commands.undo.selectCommitToRevert'), [
    ...commits.map(commit => ({
      name: `${commit.hash.substring(0, 7)}  ${commit.message.split('\n')[0]}`,
      value: commit.hash
    })),
    { name: t('menu.back'), value: '' }
  ]);

  if (!selected) {
    return;
  }

  const target = commits.find(commit => commit.hash === selected);
  const subject = target ? target.message.split('\n')[0] : selected;

  // --no-edit means git writes the message itself, so show exactly what will
  // land in the history rather than leaving the user to discover it after.
  logger.raw(infoBox(t('commands.undo.revertMessagePreview', {
    subject,
    hash: selected.substring(0, 7)
  })));

  if (!(await promptConfirm(t('commands.undo.confirmRevert', { message: subject }), false))) {
    return;
  }

  try {
    logger.command(`git revert --no-edit ${selected.substring(0, 7)}`);
    await gitService.revertCommit(selected);
    logger.raw(successBox(t('commands.undo.reverted')));
  } catch (error) {
    // A revert that touches changed lines stops with conflict markers, exactly
    // like a merge; say so instead of reporting a bare git error.
    if (await gitService.hasConflicts()) {
      logger.raw(warningBox(t('commands.undo.revertConflict')));
      return;
    }
    logger.raw(errorBox(mapGitError(error)));
  }
}

/**
 * Delete untracked files.
 *
 * The most destructive thing in this menu, and it is worth being explicit
 * about why. A hard reset drops commits, but the reflog still holds them for
 * weeks. Untracked files were never committed at all: once deleted there is
 * nothing anywhere to recover from. So nothing is deleted before the user has
 * seen the exact list and picked from it.
 *
 * Files excluded by .gitignore are not offered — see previewClean.
 */
async function handleClean(): Promise<void> {
  const theme = getTheme();

  logger.raw(errorBox(
    t('commands.undo.cleanWarning'),
    '⚠️ ' + t('warnings.dangerous')
  ));

  let candidates: string[];
  try {
    logger.command('git clean -nd');
    candidates = await gitService.previewClean();
  } catch (error) {
    logger.raw(errorBox(mapGitError(error)));
    return;
  }

  if (candidates.length === 0) {
    logger.raw(warningBox(t('commands.undo.cleanNothing')));
    return;
  }

  logger.raw('\n' + theme.textBold(t('commands.undo.cleanPreview', { count: candidates.length })) + '\n');
  candidates.forEach(path => logger.raw(theme.file(path, 'untracked')));
  logger.raw('');

  const selected = await promptCheckbox<string>(
    t('commands.undo.selectFilesToClean'),
    candidates.map(path => ({ name: theme.file(path, 'untracked'), value: path, checked: false }))
  );

  if (selected.length === 0) {
    logger.raw(theme.textMuted(t('prompts.cancel')) + '\n');
    return;
  }

  const confirmed = await promptConfirm(
    t('commands.undo.confirmClean', { count: selected.length }),
    false
  );

  if (!confirmed) {
    logger.raw(theme.textMuted(t('prompts.cancel')) + '\n');
    return;
  }

  try {
    logger.command(`git clean -fd -- ${selected.join(' ')}`);
    await gitService.cleanUntracked(selected);
    logger.raw('\n' + successBox(t('commands.undo.cleanSuccess', { count: selected.length })));
  } catch (error) {
    logger.raw(errorBox(mapGitError(error)));
  }
}
