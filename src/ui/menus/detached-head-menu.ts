import { t } from '../../i18n/index.js';
import { getTheme } from '../themes/index.js';
import { promptSelect, promptInput, promptConfirm } from '../components/prompt.js';
import { warningBox, successBox } from '../components/box.js';
import { withSpinner } from '../components/spinner.js';
import { gitService } from '../../services/git-service.js';
import { userConfig } from '../../config/user-config.js';
import { isValidBranchName } from '../../utils/validators.js';
import { logger } from '../../utils/logger.js';

export type DetachedHeadAction = 'createBranch' | 'returnToMain' | 'stashAndReturn' | 'ignore';

export async function showDetachedHeadMenu(): Promise<DetachedHeadAction> {

  // Show educational warning
  logger.raw('\n' + warningBox(
    t('detachedHead.explanation'),
    t('detachedHead.title')
  ));

  const choices = [
    { name: t('detachedHead.createBranch'), value: 'createBranch' as DetachedHeadAction },
    { name: t('detachedHead.returnToMain'), value: 'returnToMain' as DetachedHeadAction },
    { name: t('detachedHead.stashAndReturn'), value: 'stashAndReturn' as DetachedHeadAction },
    { name: t('detachedHead.ignore'), value: 'ignore' as DetachedHeadAction }
  ];

  return promptSelect(t('detachedHead.selectAction'), choices);
}

export async function handleDetachedHead(action: DetachedHeadAction): Promise<boolean> {
  const theme = getTheme();
  const defaultBranch = userConfig.getDefaultBranch() || 'main';

  try {
    switch (action) {
      case 'createBranch': {
        const branchName = await promptInput(
          t('detachedHead.enterBranchName'),
          '',
          (value) => {
            if (!isValidBranchName(value)) {
              return t('commands.branch.invalidName');
            }
            return true;
          }
        );

        if (!branchName) {
          return false;
        }

        const command = `git checkout -b ${branchName}`;
        logger.command(command);
        logger.raw(theme.textMuted(t('detachedHead.commandExecuted', { command })));

        await withSpinner(
          t('commands.branch.creating', { branch: branchName }),
          async () => {
            await gitService.createBranch(branchName, true);
          },
          t('detachedHead.branchCreated', { branch: branchName })
        );

        logger.raw('\n' + successBox(
          t('detachedHead.branchCreated', { branch: branchName }),
          t('success.title')
        ));
        return true;
      }

      case 'returnToMain': {
        // Check for uncommitted changes
        const hasChanges = await gitService.hasUncommittedChanges();
        if (hasChanges) {
          logger.raw(warningBox(t('warnings.uncommittedChanges'), t('warnings.title')));
          const proceed = await promptConfirm(t('prompts.continue'), false);
          if (!proceed) {
            return false;
          }
        }

        const command = `git checkout ${defaultBranch}`;
        logger.command(command);
        logger.raw(theme.textMuted(t('detachedHead.commandExecuted', { command })));

        await withSpinner(
          t('commands.branch.switching', { branch: defaultBranch }),
          async () => {
            await gitService.checkout(defaultBranch);
          },
          t('detachedHead.returnedToMain', { branch: defaultBranch })
        );

        logger.raw('\n' + successBox(
          t('detachedHead.returnedToMain', { branch: defaultBranch }),
          t('success.title')
        ));
        return true;
      }

      case 'stashAndReturn': {
        // Check if there are changes to stash
        const hasChanges = await gitService.hasUncommittedChanges();

        if (hasChanges) {
          // Stash the changes
          const stashCommand = 'git stash';
          logger.command(stashCommand);
          await gitService.stash(t('detachedHead.stashMessage'));
        }

        // Checkout default branch
        const checkoutCommand = `git checkout ${defaultBranch}`;
        logger.command(checkoutCommand);

        await withSpinner(
          t('commands.branch.switching', { branch: defaultBranch }),
          async () => {
            await gitService.checkout(defaultBranch);
          },
          t('detachedHead.returnedToMain', { branch: defaultBranch })
        );

        // Pop the stash if we stashed something
        if (hasChanges) {
          logger.command('git stash pop');
          await gitService.stashPop();
        }

        logger.raw('\n' + successBox(
          t('detachedHead.stashedAndReturned', { branch: defaultBranch }),
          t('success.title')
        ));
        return true;
      }

      case 'ignore':
      default:
        return true;
    }
  } catch (error) {
    logger.error(t('errors.generic', { message: error instanceof Error ? error.message : 'Unknown error' }));
    return false;
  }
}
