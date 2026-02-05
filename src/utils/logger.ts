import chalk from 'chalk';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4
}

let currentLogLevel: LogLevel = LogLevel.INFO;

type OutputFn = (message: string, ...args: unknown[]) => void;

// eslint-disable-next-line no-console
let stdoutFn: OutputFn = console.log;
// eslint-disable-next-line no-console
let stderrFn: OutputFn = console.error;
// eslint-disable-next-line no-console
let warnFn: OutputFn = console.warn;

export function setOutput(fn: OutputFn): void {
  stdoutFn = fn;
  stderrFn = fn;
  warnFn = fn;
}

export function resetOutput(): void {
  // eslint-disable-next-line no-console
  stdoutFn = console.log;
  // eslint-disable-next-line no-console
  stderrFn = console.error;
  // eslint-disable-next-line no-console
  warnFn = console.warn;
}

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
      stdoutFn(formatted, ...args);
    }
  },

  info(message: string, ...args: unknown[]): void {
    if (currentLogLevel <= LogLevel.INFO) {
      const formatted = formatMessage(chalk.blue('INFO'), message);
      stdoutFn(formatted, ...args);
    }
  },

  success(message: string, ...args: unknown[]): void {
    if (currentLogLevel <= LogLevel.INFO) {
      const formatted = formatMessage(chalk.green('SUCCESS'), message);
      stdoutFn(formatted, ...args);
    }
  },

  warn(message: string, ...args: unknown[]): void {
    if (currentLogLevel <= LogLevel.WARN) {
      const formatted = formatMessage(chalk.yellow('WARN'), message);
      warnFn(formatted, ...args);
    }
  },

  error(message: string, ...args: unknown[]): void {
    if (currentLogLevel <= LogLevel.ERROR) {
      const formatted = formatMessage(chalk.red('ERROR'), message);
      stderrFn(formatted, ...args);
    }
  },

  raw(message: string): void {
    stdoutFn(message);
  },

  /**
   * Display a Git command for educational purposes
   * Shows the command in dim gray with a > prefix
   */
  command(cmd: string): void {
    stdoutFn(chalk.dim(`  > ${cmd}`));
  }
};

export default logger;
