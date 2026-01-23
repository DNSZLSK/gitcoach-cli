import { t } from '../../i18n/index.js';
import { getTheme } from '../themes/index.js';
import { promptSelect, promptInput } from '../components/prompt.js';
import { infoBox, warningBox } from '../components/box.js';
import { createSpinner } from '../components/spinner.js';
import { copilotService } from '../../services/copilot-service.js';
import { logger } from '../../utils/logger.js';

export type HelpAction = 'askQuestion' | 'quickHelp' | 'about' | 'back';

export async function showHelpMenu(): Promise<void> {
  const theme = getTheme();

  let running = true;

  while (running) {
    logger.raw('\n' + theme.title(t('help.title') || 'Help') + '\n');

    const action = await promptSelect<HelpAction>(
      t('help.selectAction') || 'What would you like to do?',
      [
        {
          name: theme.menuItem('A', t('help.askQuestion') || 'Ask a Git question (AI)'),
          value: 'askQuestion'
        },
        {
          name: theme.menuItem('Q', t('help.quickHelp') || 'Quick reference'),
          value: 'quickHelp'
        },
        {
          name: theme.menuItem('I', t('help.about') || 'About GitCoach'),
          value: 'about'
        },
        {
          name: theme.menuItem('B', t('menu.back') || 'Back'),
          value: 'back'
        }
      ]
    );

    switch (action) {
      case 'askQuestion':
        await askGitQuestion();
        break;

      case 'quickHelp':
        showQuickReference();
        break;

      case 'about':
        showAbout();
        break;

      case 'back':
        running = false;
        break;
    }
  }
}

async function askGitQuestion(): Promise<void> {
  const theme = getTheme();

  // Check if Copilot is available
  const copilotAvailable = await copilotService.isAvailable();

  if (!copilotAvailable) {
    logger.raw(warningBox(
      t('help.copilotUnavailable') || 'GitHub Copilot CLI is not available. Install it to ask questions.',
      t('warnings.title') || 'Warning'
    ));
    return;
  }

  logger.raw(theme.textMuted(t('help.askHint') || 'Ask any Git question in natural language. Leave empty to cancel.'));
  logger.raw(theme.textMuted(t('help.askExamples') || 'Examples: "How do I undo my last commit?" or "What is a rebase?"'));
  logger.raw('');

  const question = await promptInput(
    t('help.enterQuestion') || 'Your question:',
    '',
    (value) => {
      // Allow empty for cancel
      if (value.trim().length === 0) return true;
      if (value.trim().length < 5) {
        return t('help.questionTooShort') || 'Please enter a more detailed question';
      }
      return true;
    }
  );

  if (!question || question.trim().length === 0) {
    return;
  }

  const spinner = createSpinner({ text: t('help.thinking') || 'Thinking...' });
  spinner.start();

  try {
    const response = await copilotService.askGitQuestion(question);

    if (response.success && response.message) {
      spinner.succeed();
      logger.raw('\n' + infoBox(response.message, t('help.answer') || 'Answer'));
    } else {
      spinner.warn(t('help.noAnswer') || 'Could not get an answer');
    }
  } catch {
    spinner.warn(t('help.errorAsking') || 'Error getting answer');
  }

  logger.raw('');
}

function showQuickReference(): void {
  const theme = getTheme();

  logger.raw('\n' + theme.title(t('help.quickRefTitle') || 'Quick Reference') + '\n');

  logger.raw(theme.textBold(t('help.navigation') || 'Navigation:'));
  logger.raw('  ' + t('help.navArrows') || '  Use arrow keys to navigate menus');
  logger.raw('  ' + t('help.navEnter') || '  Press Enter to select an option');
  logger.raw('  ' + t('help.navCtrlC') || '  Press Ctrl+C to exit at any time');
  logger.raw('');

  logger.raw(theme.textBold(t('help.mainCommands') || 'Main Commands:'));
  logger.raw('  [S] Status  - ' + (t('menu.statusDesc') || 'View current changes'));
  logger.raw('  [A] Add     - ' + (t('menu.addDesc') || 'Stage files for commit'));
  logger.raw('  [C] Commit  - ' + (t('menu.commitDesc') || 'Save your changes'));
  logger.raw('  [P] Push    - ' + (t('menu.pushDesc') || 'Upload to remote'));
  logger.raw('  [L] Pull    - ' + (t('menu.pullDesc') || 'Download changes'));
  logger.raw('  [B] Branch  - ' + (t('menu.branchDesc') || 'Manage branches'));
  logger.raw('');

  logger.raw(theme.textBold(t('help.additionalCommands') || 'Additional Commands:'));
  logger.raw('  [U] Undo    - ' + (t('menu.undoDesc') || 'Undo actions'));
  logger.raw('  [H] History - ' + (t('menu.historyDesc') || 'View commit history'));
  logger.raw('  [W] Stash   - ' + (t('menu.stashDesc') || 'Save work temporarily'));
  logger.raw('');

  logger.raw(theme.textBold(t('help.tips') || 'Tips:'));
  logger.raw('  - ' + (t('help.tip1') || 'GitCoach warns you before dangerous operations'));
  logger.raw('  - ' + (t('help.tip2') || 'AI can generate commit messages from your changes'));
  logger.raw('  - ' + (t('help.tip3') || 'Change experience level in settings for more/less guidance'));
  logger.raw('');
}

function showAbout(): void {
  const theme = getTheme();

  logger.raw('\n' + theme.title('About GitCoach') + '\n');
  logger.raw(theme.textBold('GitCoach v1.0.2'));
  logger.raw(t('app.tagline') || 'Your AI-Powered Git Coach');
  logger.raw('');
  logger.raw(t('help.aboutDesc') || 'GitCoach is an interactive CLI tool that helps developers master Git');
  logger.raw(t('help.aboutDesc2') || 'through guided menus, intelligent suggestions, and real-time error prevention.');
  logger.raw('');
  logger.raw(theme.textBold(t('help.features') || 'Features:'));
  logger.raw('  - ' + (t('help.feature1') || 'Interactive menus for all Git operations'));
  logger.raw('  - ' + (t('help.feature2') || 'AI-generated commit messages with Copilot CLI'));
  logger.raw('  - ' + (t('help.feature3') || 'Error prevention and warnings'));
  logger.raw('  - ' + (t('help.feature4') || 'Multilingual support (EN, FR, ES)'));
  logger.raw('  - ' + (t('help.feature5') || 'Beginner, Intermediate, and Expert modes'));
  logger.raw('');
  logger.raw(theme.textMuted('Built for the GitHub Copilot CLI Challenge'));
  logger.raw('');
}
