import { Command } from '@oclif/core';
import { initI18n, t, changeLanguage } from '../i18n/index.js';
import { userConfig } from '../config/user-config.js';
import {
  SUPPORTED_LANGUAGES,
  EXPERIENCE_LEVELS,
  THEMES,
  Language,
  Theme,
  ExperienceLevel
} from '../config/defaults.js';
import { logger } from '../utils/logger.js';
import { titleBox, successBox } from '../ui/components/box.js';
import { promptSelect } from '../ui/components/prompt.js';

export default class Init extends Command {
  static override description = 'First-time setup wizard for GitSense';

  static override examples = ['<%= config.bin %> init'];

  async run(): Promise<void> {
    await initI18n();

    // Welcome message
    logger.raw(titleBox('GitSense Setup', t('setup.welcome')));
    logger.raw('');

    // Select language
    const language = await promptSelect<Language>(
      t('setup.selectLanguage'),
      SUPPORTED_LANGUAGES.map(l => ({
        name: `${l.nativeName} (${l.name})`,
        value: l.code
      }))
    );

    changeLanguage(language);

    // Re-init i18n with new language for immediate effect
    await initI18n();

    // Select theme
    const selectedTheme = await promptSelect<Theme>(
      t('setup.selectTheme'),
      THEMES.map(th => ({
        name: th.theme === 'colored' ? 'Colored (with syntax highlighting)' : 'Monochrome (plain text)',
        value: th.theme,
        description: th.description
      }))
    );

    userConfig.setTheme(selectedTheme);

    // Select experience level
    const level = await promptSelect<ExperienceLevel>(
      t('setup.selectLevel'),
      EXPERIENCE_LEVELS.map(l => ({
        name: l.level.charAt(0).toUpperCase() + l.level.slice(1),
        value: l.level,
        description: l.description
      }))
    );

    userConfig.setExperienceLevel(level);

    // Mark first run as complete
    userConfig.setFirstRunComplete();

    // Success message
    logger.raw('\n' + successBox(
      `${t('setup.complete')}\n\n${t('setup.tip')}`,
      t('success.title')
    ));
    logger.raw('');
  }
}
