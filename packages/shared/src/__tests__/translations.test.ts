import { describe, expect, it } from 'vitest';
import { SUPPORTED_LANGUAGES } from '../enums';
import {
  TranslationBulkPayloadSchema,
  TranslationEntrySchema,
  TranslationsMapSchema,
  type SupportedLanguage,
  type TranslationBulkPayload,
  type TranslationEntry,
  type TranslationsMap,
} from '../schemas/translations';

describe('TranslationEntrySchema', () => {
  const validEntry: TranslationEntry = {
    lang: 'es',
    key: 'explore.title',
    value: 'Explorar',
  };

  describe('valid inputs', () => {
    it('accepts a valid translation entry', () => {
      const result = TranslationEntrySchema.safeParse(validEntry);
      expect(result.success).toBe(true);
    });

    it('preserves all fields on parse', () => {
      const result = TranslationEntrySchema.parse(validEntry);
      expect(result).toEqual(validEntry);
    });

    it('accepts all supported languages', () => {
      for (const lang of SUPPORTED_LANGUAGES) {
        const result = TranslationEntrySchema.safeParse({ ...validEntry, lang });
        if (!result.success) {
          throw new Error(`Expected lang "${lang}" to be valid: ${result.error?.message}`);
        }
      }
    });
  });

  describe('lang validation', () => {
    it('rejects three-letter lang code', () => {
      const result = TranslationEntrySchema.safeParse({ ...validEntry, lang: 'eng' });
      expect(result.success).toBe(false);
    });

    it('rejects unsupported language codes (fr, de)', () => {
      for (const lang of ['fr', 'de', 'pt', 'jp']) {
        const result = TranslationEntrySchema.safeParse({ ...validEntry, lang });
        expect(result.success).toBe(false);
      }
    });

    it('rejects empty lang string', () => {
      const result = TranslationEntrySchema.safeParse({ ...validEntry, lang: '' });
      expect(result.success).toBe(false);
    });

    it('rejects missing lang', () => {
      const { lang, ...rest } = validEntry;
      const result = TranslationEntrySchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects non-string lang', () => {
      const result = TranslationEntrySchema.safeParse({ ...validEntry, lang: 123 });
      expect(result.success).toBe(false);
    });
  });

  describe('key validation', () => {
    it('rejects empty key', () => {
      const result = TranslationEntrySchema.safeParse({ ...validEntry, key: '' });
      expect(result.success).toBe(false);
    });

    it('rejects missing key', () => {
      const { key, ...rest } = validEntry;
      const result = TranslationEntrySchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('accepts dot-notation keys like screen.element.descriptor', () => {
      const result = TranslationEntrySchema.safeParse({
        ...validEntry,
        key: 'settings.notifications.title',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('value validation', () => {
    it('rejects empty value', () => {
      const result = TranslationEntrySchema.safeParse({ ...validEntry, value: '' });
      expect(result.success).toBe(false);
    });

    it('rejects missing value', () => {
      const { value, ...rest } = validEntry;
      const result = TranslationEntrySchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects non-string value', () => {
      const result = TranslationEntrySchema.safeParse({ ...validEntry, value: 42 });
      expect(result.success).toBe(false);
    });
  });
});

describe('TranslationBulkPayloadSchema', () => {
  const singleEntry: TranslationEntry = {
    lang: 'en',
    key: 'explore.title',
    value: 'Explore',
  };

  describe('valid inputs', () => {
    it('accepts a single valid entry', () => {
      const result = TranslationBulkPayloadSchema.safeParse([singleEntry]);
      expect(result.success).toBe(true);
    });

    it('accepts up to 500 entries', () => {
      const entries: TranslationEntry[] = Array.from({ length: 500 }, (_, i) => ({
        lang: 'en',
        key: `key.${i}`,
        value: `value ${i}`,
      }));
      const result = TranslationBulkPayloadSchema.safeParse(entries);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    it('rejects empty array', () => {
      const result = TranslationBulkPayloadSchema.safeParse([]);
      expect(result.success).toBe(false);
    });

    it('rejects array with 501 entries (over max)', () => {
      const entries: TranslationEntry[] = Array.from({ length: 501 }, (_, i) => ({
        lang: 'en',
        key: `key.${i}`,
        value: `value ${i}`,
      }));
      const result = TranslationBulkPayloadSchema.safeParse(entries);
      expect(result.success).toBe(false);
    });

    it('rejects array with invalid entry', () => {
      const result = TranslationBulkPayloadSchema.safeParse([{ lang: 'en', key: '', value: 'X' }]);
      expect(result.success).toBe(false);
    });

    it('rejects non-array input', () => {
      const result = TranslationBulkPayloadSchema.safeParse({
        lang: 'en',
        key: 'foo',
        value: 'bar',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('TranslationsMapSchema', () => {
  describe('valid inputs', () => {
    it('accepts a valid translations map', () => {
      const result = TranslationsMapSchema.safeParse({
        'explore.title': 'Explore',
        'settings.label': 'Settings',
      });
      expect(result.success).toBe(true);
    });

    it('accepts an empty record', () => {
      const result = TranslationsMapSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    it('rejects non-string values', () => {
      const result = TranslationsMapSchema.safeParse({ 'explore.title': 42 });
      expect(result.success).toBe(false);
    });
  });
});

describe('TypeScript types', () => {
  it('TranslationEntry is assignable from valid shape', () => {
    const entry: TranslationEntry = { lang: 'en', key: 'foo.bar', value: 'baz' };
    expect(entry.lang).toBe('en');
  });

  it('SupportedLanguage is a union of en | es', () => {
    const en: SupportedLanguage = 'en';
    const es: SupportedLanguage = 'es';
    expect(en).toBe('en');
    expect(es).toBe('es');
  });

  it('SUPPORTED_LANGUAGES array contains only en and es', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['en', 'es']);
  });

  it('TranslationBulkPayload is an array of entries', () => {
    const payload: TranslationBulkPayload = [{ lang: 'en', key: 'foo.bar', value: 'baz' }];
    expect(payload).toHaveLength(1);
  });

  it('TranslationsMap is a Record<string, string>', () => {
    const map: TranslationsMap = { 'foo.bar': 'baz' };
    expect(map['foo.bar']).toBe('baz');
  });
});
