import { t } from '../../i18n/index.js';
import { promptConfirm, promptInput } from '../components/prompt.js';
import { successBox, warningBox, errorBox, infoBox } from '../components/box.js';
import { gitService } from '../../services/git-service.js';
import { logger } from '../../utils/logger.js';
import { mapGitError } from '../../utils/error-mapper.js';
import { shouldShowExplanation, shouldConfirm } from '../../utils/level-helper.js';

/**
 * Rewrite the most recent commit.
 *
 * The important part is the warning: once a commit is pushed, amending it
 * replaces a commit other people may already have.
 */
export async function runAmendFlow(): Promise<void> {
  const current = await gitService.getLastCommitMessage();

  if (!current) {
    logger.raw(warningBox(t('commands.undo.noCommitToAmend')));
    return;
  }

  if (shouldShowExplanation()) {
    logger.raw(infoBox(t('commands.undo.amendExplain')));
  }

  logger.raw(infoBox(t('commands.undo.amendCurrent', { message: current.split('\n')[0] })));

  const staged = await gitService.getStagedFiles();
  if (staged.length > 0) {
    logger.raw(infoBox(t('commands.undo.amendStagedNote', { count: staged.length })));
  }

  // An unpushed commit is the user's alone; a pushed one is shared history.
  let alreadyPushed = false;
  try {
    alreadyPushed = (await gitService.getUnpushedCommitCount()) === 0;
  } catch {
    logger.debug('Could not determine whether the last commit was pushed');
  }

  if (alreadyPushed) {
    logger.raw(warningBox(t('commands.undo.amendPushedWarning'), t('warnings.title')));
  }

  const newMessage = await promptInput(t('commands.undo.amendNewMessage'), '');

  // Amending a pushed commit is the dangerous case, so confirm it even for
  // experts, who otherwise only confirm destructive actions.
  if (shouldConfirm(true) || alreadyPushed) {
    if (!(await promptConfirm(t('commands.undo.amendConfirm'), false))) {
      return;
    }
  }

  const message = newMessage.trim();

  try {
    logger.command(message ? `git commit --amend -m "${message}"` : 'git commit --amend --no-edit');
    await gitService.amendCommit(message || undefined);
    logger.raw(successBox(t('commands.undo.amended')));
  } catch (error) {
    logger.raw(errorBox(mapGitError(error)));
  }
}
