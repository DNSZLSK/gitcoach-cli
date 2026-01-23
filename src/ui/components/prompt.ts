import {
  select,
  input,
  confirm,
  checkbox,
  editor
} from '@inquirer/prompts';
import { getTheme } from '../themes/index.js';

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

  return input({
    message: theme.primary(message),
    default: defaultValue,
    validate
  });
}

export async function promptConfirm(
  message: string,
  defaultValue: boolean = false
): Promise<boolean> {
  const theme = getTheme();

  return confirm({
    message: theme.primary(message),
    default: defaultValue
  });
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

export async function promptPassword(
  message: string
): Promise<string> {
  const theme = getTheme();

  // Use input with a workaround since @inquirer/prompts doesn't have password
  // The actual password masking would need additional implementation
  return input({
    message: theme.primary(message)
  });
}
