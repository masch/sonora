import type { en } from './locales/en';

/** Recursively extracts dot-separated key paths from a nested object type. */
export type RecursiveKeyOf<TObj extends Record<string, unknown>> = {
  [TKey in keyof TObj & string]: TObj[TKey] extends Record<string, unknown>
    ? `${TKey}.${RecursiveKeyOf<TObj[TKey]>}`
    : TKey;
}[keyof TObj & string];

/** Union type of all translation keys — derived from the `en` translations object. */
export type TranslationKeys = RecursiveKeyOf<typeof en>;
