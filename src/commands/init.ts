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
import { titleBox, successBox, infoBox, warningBox } from '../ui/components/box.js';
import { promptSelect, promptConfirm } from '../ui/components/prompt.js';
import { copilotService } from '../services/copilot-service.js';
import { createSpinner } from '../ui/components/spinner.js';
import { getTheme } from '../ui/themes/index.js';

export default class Init extends Command {
  static override description = 'First-time setup wizard for GitCoach';

  static override examples = ['<%= config.bin %> init'];

  async run(): Promise<void> {
    await initI18n();

    // Welcome message
    logger.raw(titleBox('GitCoach Setup', t('setup.welcome')));
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

    // Check for Copilot CLI availability
    await this.checkAndOfferCopilotInstallation();

    // Mark first run as complete
    userConfig.setFirstRunComplete();

    // Success message
    logger.raw('\n' + successBox(
      `${t('setup.complete')}\n\n${t('setup.tip')}`,
      t('success.title')
    ));
    logger.raw('');
  }

  private async checkAndOfferCopilotInstallation(): Promise<void> {
    const theme = getTheme();

    // Check if Copilot CLI is already available
    const copilotAvailable = await copilotService.isAvailable();

    if (copilotAvailable) {
      // Copilot CLI is already installed
      logger.raw('\n' + theme.success('✓ ' + t('setup.copilotDetected')));
      return;
    }

    // Copilot CLI not found - show info and offer installation
    logger.raw('\n' + infoBox(
      t('setup.copilotNotInstalled') + '\n\n' + t('setup.copilotBenefits'),
      t('setup.copilotTitle')
    ));

    const shouldInstall = await promptConfirm(
      t('setup.copilotInstallQuestion'),
      true
    );

    if (!shouldInstall) {
      // User declined - continue without Copilot
      logger.raw(theme.textMuted(t('setup.copilotSkipped')));
      return;
    }

    // User wants to install - proceed with installation
    logger.raw('');
    const spinner = createSpinner({ text: t('setup.copilotInstalling') });
    spinner.start();

    const result = await copilotService.installCopilotCli();

    if (result.success) {
      spinner.succeed(t('setup.copilotInstallSuccess'));
      logger.raw(theme.textMuted(t('setup.copilotInstallNote')));
    } else {
      spinner.fail(t('setup.copilotInstallFailed'));
      logger.raw(warningBox(
        t('setup.copilotInstallFailedDetail') + '\n\n' + t('setup.copilotManualInstall'),
        t('warnings.title')
      ));
    }
  }
}
