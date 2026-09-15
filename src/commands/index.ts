import { Command } from '@oclif/core';
import { initI18n, t } from '../i18n/index.js';
import { userConfig } from '../config/user-config.js';
import { gitService } from '../services/git-service.js';
import { logger } from '../utils/logger.js';
import { mapGitError } from '../utils/error-mapper.js';
import { isInteractive } from '../utils/helpers.js';
import { getTheme } from '../ui/themes/index.js';
import {
  showMainMenu,
  showStatusScreen,
  MainMenuAction
} from '../ui/menus/main-menu.js';
import type { SetupMenuAction } from '../ui/menus/setup-menu.js';

// Secondary menus are loaded on demand. Importing all thirteen up front cost
// roughly 170ms on every launch, including `--version`, for screens the user
// may never open. The import is cached after first use, and the wait is hidden
// behind the keypress that selects the menu.

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

    // Interactive menus need a TTY; fail clearly instead of hanging in pipes/CI
    if (!isInteractive()) {
      logger.error(t('errors.nonInteractive'));
      process.exitCode = 1;
      return;
    }

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
          logger.error(mapGitError(error));
        }
      }
    }

    // Goodbye message
    const theme = getTheme();
    logger.raw('\n' + theme.textMuted(t('app.goodbye')) + '\n');
  }

  private async handleSetupMenu(): Promise<boolean> {
    const theme = getTheme();

    const { showSetupMenu, handleGitInit, handleGitClone } = await import(
      '../ui/menus/setup-menu.js'
    );

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
          logger.error(mapGitError(error));
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

      case 'add': {
        const { showAddMenu } = await import('../ui/menus/add-menu.js');
        await showAddMenu();
        return true;
      }

      case 'commit': {
        const { showCommitMenu } = await import('../ui/menus/commit-menu.js');
        await showCommitMenu();
        return true;
      }

      case 'push': {
        const { showPushMenu } = await import('../ui/menus/push-menu.js');
        await showPushMenu();
        return true;
      }

      case 'pull': {
        const { showPullMenu } = await import('../ui/menus/pull-menu.js');
        await showPullMenu();
        return true;
      }

      case 'branch': {
        const { showBranchMenu } = await import('../ui/menus/branch-menu.js');
        await showBranchMenu();
        return true;
      }

      case 'remote': {
        const { showRemoteMenu } = await import('../ui/menus/remote-menu.js');
        await showRemoteMenu();
        return true;
      }

      case 'undo': {
        const { showUndoMenu } = await import('../ui/menus/undo-menu.js');
        await showUndoMenu();
        return true;
      }

      case 'history': {
        const { showHistoryMenu } = await import('../ui/menus/history-menu.js');
        await showHistoryMenu();
        return true;
      }

      case 'stash': {
        const { showStashMenu } = await import('../ui/menus/stash-menu.js');
        await showStashMenu();
        return true;
      }

      case 'config': {
        const { showConfigMenu } = await import('../ui/menus/config-menu.js');
        await showConfigMenu();
        return true;
      }

      case 'stats':
        await this.config.runCommand('stats');
        return true;

      case 'help': {
        const { showHelpMenu } = await import('../ui/menus/help-menu.js');
        await showHelpMenu();
        return true;
      }

      case 'quit':
        return false;

      default:
        return true;
    }
  }

}
