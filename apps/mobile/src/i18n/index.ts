import { getLocales } from 'expo-localization';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import { en, es } from '@sonora/shared';

const detectLanguage = (): string => {
  try {
    const locales = getLocales();
    return locales?.[0]?.languageCode ?? 'en';
  } catch {
    return 'en';
  }
};

// Note: compatibilityJSON is omitted intentionally.
// We have zero plural forms — the Hermes-safe default 'v4' works fine.
const instance = i18next;
instance.use(initReactI18next).init({
  resources: { en: { translation: en }, es: { translation: es } },
  lng: detectLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

/**
 * Convert flat `{ "common.learnMore": "..." }` to nested `{ common: { learnMore: "..." } }`.
 * Supports dot-separated keys (e.g., "common.learnMore", "player.play").
 */
function flattenToNested(entries: Record<string, string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [flatKey, value] of Object.entries(entries)) {
    const parts = flatKey.split('.');
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
  }
  return result;
}

/**
 * Add remote translation overrides into i18next's resource bundles.
 * Each language's flat key-value pairs are converted to nested objects
 * and merged with overwrite (remote values take precedence).
 */
export function addResources(resources: Record<string, Record<string, string>>): void {
  for (const [lang, entries] of Object.entries(resources)) {
    instance.addResourceBundle(lang, 'translation', flattenToNested(entries), true, true);
  }
  // Force react-i18next to notify observers and re-render components with the new translations
  instance.changeLanguage(instance.language);
}

export default i18next;
