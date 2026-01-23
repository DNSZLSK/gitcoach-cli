import chalk from 'chalk';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4
}

let currentLogLevel: LogLevel = LogLevel.INFO;

export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLogLevel;
}

function formatMessage(level: string, message: string): string {
  const timestamp = new Date().toISOString().substring(11, 19);
  return `[${timestamp}] ${level} ${message}`;
}

export const logger = {
  debug(message: string, ...args: unknown[]): void {
    if (currentLogLevel <= LogLevel.DEBUG) {
      const formatted = formatMessage(chalk.gray('DEBUG'), message);
      // eslint-disable-next-line no-console
      console.log(formatted, ...args);
    }
  },

  info(message: string, ...args: unknown[]): void {
    if (currentLogLevel <= LogLevel.INFO) {
      const formatted = formatMessage(chalk.blue('INFO'), message);
      // eslint-disable-next-line no-console
      console.log(formatted, ...args);
    }
  },

  success(message: string, ...args: unknown[]): void {
    if (currentLogLevel <= LogLevel.INFO) {
      const formatted = formatMessage(chalk.green('SUCCESS'), message);
      // eslint-disable-next-line no-console
      console.log(formatted, ...args);
    }
  },

  warn(message: string, ...args: unknown[]): void {
    if (currentLogLevel <= LogLevel.WARN) {
      const formatted = formatMessage(chalk.yellow('WARN'), message);
      // eslint-disable-next-line no-console
      console.warn(formatted, ...args);
    }
  },

  error(message: string, ...args: unknown[]): void {
    if (currentLogLevel <= LogLevel.ERROR) {
      const formatted = formatMessage(chalk.red('ERROR'), message);
      // eslint-disable-next-line no-console
      console.error(formatted, ...args);
    }
  },

  raw(message: string): void {
    // eslint-disable-next-line no-console
    console.log(message);
  },

  /**
   * Display a Git command for educational purposes
   * Shows the command in dim gray with a > prefix
   */
  command(cmd: string): void {
    // eslint-disable-next-line no-console
    console.log(chalk.dim(`  > ${cmd}`));
  }
};

export default logger;
