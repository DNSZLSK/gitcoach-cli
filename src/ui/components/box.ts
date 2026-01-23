import boxen, { Options as BoxenOptions } from 'boxen';
import chalk from 'chalk';
import { getTheme } from '../themes/index.js';
import { userConfig } from '../../config/user-config.js';

const ASCII_BANNER = `
    ██████╗ ██╗████████╗ ██████╗ ██████╗  █████╗  ██████╗██╗  ██╗
   ██╔════╝ ██║╚══██╔══╝██╔════╝██╔═══██╗██╔══██╗██╔════╝██║  ██║
   ██║  ███╗██║   ██║   ██║     ██║   ██║███████║██║     ███████║
   ██║   ██║██║   ██║   ██║     ██║   ██║██╔══██║██║     ██╔══██║
   ╚██████╔╝██║   ██║   ╚██████╗╚██████╔╝██║  ██║╚██████╗██║  ██║
    ╚═════╝ ╚═╝   ╚═╝    ╚═════╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝
`;

export interface BoxOptions {
  title?: string;
  padding?: number;
  margin?: number;
  borderStyle?: 'single' | 'double' | 'round' | 'bold' | 'classic';
  borderColor?: string;
  textAlignment?: 'left' | 'center' | 'right';
}

export function createBox(content: string, options: BoxOptions = {}): string {
  const isMonochrome = userConfig.getTheme() === 'monochrome';

  const boxenOptions: BoxenOptions = {
    padding: options.padding ?? 1,
    margin: options.margin ?? 0,
    borderStyle: options.borderStyle ?? 'round',
    textAlignment: options.textAlignment ?? 'left'
  };

  if (options.title) {
    (boxenOptions as { title?: string }).title = options.title;
    (boxenOptions as { titleAlignment?: string }).titleAlignment = 'center';
  }

  if (!isMonochrome && options.borderColor) {
    (boxenOptions as { borderColor?: string }).borderColor = options.borderColor;
  }

  return boxen(content, boxenOptions);
}

export function titleBox(title: string, subtitle?: string): string {
  const theme = getTheme();
  let content = theme.title(title);

  if (subtitle) {
    content += '\n' + theme.subtitle(subtitle);
  }

  return createBox(content, {
    padding: 1,
    borderStyle: 'double',
    borderColor: 'cyan',
    textAlignment: 'center'
  });
}

export function infoBox(content: string, title?: string): string {
  return createBox(content, {
    title,
    padding: 1,
    borderStyle: 'round',
    borderColor: 'blue'
  });
}

export function warningBox(content: string, title?: string): string {
  const theme = getTheme();
  return createBox(theme.warning(content), {
    title: title || 'Warning',
    padding: 1,
    borderStyle: 'bold',
    borderColor: 'yellow'
  });
}

export function errorBox(content: string, title?: string): string {
  const theme = getTheme();
  return createBox(theme.error(content), {
    title: title || 'Error',
    padding: 1,
    borderStyle: 'bold',
    borderColor: 'red'
  });
}

export function successBox(content: string, title?: string): string {
  const theme = getTheme();
  return createBox(theme.success(content), {
    title: title || 'Success',
    padding: 1,
    borderStyle: 'round',
    borderColor: 'green'
  });
}

export function banner(version: string, tagline: string): string {
  const isMonochrome = userConfig.getTheme() === 'monochrome';

  let output = '\n';

  if (isMonochrome) {
    output += ASCII_BANNER;
    output += `\n            v${version} - ${tagline}\n`;
  } else {
    // Shadow effect: render shadow first (offset by 1), then main text on top
    const lines = ASCII_BANNER.split('\n').filter(line => line.trim());

    // Create shadow effect by using darker background color behind text
    lines.forEach((line) => {
      // Main text in bright cyan with shadow hint at the end
      output += chalk.cyanBright(line) + chalk.gray('▒') + '\n';
    });

    // Bottom shadow line
    output += chalk.gray('   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▒') + '\n';

    output += '\n' + chalk.bgCyan.black(' ') + chalk.cyan('─────────────────────────────────────────────────────────────') + chalk.bgCyan.black(' ') + '\n';
    output += chalk.bold.white(`            v${version}`) + chalk.gray(' │ ') + chalk.cyanBright(tagline) + '\n';
  }

  return output;
}
