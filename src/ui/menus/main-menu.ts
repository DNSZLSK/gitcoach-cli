import { t } from '../../i18n/index.js';
import { getTheme } from '../themes/index.js';
import { banner, infoBox } from '../components/box.js';
import { promptSelect } from '../components/prompt.js';
import { analysisService } from '../../services/analysis-service.js';
import { gitService } from '../../services/git-service.js';
import { logger } from '../../utils/logger.js';
import { APP_VERSION } from '../../utils/version.js';
import { showDetachedHeadMenu, handleDetachedHead } from './detached-head-menu.js';
import { getLevel } from '../../utils/level-helper.js';

/**
 * Get menu label based on user experience level
 * - Beginner: Full description
 * - Intermediate: Short description
 * - Expert: Git command
 */
function getMenuLabel(key: string): string {
  const level = getLevel();
  const levelKey = `menu.${key}${level.charAt(0).toUpperCase() + level.slice(1)}`;
  return t(levelKey);
}

export type MainMenuAction =
  | 'status'
  | 'add'
  | 'commit'
  | 'push'
  | 'pull'
  | 'branch'
  | 'remote'
  | 'undo'
  | 'history'
  | 'stash'
  | 'config'
  | 'stats'
  | 'help'
  | 'quit';

export async function showMainMenu(): Promise<MainMenuAction> {
  const theme = getTheme();

  // Check for detached HEAD state
  try {
    const isDetached = await gitService.isDetachedHead();
    if (isDetached) {
      const action = await showDetachedHeadMenu();
      if (action !== 'ignore') {
        await handleDetachedHead(action);
      }
    }
  } catch {
    // Ignore errors checking detached state
  }

  // Show ASCII art banner
  logger.raw(banner(APP_VERSION, t('app.tagline')));

  // Show quick status if available
  try {
    const quickStatus = await analysisService.getQuickStatus();
    logger.raw(theme.textMuted(`  ${quickStatus}\n`));
  } catch {
    // Ignore status errors
  }

  const choices = [
    {
      name: theme.menuItem('S', getMenuLabel('status')),
      value: 'status' as MainMenuAction
    },
    {
      name: theme.menuItem('A', getMenuLabel('add')),
      value: 'add' as MainMenuAction
    },
    {
      name: theme.menuItem('C', getMenuLabel('commit')),
      value: 'commit' as MainMenuAction
    },
    {
      name: theme.menuItem('P', getMenuLabel('push')),
      value: 'push' as MainMenuAction
    },
    {
      name: theme.menuItem('L', getMenuLabel('pull')),
      value: 'pull' as MainMenuAction
    },
    {
      name: theme.menuItem('B', getMenuLabel('branch')),
      value: 'branch' as MainMenuAction
    },
    {
      name: theme.menuItem('R', getMenuLabel('remote')),
      value: 'remote' as MainMenuAction
    },
    {
      name: theme.menuItem('U', getMenuLabel('undo')),
      value: 'undo' as MainMenuAction
    },
    {
      name: theme.menuItem('H', getMenuLabel('history')),
      value: 'history' as MainMenuAction
    },
    {
      name: theme.menuItem('W', getMenuLabel('stash')),
      value: 'stash' as MainMenuAction
    },
    {
      name: theme.menuItem('G', getMenuLabel('config')),
      value: 'config' as MainMenuAction
    },
    {
      name: theme.menuItem('T', getMenuLabel('stats')),
      value: 'stats' as MainMenuAction
    },
    {
      name: theme.menuItem('?', getMenuLabel('help')),
      value: 'help' as MainMenuAction
    },
    {
      name: theme.menuItem('Q', getMenuLabel('quit')),
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
      logger.raw('\n' + infoBox(analysis.tip, t('tipTitle')));
    }

    logger.raw('');
  } catch (error) {
    logger.error(t('errors.generic', { message: error instanceof Error ? error.message : 'Unknown error' }));
  }
}
