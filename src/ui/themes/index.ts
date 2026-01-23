import { userConfig } from '../../config/user-config.js';
import { coloredTheme } from './colored.js';
import { monochromeTheme } from './monochrome.js';

export interface ThemeFunctions {
  primary: (text: string) => string;
  secondary: (text: string) => string;
  accent: (text: string) => string;
  success: (text: string) => string;
  warning: (text: string) => string;
  error: (text: string) => string;
  info: (text: string) => string;
  text: (text: string) => string;
  textMuted: (text: string) => string;
  textBold: (text: string) => string;
  staged: (text: string) => string;
  modified: (text: string) => string;
  deleted: (text: string) => string;
  untracked: (text: string) => string;
  branch: (text: string) => string;
  border: (text: string) => string;
  highlight: (text: string) => string;
  selected: (text: string) => string;
  bold: (text: string) => string;
  dim: (text: string) => string;
  italic: (text: string) => string;
  underline: (text: string) => string;
  title: (text: string) => string;
  subtitle: (text: string) => string;
  menuItem: (key: string, label: string) => string;
  statusBadge: (type: 'success' | 'warning' | 'error' | 'info', text: string) => string;
  file: (name: string, status: 'staged' | 'modified' | 'deleted' | 'untracked') => string;
  commitHash: (hash: string) => string;
  branchName: (name: string, current?: boolean) => string;
  keyHint: (key: string) => string;
  progressBar: (percent: number, width?: number) => string;
}

export type Theme = ThemeFunctions;

export function getTheme(): Theme {
  const themeName = userConfig.getTheme();
  return themeName === 'colored' ? coloredTheme : monochromeTheme;
}

export { coloredTheme, monochromeTheme };
