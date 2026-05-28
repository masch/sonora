import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { en } from './locales/en';
import { es } from './locales/es';

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
i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, es: { translation: es } },
  lng: detectLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
