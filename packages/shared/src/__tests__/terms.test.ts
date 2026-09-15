import { describe, expect, it } from 'vitest';
import { AcceptTermsRequestSchema, TermsResponseSchema } from '../schemas/terms';

describe('Terms Schemas', () => {
  describe('TermsResponseSchema', () => {
    it('validates a correct terms response payload', () => {
      const validPayload = {
        version: '2026.09.1',
        lang: 'es',
        title: 'Términos y Condiciones',
        content: '# Términos y Condiciones\n\nBienvenido a Sonora...',
        contentHash: 'a'.repeat(64),
        publishedAt: '2026-09-14T12:00:00.000Z',
      };

      const result = TermsResponseSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe('2026.09.1');
        expect(result.data.lang).toBe('es');
        expect(result.data.contentHash).toBe('a'.repeat(64));
      }
    });

    it('rejects missing lang in terms response', () => {
      const invalidPayload = {
        version: '2026.09.1',
        title: 'Términos y Condiciones',
        content: 'Contenido',
        contentHash: 'a'.repeat(64),
        publishedAt: '2026-09-14T12:00:00.000Z',
      };

      const result = TermsResponseSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('validates a terms response payload with explicit lang en', () => {
      const payload = {
        version: '2026.09.1',
        lang: 'en',
        title: 'Terms and Conditions',
        content: '# Terms and Conditions\n\nWelcome to Sonora...',
        contentHash: 'a'.repeat(64),
        publishedAt: '2026-09-14T12:00:00.000Z',
      };

      const result = TermsResponseSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.lang).toBe('en');
      }
    });

    it('rejects an invalid contentHash', () => {
      const invalidPayload = {
        version: '2026.09.1',
        title: 'Términos',
        content: 'Contenido',
        contentHash: 'not-a-valid-sha256-hash',
        publishedAt: '2026-09-14T12:00:00.000Z',
      };

      const result = TermsResponseSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('rejects an empty version or title', () => {
      const invalidPayload = {
        version: '',
        title: '',
        content: 'Contenido',
        contentHash: 'a'.repeat(64),
        publishedAt: '2026-09-14T12:00:00.000Z',
      };

      const result = TermsResponseSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe('AcceptTermsRequestSchema', () => {
    it('validates a valid acceptance submission', () => {
      const validPayload = {
        deviceId: 'dev-12345-uuid',
        version: '2026.09.1',
        lang: 'es',
        contentHash: 'b'.repeat(64),
        platform: 'ios',
      };

      const result = AcceptTermsRequestSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.platform).toBe('ios');
        expect(result.data.deviceId).toBe('dev-12345-uuid');
        expect(result.data.lang).toBe('es');
      }
    });

    it('rejects missing lang in acceptance submission', () => {
      const invalidPayload = {
        deviceId: 'dev-12345-uuid',
        version: '2026.09.1',
        contentHash: 'b'.repeat(64),
        platform: 'ios',
      };

      const result = AcceptTermsRequestSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('validates acceptance submission with explicit lang en', () => {
      const payload = {
        deviceId: 'dev-12345-uuid',
        version: '2026.09.1',
        lang: 'en',
        contentHash: 'b'.repeat(64),
        platform: 'ios',
      };

      const result = AcceptTermsRequestSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.lang).toBe('en');
      }
    });

    it('rejects unknown platform', () => {
      const invalidPayload = {
        deviceId: 'dev-12345-uuid',
        version: '2026.09.1',
        contentHash: 'b'.repeat(64),
        platform: 'windows_phone',
      };

      const result = AcceptTermsRequestSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('rejects missing deviceId or invalid contentHash', () => {
      const invalidPayload = {
        deviceId: '',
        version: '2026.09.1',
        contentHash: 'short-hash',
        platform: 'android',
      };

      const result = AcceptTermsRequestSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });
});
