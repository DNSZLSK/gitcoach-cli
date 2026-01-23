import { t, changeLanguage } from '../../i18n/index.js';
import { getTheme } from '../themes/index.js';
import { promptSelect, promptConfirm } from '../components/prompt.js';
import { successBox, infoBox } from '../components/box.js';
import { userConfig } from '../../config/user-config.js';
import {
  SUPPORTED_LANGUAGES,
  EXPERIENCE_LEVELS,
  THEMES,
  Language,
  Theme,
  ExperienceLevel
} from '../../config/defaults.js';
import { logger } from '../../utils/logger.js';

export type ConfigAction =
  | 'language'
  | 'theme'
  | 'level'
  | 'tips'
  | 'confirmActions'
  | 'autoCommit'
  | 'reset'
  | 'back';

export async function showConfigMenu(): Promise<void> {
  const theme = getTheme();

  while (true) {
    logger.raw('\n' + theme.title(t('config.title')) + '\n');

    // Show current settings
    const currentSettings = [
      `${t('config.language')}: ${SUPPORTED_LANGUAGES.find(l => l.code === userConfig.getLanguage())?.nativeName}`,
      `${t('config.theme')}: ${userConfig.getTheme()}`,
      `${t('config.experienceLevel')}: ${userConfig.getExperienceLevel()}`,
      `${t('config.showTips')}: ${userConfig.getShowTips() ? '✓' : '✗'}`,
      `${t('config.confirmDestructive')}: ${userConfig.getConfirmDestructiveActions() ? '✓' : '✗'}`,
      `${t('config.autoCommitMsg')}: ${userConfig.getAutoGenerateCommitMessages() ? '✓' : '✗'}`
    ];

    logger.raw(infoBox(currentSettings.join('\n')));

    const action = await promptSelect<ConfigAction>(t('prompts.select'), [
      { name: t('config.language'), value: 'language' },
      { name: t('config.theme'), value: 'theme' },
      { name: t('config.experienceLevel'), value: 'level' },
      { name: t('config.showTips'), value: 'tips' },
      { name: t('config.confirmDestructive'), value: 'confirmActions' },
      { name: t('config.autoCommitMsg'), value: 'autoCommit' },
      { name: theme.warning(t('config.reset')), value: 'reset' },
      { name: t('menu.back'), value: 'back' }
    ]);

    if (action === 'back') {
      break;
    }

    await handleConfigAction(action);
  }
}

async function handleConfigAction(action: ConfigAction): Promise<void> {
  switch (action) {
    case 'language': {
      const language = await promptSelect<Language>(
        t('setup.selectLanguage'),
        SUPPORTED_LANGUAGES.map(l => ({
          name: `${l.nativeName} (${l.name})`,
          value: l.code
        }))
      );
      changeLanguage(language);
      logger.raw(successBox(t('success.configUpdated')));
      break;
    }

    case 'theme': {
      const selectedTheme = await promptSelect<Theme>(
        t('setup.selectTheme'),
        THEMES.map(th => ({
          name: th.theme,
          value: th.theme,
          description: th.description
        }))
      );
      userConfig.setTheme(selectedTheme);
      logger.raw(successBox(t('success.configUpdated')));
      break;
    }

    case 'level': {
      const level = await promptSelect<ExperienceLevel>(
        t('setup.selectLevel'),
        EXPERIENCE_LEVELS.map(l => ({
          name: l.level,
          value: l.level,
          description: l.description
        }))
      );
      userConfig.setExperienceLevel(level);
      logger.raw(successBox(t('success.configUpdated')));
      break;
    }

    case 'tips': {
      const showTips = await promptConfirm(
        t('config.showTips'),
        userConfig.getShowTips()
      );
      userConfig.setShowTips(showTips);
      logger.raw(successBox(t('success.configUpdated')));
      break;
    }

    case 'confirmActions': {
      const confirmActions = await promptConfirm(
        t('config.confirmDestructive'),
        userConfig.getConfirmDestructiveActions()
      );
      userConfig.setConfirmDestructiveActions(confirmActions);
      logger.raw(successBox(t('success.configUpdated')));
      break;
    }

    case 'autoCommit': {
      const autoCommit = await promptConfirm(
        t('config.autoCommitMsg'),
        userConfig.getAutoGenerateCommitMessages()
      );
      userConfig.setAutoGenerateCommitMessages(autoCommit);
      logger.raw(successBox(t('success.configUpdated')));
      break;
    }

    case 'reset': {
      const confirmReset = await promptConfirm(t('config.resetConfirm'), false);
      if (confirmReset) {
        userConfig.reset();
        logger.raw(successBox(t('success.configUpdated')));
      }
      break;
    }
  }
}
