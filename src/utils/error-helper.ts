import { t } from '../i18n/index.js';
import { warningBox, infoBox } from '../ui/components/box.js';
import { promptConfirm } from '../ui/components/prompt.js';
import { createSpinner } from '../ui/components/spinner.js';
import { copilotService } from '../services/copilot-service.js';
import { logger } from './logger.js';

/**
 * Handle a Git error with optional AI explanation
 * Shows the error and offers to explain it using Copilot CLI
 */
export async function handleGitError(
  error: Error | string,
  command?: string,
  autoExplain: boolean = false
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : error;

  // Display the error
  logger.raw(warningBox(errorMessage, t('errors.title') || 'Error'));

  // Check if Copilot is available
  const copilotAvailable = await copilotService.isAvailable();

  if (!copilotAvailable) {
    return;
  }

  // Either auto-explain or ask the user
  let shouldExplain = autoExplain;

  if (!autoExplain) {
    shouldExplain = await promptConfirm(
      t('errors.explainWithAI') || 'Would you like an AI explanation of this error?',
      true
    );
  }

  if (shouldExplain) {
    const spinner = createSpinner({ text: t('errors.analyzing') || 'Analyzing error...' });
    spinner.start();

    try {
      const explanation = await copilotService.explainGitError(errorMessage, command ? { command } : undefined);

      if (explanation.success && explanation.message) {
        spinner.succeed();
        logger.raw('\n' + infoBox(
          explanation.message,
          t('errors.explanation') || 'Explanation'
        ));
      } else {
        spinner.warn(t('errors.noExplanation') || 'Could not explain the error');
      }
    } catch {
      spinner.warn(t('errors.explainFailed') || 'Failed to get explanation');
    }
  }
}

/**
 * Format a Git error message for display
 */
export function formatGitError(error: Error | string): string {
  const message = error instanceof Error ? error.message : error;

  // Clean up common Git error prefixes
  return message
    .replace(/^error:\s*/i, '')
    .replace(/^fatal:\s*/i, '')
    .replace(/^warning:\s*/i, '')
    .trim();
}
