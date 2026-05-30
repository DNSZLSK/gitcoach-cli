import { t } from '../../i18n/index.js';
import { getTheme } from '../themes/index.js';
import { promptSelect, promptInput, promptConfirm } from '../components/prompt.js';
import { successBox, warningBox, errorBox, infoBox } from '../components/box.js';
import { gitService } from '../../services/git-service.js';
import { logger } from '../../utils/logger.js';
import { mapGitError } from '../../utils/error-mapper.js';
import { isValidBranchName } from '../../utils/validators.js';
import { shouldShowExplanation } from '../../utils/level-helper.js';

/**
 * Recover "lost" commits or branches via the reflog — the typical panic
 * scenario after a bad reset/checkout. Lets the user create a new branch
 * pointing at any reflog entry (non-destructive).
 */
export async function showRecoveryMenu(): Promise<void> {
  const theme = getTheme();

  logger.raw('\n' + theme.title(t('commands.recovery.title')) + '\n');

  if (shouldShowExplanation()) {
    logger.raw(infoBox(t('commands.recovery.explain'), t('commands.recovery.title')));
  }

  try {
    const entries = await gitService.getReflog(30);

    if (entries.length === 0) {
      logger.raw(warningBox(t('commands.recovery.empty')));
      return;
    }

    const choices = entries.map(entry => ({
      name: `${theme.commitHash(entry.hash)} ${theme.dim(entry.ref)} ${entry.message}`,
      value: entry.hash
    }));
    choices.push({ name: t('menu.back'), value: 'back' });

    const selectedHash = await promptSelect<string>(t('commands.recovery.selectEntry'), choices);
    if (!selectedHash || selectedHash === 'back') {
      return;
    }

    const branchName = await promptInput(
      t('commands.recovery.branchNamePrompt'),
      '',
      (value: string) => {
        if (value.trim().length === 0) {
          return true;
        }
        return isValidBranchName(value.trim()) ? true : t('commands.recovery.invalidBranch');
      }
    );
    if (!branchName || branchName.trim().length === 0) {
      logger.raw(theme.textMuted(t('prompts.cancel')) + '\n');
      return;
    }

    const confirm = await promptConfirm(
      t('commands.recovery.confirmCreate', { branch: branchName.trim(), hash: selectedHash }),
      true
    );
    if (!confirm) {
      return;
    }

    logger.command(`git branch ${branchName.trim()} ${selectedHash}`);
    await gitService.createBranchAt(branchName.trim(), selectedHash);

    logger.raw('\n' + successBox(
      t('commands.recovery.success', { branch: branchName.trim(), hash: selectedHash }),
      t('success.title')
    ));
  } catch (error) {
    logger.raw(errorBox(mapGitError(error)));
  }
}
