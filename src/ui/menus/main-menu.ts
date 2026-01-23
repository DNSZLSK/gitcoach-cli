import { t } from '../../i18n/index.js';
import { getTheme } from '../themes/index.js';
import { banner, infoBox } from '../components/box.js';
import { promptSelect } from '../components/prompt.js';
import { analysisService } from '../../services/analysis-service.js';
import { logger } from '../../utils/logger.js';

export type MainMenuAction =
  | 'status'
  | 'add'
  | 'commit'
  | 'push'
  | 'pull'
  | 'branch'
  | 'undo'
  | 'history'
  | 'stash'
  | 'config'
  | 'stats'
  | 'help'
  | 'quit';

export async function showMainMenu(): Promise<MainMenuAction> {
  const theme = getTheme();

  // Show ASCII art banner
  logger.raw(banner('1.0.0', t('app.tagline')));

  // Show quick status if available
  try {
    const quickStatus = await analysisService.getQuickStatus();
    logger.raw(theme.textMuted(`  ${quickStatus}\n`));
  } catch {
    // Ignore status errors
  }

  const choices = [
    {
      name: theme.menuItem('S', `${t('menu.status')} - ${t('menu.statusDesc')}`),
      value: 'status' as MainMenuAction
    },
    {
      name: theme.menuItem('A', `${t('menu.add')} - ${t('menu.addDesc')}`),
      value: 'add' as MainMenuAction
    },
    {
      name: theme.menuItem('C', `${t('menu.commit')} - ${t('menu.commitDesc')}`),
      value: 'commit' as MainMenuAction
    },
    {
      name: theme.menuItem('P', `${t('menu.push')} - ${t('menu.pushDesc')}`),
      value: 'push' as MainMenuAction
    },
    {
      name: theme.menuItem('L', `${t('menu.pull')} - ${t('menu.pullDesc')}`),
      value: 'pull' as MainMenuAction
    },
    {
      name: theme.menuItem('B', `${t('menu.branch')} - ${t('menu.branchDesc')}`),
      value: 'branch' as MainMenuAction
    },
    {
      name: theme.menuItem('U', `${t('menu.undo')} - ${t('menu.undoDesc')}`),
      value: 'undo' as MainMenuAction
    },
    {
      name: theme.menuItem('H', `${t('menu.history')} - ${t('menu.historyDesc')}`),
      value: 'history' as MainMenuAction
    },
    {
      name: theme.menuItem('W', `${t('menu.stash')} - ${t('menu.stashDesc')}`),
      value: 'stash' as MainMenuAction
    },
    {
      name: theme.menuItem('G', `${t('menu.config')} - ${t('menu.configDesc')}`),
      value: 'config' as MainMenuAction
    },
    {
      name: theme.menuItem('T', `${t('menu.stats')} - ${t('menu.statsDesc')}`),
      value: 'stats' as MainMenuAction
    },
    {
      name: theme.menuItem('?', `${t('menu.help')} - ${t('menu.helpDesc')}`),
      value: 'help' as MainMenuAction
    },
    {
      name: theme.menuItem('Q', `${t('menu.quit')} - ${t('menu.quitDesc')}`),
      value: 'quit' as MainMenuAction
    }
  ];

  return promptSelect(t('menu.title'), choices);
}

export async function showStatusScreen(): Promise<void> {
  const theme = getTheme();

  try {
    logger.command('git status');
    const analysis = await analysisService.analyzeWorkingState();
    const { status } = analysis;

    logger.raw('\n' + theme.title(t('commands.status.title')) + '\n');
    logger.raw(theme.branch(t('commands.status.branch', { branch: status.current || 'unknown' })) + '\n');

    if (status.isClean) {
      logger.raw(theme.success(t('commands.status.clean')) + '\n');
    } else {
      if (status.staged.length > 0) {
        logger.raw('\n' + theme.success(t('commands.status.staged')));
        status.staged.forEach(file => {
          logger.raw(theme.file(file, 'staged'));
        });
      }

      if (status.modified.length > 0) {
        logger.raw('\n' + theme.warning(t('commands.status.unstaged')));
        status.modified.forEach(file => {
          logger.raw(theme.file(file, 'modified'));
        });
      }

      if (status.deleted.length > 0) {
        status.deleted.forEach(file => {
          logger.raw(theme.file(file, 'deleted'));
        });
      }

      if (status.untracked.length > 0) {
        logger.raw('\n' + theme.info(t('commands.status.untracked')));
        status.untracked.forEach(file => {
          logger.raw(theme.file(file, 'untracked'));
        });
      }
    }

    // Show ahead/behind info
    if (status.ahead > 0) {
      logger.raw('\n' + theme.info(t('commands.status.ahead', {
        remote: status.tracking || 'origin',
        count: status.ahead
      })));
    }

    if (status.behind > 0) {
      logger.raw('\n' + theme.warning(t('commands.status.behind', {
        remote: status.tracking || 'origin',
        count: status.behind
      })));
    }

    // Show tip if available
    if (analysis.tip) {
      logger.raw('\n' + infoBox(analysis.tip, 'Tip'));
    }

    logger.raw('');
  } catch (error) {
    logger.error(t('errors.generic', { message: error instanceof Error ? error.message : 'Unknown error' }));
  }
}
