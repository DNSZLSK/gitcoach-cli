import {
  select,
  input,
  checkbox,
  editor
} from '@inquirer/prompts';
import { getTheme } from '../themes/index.js';
import { t } from '../../i18n/index.js';

export interface SelectOption<T> {
  name: string;
  value: T;
  description?: string;
  disabled?: boolean | string;
}

export interface CheckboxOption<T> {
  name: string;
  value: T;
  checked?: boolean;
  disabled?: boolean | string;
}

export async function promptSelect<T>(
  message: string,
  choices: SelectOption<T>[]
): Promise<T> {
  const theme = getTheme();

  return select({
    message: theme.primary(message),
    choices: choices.map(c => ({
      name: c.name,
      value: c.value,
      description: c.description,
      disabled: c.disabled
    }))
  });
}

export async function promptInput(
  message: string,
  defaultValue?: string,
  validate?: (value: string) => boolean | string
): Promise<string> {
  const theme = getTheme();

  const result = await input({
    message: theme.primary(message),
    default: defaultValue,
    validate
  });

  // Detect escape sequences (^[ or \x1b) and treat as cancellation
  if (result.includes('\x1b') || result.includes('^[')) {
    return '';
  }

  return result;
}

export async function promptConfirm(
  message: string,
  defaultValue: boolean = false
): Promise<boolean> {
  const theme = getTheme();
  const yesLabel = t('prompts.yes');
  const noLabel = t('prompts.no');
  const yesKey = t('prompts.yesKey');
  const noKey = t('prompts.noKey');

  const result = await select({
    message: `${theme.primary(message)} (${yesKey}/${noKey})`,
    choices: [
      { name: yesLabel, value: true },
      { name: noLabel, value: false }
    ],
    default: defaultValue ? 0 : 1
  });

  return result;
}

export async function promptCheckbox<T>(
  message: string,
  choices: CheckboxOption<T>[]
): Promise<T[]> {
  const theme = getTheme();

  return checkbox({
    message: theme.primary(message),
    choices: choices.map(c => ({
      name: c.name,
      value: c.value,
      checked: c.checked,
      disabled: c.disabled
    }))
  });
}

export async function promptEditor(
  message: string,
  defaultValue?: string
): Promise<string> {
  const theme = getTheme();

  return editor({
    message: theme.primary(message),
    default: defaultValue
  });
}

