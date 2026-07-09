import { use as i18nUse, default as i18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './locales/en';
import { es } from './locales/es';

const resources = {
  en: {
    translation: en,
  },
  es: {
    translation: es,
  },
};

const detectBrowserLanguage = (): string => {
  try {
    // 1. Check URL query param bypass (e.g., ?lng=es or ?lang=es)
    if (typeof window !== 'undefined' && window.location) {
      const params = new URLSearchParams(window.location.search);
      const urlLng = params.get('lng') || params.get('lang');
      if (urlLng === 'es' || urlLng === 'en') {
        return urlLng;
      }
    }

    // 2. Fallback to navigator language
    if (typeof navigator !== 'undefined') {
      const lang = navigator.language || (navigator as { userLanguage?: string }).userLanguage;
      if (lang && lang.startsWith('es')) {
        return 'es';
      }
    }
    return 'en';
  } catch {
    return 'en';
  }
};

i18nUse(initReactI18next).init({
  resources,
  lng: detectBrowserLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18nInstance;
