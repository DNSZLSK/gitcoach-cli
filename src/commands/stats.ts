import { Command } from '@oclif/core';
import { initI18n, t } from '../i18n/index.js';
import { userConfig } from '../config/user-config.js';
import { analysisService } from '../services/analysis-service.js';
import { logger } from '../utils/logger.js';
import { getTheme } from '../ui/themes/index.js';
import { titleBox, infoBox } from '../ui/components/box.js';
import { statsTable } from '../ui/components/table.js';

export default class Stats extends Command {
  static override description = 'View your GitSense statistics';

  static override examples = ['<%= config.bin %> stats'];

  async run(): Promise<void> {
    await initI18n();

    const theme = getTheme();

    logger.raw('\n' + titleBox(t('stats.title'), 'Your GitSense Journey'));

    const totalCommits = userConfig.getTotalCommits();
    const errorsPrevented = userConfig.getErrorsPreventedCount();
    const aiCommits = userConfig.getAiCommitsGenerated();
    const timeSaved = analysisService.calculateEstimatedTimeSaved();

    if (totalCommits === 0 && errorsPrevented === 0 && aiCommits === 0) {
      logger.raw('\n' + infoBox(t('stats.noData')));
      return;
    }

    const stats = [
      { label: t('stats.totalCommits'), value: totalCommits },
      { label: t('stats.errorsPrevented'), value: errorsPrevented },
      { label: t('stats.aiCommits'), value: aiCommits },
      { label: t('stats.timeSaved'), value: timeSaved }
    ];

    logger.raw('\n' + statsTable(stats));

    // Show some insights
    if (totalCommits > 0) {
      const aiPercentage = Math.round((aiCommits / totalCommits) * 100);
      logger.raw('\n' + theme.textMuted(t('stats.aiPercentage', { percentage: aiPercentage })));
    }

    if (errorsPrevented > 0) {
      logger.raw(theme.success(t('stats.mistakesAvoided', { count: errorsPrevented })));
    }

    logger.raw('');
  }
}
