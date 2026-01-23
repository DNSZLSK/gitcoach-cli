// Monochrome theme - no colors, plain text output
const noOp = (text: string) => text;

export const monochromeTheme = {
  // Brand colors (no-op)
  primary: noOp,
  secondary: noOp,
  accent: noOp,

  // Status colors (no-op)
  success: noOp,
  warning: noOp,
  error: noOp,
  info: noOp,

  // Text colors (no-op)
  text: noOp,
  textMuted: noOp,
  textBold: noOp,

  // Git status colors (no-op)
  staged: noOp,
  modified: noOp,
  deleted: noOp,
  untracked: noOp,
  branch: noOp,

  // UI elements (no-op)
  border: noOp,
  highlight: noOp,
  selected: noOp,

  // Formatting helpers (no-op)
  bold: noOp,
  dim: noOp,
  italic: noOp,
  underline: noOp,

  // Semantic styling
  title(text: string): string {
    return `=== ${text.toUpperCase()} ===`;
  },

  subtitle(text: string): string {
    return `--- ${text} ---`;
  },

  menuItem(key: string, label: string): string {
    return `[${key}] ${label}`;
  },

  statusBadge(type: 'success' | 'warning' | 'error' | 'info', text: string): string {
    const labels = {
      success: '[OK]',
      warning: '[WARN]',
      error: '[ERROR]',
      info: '[INFO]'
    };
    return `${labels[type]} ${text}`;
  },

  file(name: string, status: 'staged' | 'modified' | 'deleted' | 'untracked'): string {
    const prefixes = {
      staged: '[+]',
      modified: '[~]',
      deleted: '[-]',
      untracked: '[?]'
    };
    return `${prefixes[status]} ${name}`;
  },

  commitHash(hash: string): string {
    return hash.substring(0, 7);
  },

  branchName(name: string, current: boolean = false): string {
    if (current) {
      return `* ${name}`;
    }
    return `  ${name}`;
  },

  keyHint(key: string): string {
    return `[${key}]`;
  },

  progressBar(percent: number, width: number = 20): string {
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    const bar = '#'.repeat(filled) + '-'.repeat(empty);
    return `[${bar}] ${percent}%`;
  }
};

export default monochromeTheme;
