import { useCallback } from 'react';

import { resolveLanguage, type TranslateKey } from '@sonora/shared';
import { useTranslation } from 'react-i18next';
import type { TranslationKeys } from '@/i18n/types';

/** Typed `t()` signature returned by `useAppTranslation`. */
export type AppTFunction = (key: TranslationKeys, options?: Record<string, unknown>) => string;

export { resolveLanguage };
export type { TranslationKeys };

/**
 * Typed `t()` wrapper. Gives autocomplete on valid translation keys.
 *
 * It also hands over `translateKey`, the same function with the wide signature the
 * shared map layer takes. That layer cannot know this app's key union — a key arrives
 * as a `string` from a document, a seed or the remote config — so the two signatures
 * only meet through one widening cast. Owning it here means it is written once instead
 * of re-derived at every call site, and that its identity is stable per language, which
 * is what the map's memoized derivations need: a new adapter per render would rebuild
 * the style on every render.
 */
export function useAppTranslation() {
  const { t, i18n } = useTranslation();
  const language = resolveLanguage(i18n?.language);

  const translateKey = useCallback<TranslateKey>(
    (key, options) => t(key as TranslationKeys, options),
    // `t` is taken from the newest render on purpose: the language is the input, and a
    // re-render hands over a new wrapper with the same text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language],
  );

  return {
    t: (key: TranslationKeys, options?: Record<string, unknown>): string => t(key, options),
    translateKey,
    i18n,
    language,
  };
}
