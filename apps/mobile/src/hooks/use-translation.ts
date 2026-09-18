import { resolveLanguage } from '@sonora/shared';
import { useTranslation } from 'react-i18next';
import type { TranslationKeys } from '@/i18n/types';

/** Typed `t()` signature returned by `useAppTranslation`. */
export type AppTFunction = (key: TranslationKeys, options?: Record<string, unknown>) => string;

export { resolveLanguage };

/** Typed `t()` wrapper. Gives autocomplete on valid translation keys. */
export function useAppTranslation() {
  const { t, i18n } = useTranslation();
  return {
    t: (key: TranslationKeys, options?: Record<string, unknown>): string => t(key, options),
    i18n,
    language: resolveLanguage(i18n?.language),
  };
}
