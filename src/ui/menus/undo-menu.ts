import { t } from '../../i18n/index.js';
import { getTheme } from '../themes/index.js';
import { promptSelect, promptConfirm, promptCheckbox } from '../components/prompt.js';
import { successBox, warningBox, errorBox, infoBox } from '../components/box.js';
import { gitService } from '../../services/git-service.js';
import { logger } from '../../utils/logger.js';

export type UndoAction = 'soft_reset' | 'hard_reset' | 'unstage' | 'restore' | 'back';

export async function showUndoMenu(): Promise<void> {
  const theme = getTheme();

  logger.raw('\n' + theme.title(t('commands.undo.title')) + '\n');

  const choices = [
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
    case 'back':
      return;
  }
}

async function handleSoftReset(): Promise<void> {
  const theme = getTheme();

  // Show explanation
  logger.raw(infoBox(
    t('commands.undo.softResetExplain'),
    t('commands.undo.whatItDoes')
  ));

  // Get last commits for context
  const commits = await gitService.getLog(3);
  if (commits.length === 0) {
    logger.raw(warningBox(t('commands.undo.noCommits')));
    return;
  }

  logger.raw('\n' + theme.textBold(t('commands.undo.lastCommit')) + '\n');
  const lastCommit = commits[0];
  logger.raw(`  ${theme.commitHash(lastCommit.hash)} ${lastCommit.message}\n`);

  const confirm = await promptConfirm(t('commands.undo.confirmSoftReset'), false);

  if (!confirm) {
    logger.raw(theme.textMuted(t('prompts.cancel')) + '\n');
    return;
  }

  try {
    logger.command('git reset --soft HEAD~1');
    await gitService.reset('soft', 'HEAD~1');
    logger.raw('\n' + successBox(t('commands.undo.softResetSuccess')));
    logger.raw(theme.info(t('commands.undo.filesKept')) + '\n');
  } catch (error) {
    logger.raw(errorBox(t('errors.generic', {
      message: error instanceof Error ? error.message : 'Unknown error'
    })));
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
    logger.raw(errorBox(t('errors.generic', {
      message: error instanceof Error ? error.message : 'Unknown error'
    })));
  }
}

async function handleUnstage(): Promise<void> {
  const theme = getTheme();

  // Show explanation
  logger.raw(infoBox(
    t('commands.undo.unstageExplain'),
    t('commands.undo.whatItDoes')
  ));

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
    logger.raw(errorBox(t('errors.generic', {
      message: error instanceof Error ? error.message : 'Unknown error'
    })));
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
    logger.raw(errorBox(t('errors.generic', {
      message: error instanceof Error ? error.message : 'Unknown error'
    })));
  }
}
