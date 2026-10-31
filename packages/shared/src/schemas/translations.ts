import { z } from 'zod';
import { SUPPORTED_LANGUAGES } from '../enums';

export type { SupportedLanguage } from '../enums';

const iso6391Regex = /^[a-z]{2}$/;

export const TranslationEntrySchema = z.object({
  lang: z
    .string({ error: (issue) => (issue.input === undefined ? 'ERR_LANG_REQUIRED' : undefined) })
    .regex(iso6391Regex, 'ERR_LANG_FORMAT')
    .refine((val) => (SUPPORTED_LANGUAGES as readonly string[]).includes(val), {
      message: 'ERR_LANG_UNSUPPORTED',
    }),
  key: z
    .string({ error: (issue) => (issue.input === undefined ? 'ERR_KEY_REQUIRED' : undefined) })
    .min(1, 'ERR_KEY_REQUIRED'),
  value: z.string({
    error: (issue) => (issue.input === undefined ? 'ERR_VALUE_REQUIRED' : undefined),
  }),
});

export type TranslationEntry = z.infer<typeof TranslationEntrySchema>;

export const TranslationBulkPayloadSchema = z
  .array(TranslationEntrySchema)
  .min(1, 'ERR_BULK_MIN')
  .max(500, 'ERR_BULK_MAX');

export type TranslationBulkPayload = z.infer<typeof TranslationBulkPayloadSchema>;

export const TranslationsMapSchema = z.record(z.string(), z.string());

export type TranslationsMap = z.infer<typeof TranslationsMapSchema>;
