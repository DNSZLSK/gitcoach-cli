import { t, changeLanguage } from '../../i18n/index.js';
import { getTheme } from '../themes/index.js';
import { promptSelect, promptConfirm } from '../components/prompt.js';
import { successBox, infoBox } from '../components/box.js';
import { withSpinner } from '../components/spinner.js';
import { userConfig } from '../../config/user-config.js';
import { copilotService } from '../../services/copilot-service.js';
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
  | 'copilotRefresh'
  | 'reset'
  | 'back';

export async function showConfigMenu(): Promise<void> {
  const theme = getTheme();
  let running = true;

  while (running) {
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
      { name: t('config.copilotRefresh'), value: 'copilotRefresh' },
      { name: theme.warning(t('config.reset')), value: 'reset' },
      { name: t('menu.back'), value: 'back' }
    ]);

    if (action === 'back') {
      running = false;
      continue;
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
          name: t(`themes.${th.theme}`),
          value: th.theme,
          description: t(`themes.${th.theme}Desc`)
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
          name: t(`levels.${l.level}`),
          value: l.level,
          description: t(`levels.${l.level}Desc`)
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

    case 'copilotRefresh': {
      copilotService.resetAvailability();
      const available = await withSpinner(
        t('config.copilotChecking'),
        () => copilotService.isAvailable(),
        ''
      );
      if (available) {
        logger.raw(successBox(t('config.copilotAvailable')));
      } else {
        logger.raw(infoBox(t('config.copilotNotAvailable')));
      }
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
