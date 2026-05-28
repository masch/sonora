import { useTranslation } from 'react-i18next';
import type { TranslationKeys } from './types';

/** Typed `t()` wrapper. Gives autocomplete on valid translation keys. */
export function useAppTranslation() {
  const { t } = useTranslation();
  return { t: (key: TranslationKeys): string => t(key) };
}
