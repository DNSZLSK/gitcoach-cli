import { Command } from '@oclif/core';
import { initI18n, t } from '../i18n/index.js';
import { userConfig } from '../config/user-config.js';
import { gitService } from '../services/git-service.js';
import { logger } from '../utils/logger.js';
import { getTheme } from '../ui/themes/index.js';
import {
  showMainMenu,
  showStatusScreen,
  MainMenuAction
} from '../ui/menus/main-menu.js';
import { showAddMenu } from '../ui/menus/add-menu.js';
import { showCommitMenu } from '../ui/menus/commit-menu.js';
import { showBranchMenu } from '../ui/menus/branch-menu.js';
import { showConfigMenu } from '../ui/menus/config-menu.js';
import { showPushMenu } from '../ui/menus/push-menu.js';
import { showPullMenu } from '../ui/menus/pull-menu.js';
import { showUndoMenu } from '../ui/menus/undo-menu.js';
import { showHistoryMenu } from '../ui/menus/history-menu.js';
import { showStashMenu } from '../ui/menus/stash-menu.js';
import {
  showSetupMenu,
  handleGitInit,
  handleGitClone,
  SetupMenuAction
} from '../ui/menus/setup-menu.js';
import { showHelpMenu } from '../ui/menus/help-menu.js';

export default class Index extends Command {
  static override description = 'GitCoach - Your Interactive Git Assistant';

  static override examples = [
    '<%= config.bin %>',
    '<%= config.bin %> init',
    '<%= config.bin %> config',
    '<%= config.bin %> quick'
  ];

  async run(): Promise<void> {
    // Initialize i18n
    await initI18n();

    // Check if we're in a git repository
    const isRepo = await gitService.isGitRepo();

    if (!isRepo) {
      // Show setup menu for non-git directories
      const setupResult = await this.handleSetupMenu();
      if (!setupResult) {
        // User chose to quit or setup failed
        return;
      }
      // After init, continue to main menu
    }

    // Update last used timestamp
    userConfig.updateLastUsed();

    // Check if first run and needs setup
    if (userConfig.isFirstRun()) {
      // Run init command for first-time setup
      await this.config.runCommand('init');
    }

    // Main menu loop
    let running = true;

    while (running) {
      try {
        const action = await showMainMenu();
        running = await this.handleAction(action);
      } catch (error) {
        // Handle Ctrl+C gracefully
        if (error instanceof Error && error.message.includes('User force closed')) {
          running = false;
        } else {
          logger.error(t('errors.generic', {
            message: error instanceof Error ? error.message : 'Unknown error'
          }));
        }
      }
    }

    // Goodbye message
    const theme = getTheme();
    logger.raw('\n' + theme.textMuted(t('app.goodbye')) + '\n');
  }

  private async handleSetupMenu(): Promise<boolean> {
    const theme = getTheme();

    let running = true;
    while (running) {
      try {
        const action: SetupMenuAction = await showSetupMenu();

        switch (action) {
          case 'init': {
            const initSuccess = await handleGitInit();
            if (initSuccess) {
              // Repo created, can continue to main menu
              return true;
            }
            // Stay in setup menu
            break;
          }

          case 'clone':
            await handleGitClone();
            // After clone, user needs to cd into directory, so exit
            return false;

          case 'quit':
            logger.raw('\n' + theme.textMuted(t('app.goodbye')) + '\n');
            return false;
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('User force closed')) {
          running = false;
        } else {
          logger.error(t('errors.generic', {
            message: error instanceof Error ? error.message : 'Unknown error'
          }));
        }
      }
    }

    return false;
  }

  private async handleAction(action: MainMenuAction): Promise<boolean> {
    switch (action) {
      case 'status':
        await showStatusScreen();
        return true;

      case 'add':
        await showAddMenu();
        return true;

      case 'commit':
        await showCommitMenu();
        return true;

      case 'push':
        await showPushMenu();
        return true;

      case 'pull':
        await showPullMenu();
        return true;

      case 'branch':
        await showBranchMenu();
        return true;

      case 'undo':
        await showUndoMenu();
        return true;

      case 'history':
        await showHistoryMenu();
        return true;

      case 'stash':
        await showStashMenu();
        return true;

      case 'config':
        await showConfigMenu();
        return true;

      case 'stats':
        await this.config.runCommand('stats');
        return true;

      case 'help':
        await showHelpMenu();
        return true;

      case 'quit':
        return false;

      default:
        return true;
    }
  }

}
