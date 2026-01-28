import { t } from '../../i18n/index.js';
import { getTheme } from '../themes/index.js';
import { promptSelect, promptConfirm, promptInput } from '../components/prompt.js';
import { successBox, warningBox, infoBox } from '../components/box.js';
import { gitService } from '../../services/git-service.js';
import { logger } from '../../utils/logger.js';
import { isValidRemoteUrl } from '../../utils/validators.js';

type RemoteAction = 'view' | 'add' | 'change' | 'remove' | 'back';

export async function showRemoteMenu(): Promise<void> {
  const theme = getTheme();

  while (true) {
    logger.raw('\n' + theme.title(t('commands.remote.title')) + '\n');

    const remoteUrl = await gitService.getRemoteUrl('origin');
    const hasRemote = !!remoteUrl;

    if (hasRemote) {
      logger.raw(infoBox(t('commands.remote.currentRemote', { url: remoteUrl })));
    } else {
      logger.raw(warningBox(t('commands.remote.noRemoteConfigured')));
    }

    const choices: { name: string; value: RemoteAction }[] = [];

    if (hasRemote) {
      choices.push(
        { name: theme.menuItem('V', t('commands.remote.viewCurrent')), value: 'view' },
        { name: theme.menuItem('C', t('commands.remote.changeUrl')), value: 'change' },
        { name: theme.menuItem('D', t('commands.remote.removeRemote')), value: 'remove' }
      );
    } else {
      choices.push(
        { name: theme.menuItem('A', t('commands.remote.addOrigin')), value: 'add' }
      );
    }

    choices.push(
      { name: theme.menuItem('B', t('menu.back')), value: 'back' }
    );

    const action = await promptSelect<RemoteAction>(
      t('commands.remote.selectAction'),
      choices
    );

    if (action === 'back') {
      break;
    }

    await handleRemoteAction(action);
  }
}

async function handleRemoteAction(action: RemoteAction): Promise<void> {
  switch (action) {
    case 'view': {
      const url = await gitService.getRemoteUrl('origin');
      if (url) {
        logger.raw(infoBox(t('commands.remote.currentRemote', { url })));
      }
      break;
    }

    case 'add': {
      await promptAndAddRemote();
      break;
    }

    case 'change': {
      const confirm = await promptConfirm(t('commands.remote.changeRemoteConfirm'), false);
      if (!confirm) {
        break;
      }

      await gitService.removeRemote('origin');
      const theme = getTheme();
      logger.raw(theme.info(t('commands.remote.remoteRemoved')) + '\n');
      await promptAndAddRemote();
      break;
    }

    case 'remove': {
      const hasRemote = await gitService.hasRemote();
      if (!hasRemote) {
        logger.raw(warningBox(t('commands.remote.noRemoteToRemove')));
        break;
      }

      const confirm = await promptConfirm(t('commands.remote.confirmRemove'), false);
      if (!confirm) {
        break;
      }

      await gitService.removeRemote('origin');
      logger.raw(successBox(t('commands.remote.remoteRemoved')));
      break;
    }
  }
}

async function promptAndAddRemote(): Promise<void> {
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
    return;
  }

  try {
    await gitService.addRemote('origin', url);
    logger.raw(successBox(t('setup.remoteAdded', { url })));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.raw(warningBox(t('errors.generic', { message: errorMessage })));
  }
}
