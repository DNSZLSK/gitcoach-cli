import i18next from 'i18next';
import { createRequire } from 'module';
import { userConfig } from '../config/user-config.js';
import type { Language } from '../config/defaults.js';

const require = createRequire(import.meta.url);

const en = require('./locales/en.json');
const fr = require('./locales/fr.json');
const es = require('./locales/es.json');

const resources = {
  en: { translation: en },
  fr: { translation: fr },
  es: { translation: es }
};

let isInitialized = false;

export async function initI18n(): Promise<void> {
  if (isInitialized) {
    return;
  }

  const language = userConfig.getLanguage();

  await i18next.init({
    lng: language,
    fallbackLng: 'en',
    resources,
    interpolation: {
      escapeValue: false
    },
    returnNull: false,
    returnEmptyString: false
  });

  isInitialized = true;
}

export function t(key: string, options?: Record<string, unknown>): string {
  if (!isInitialized) {
    return key;
  }
  return i18next.t(key, options) as string;
}

export function changeLanguage(language: Language): void {
  i18next.changeLanguage(language);
  userConfig.setLanguage(language);
}

export function getCurrentLanguage(): Language {
  return i18next.language as Language;
}

export { i18next };
