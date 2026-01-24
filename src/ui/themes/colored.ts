import chalk from 'chalk';

export const coloredTheme = {
  // Brand colors
  primary: chalk.cyan,
  secondary: chalk.magenta,
  accent: chalk.yellow,

  // Status colors
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  info: chalk.blue,

  // Text colors
  text: chalk.white,
  textMuted: chalk.gray,
  textBold: chalk.bold.white,

  // Git status colors
  staged: chalk.green,
  modified: chalk.yellow,
  deleted: chalk.red,
  untracked: chalk.cyan,
  branch: chalk.magenta,

  // UI elements
  border: chalk.gray,
  highlight: chalk.bgCyan.black,
  selected: chalk.bgWhite.black,

  // Formatting helpers
  bold: chalk.bold,
  dim: chalk.dim,
  italic: chalk.italic,
  underline: chalk.underline,

  // Semantic styling
  title(text: string): string {
    return chalk.bold.cyan(text);
  },

  subtitle(text: string): string {
    return chalk.dim.white(text);
  },

  menuItem(key: string, label: string): string {
    return `${chalk.cyan(`[${key}]`)} ${label}`;
  },

  statusBadge(type: 'success' | 'warning' | 'error' | 'info', text: string): string {
    const colors = {
      success: chalk.bgGreen.black,
      warning: chalk.bgYellow.black,
      error: chalk.bgRed.white,
      info: chalk.bgBlue.white
    };
    return colors[type](` ${text} `);
  },

  file(name: string, status: 'staged' | 'modified' | 'deleted' | 'untracked' | 'conflict'): string {
    const statusColors = {
      staged: chalk.green,
      modified: chalk.yellow,
      deleted: chalk.red,
      untracked: chalk.cyan,
      conflict: chalk.red.bold
    };
    const prefixes = {
      staged: '+',
      modified: '~',
      deleted: '-',
      untracked: '?',
      conflict: '!'
    };
    return `${statusColors[status](prefixes[status])} ${name}`;
  },

  commitHash(hash: string): string {
    return chalk.yellow(hash.substring(0, 7));
  },

  branchName(name: string, current: boolean = false): string {
    if (current) {
      return chalk.green.bold(`* ${name}`);
    }
    return chalk.white(`  ${name}`);
  },

  keyHint(key: string): string {
    return chalk.dim(`[${key}]`);
  },

  progressBar(percent: number, width: number = 20): string {
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    return `${bar} ${percent}%`;
  }
};

export default coloredTheme;
