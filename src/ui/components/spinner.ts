import ora, { Ora } from 'ora';
import { userConfig } from '../../config/user-config.js';

export interface SpinnerOptions {
  text?: string;
  color?: 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white';
}

export function createSpinner(options: SpinnerOptions = {}): Ora {
  const isMonochrome = userConfig.getTheme() === 'monochrome';

  return ora({
    text: options.text || 'Loading...',
    color: isMonochrome ? 'white' : (options.color || 'cyan'),
    spinner: isMonochrome ? 'line' : 'dots'
  });
}

export async function withSpinner<T>(
  text: string,
  fn: () => Promise<T>,
  successText?: string,
  failText?: string
): Promise<T> {
  const spinner = createSpinner({ text });
  spinner.start();

  try {
    const result = await fn();
    spinner.succeed(successText || text);
    return result;
  } catch (error) {
    spinner.fail(failText || `Failed: ${text}`);
    throw error;
  }
}
