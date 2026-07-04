import { z } from 'zod';

export const SUPPORTED_LANGUAGES = ['en', 'es'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const iso6391Regex = /^[a-z]{2}$/;

export const TranslationEntrySchema = z.object({
  lang: z
    .string({ required_error: 'ERR_LANG_REQUIRED' })
    .regex(iso6391Regex, 'ERR_LANG_FORMAT')
    .refine((val) => (SUPPORTED_LANGUAGES as readonly string[]).includes(val), {
      message: 'ERR_LANG_UNSUPPORTED',
    }),
  key: z.string({ required_error: 'ERR_KEY_REQUIRED' }).min(1, 'ERR_KEY_REQUIRED'),
  value: z.string({ required_error: 'ERR_VALUE_REQUIRED' }).min(1, 'ERR_VALUE_REQUIRED'),
});

export type TranslationEntry = z.infer<typeof TranslationEntrySchema>;

export const TranslationBulkPayloadSchema = z
  .array(TranslationEntrySchema)
  .min(1, 'ERR_BULK_MIN')
  .max(500, 'ERR_BULK_MAX');

export type TranslationBulkPayload = z.infer<typeof TranslationBulkPayloadSchema>;

export const TranslationsMapSchema = z.record(z.string(), z.string());

export type TranslationsMap = z.infer<typeof TranslationsMapSchema>;
