import i18next from 'i18next';
import { createRequire } from 'module';
import { userConfig } from '../config/user-config.js';
import type { Language } from '../config/defaults.js';

// Named loadJson rather than `require`: TypeScript reserves `require` in a
// module's top-level scope, so the shadowing binding is a duplicate identifier.
// tsc lets it pass with this project's settings, ts-jest does not, which kept
// every module reaching i18n out of the test run.
const loadJson = createRequire(import.meta.url);

const en = loadJson('./locales/en.json');
const fr = loadJson('./locales/fr.json');
const es = loadJson('./locales/es.json');

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
