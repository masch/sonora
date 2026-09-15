import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import app, { setDbClient } from '../index';
import type { DbClient } from '../db';

function createMockDb(termsRows: unknown[] = [], onInsert?: (record: unknown) => void): DbClient {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve(termsRows),
          }),
        }),
        orderBy: () => ({
          limit: () => Promise.resolve(termsRows),
        }),
      }),
    }),
    insert: () => ({
      values: (record: unknown) => {
        onInsert?.(record);
        return Promise.resolve();
      },
    }),
  } as unknown as DbClient;
}

describe('Terms API', () => {
  beforeEach(() => {
    setDbClient(null);
  });

  afterEach(() => {
    setDbClient(null);
  });

  describe('GET /terms', () => {
    it('returns 422 when lang query parameter is missing', async () => {
      const res = await app.request('/terms');
      expect(res.status).toBe(422);
    });

    it('returns 422 when lang query parameter is invalid', async () => {
      const res = await app.request('/terms?lang=fr');
      expect(res.status).toBe(422);
    });

    it('returns 500 when DB is not available', async () => {
      const res = await app.request('/terms?lang=es');
      expect(res.status).toBe(500);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('DB_NOT_AVAILABLE');
    });

    it('returns 404 when no terms are published', async () => {
      setDbClient(createMockDb([]));

      const res = await app.request('/terms?lang=es');
      expect(res.status).toBe(404);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('NOT_FOUND');
    });

    it('returns 200 with active terms version for requested language es', async () => {
      const mockTerms = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        version: '2026.09.1',
        lang: 'es',
        title: 'Términos y Condiciones',
        content: '# Términos y Condiciones',
        contentHash: 'a'.repeat(64),
        publishedAt: new Date('2026-09-14T00:00:00Z'),
      };

      setDbClient(createMockDb([mockTerms]));

      const res = await app.request('/terms?lang=es');
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        version: string;
        lang: string;
        title: string;
        content: string;
        contentHash: string;
        publishedAt: string;
      };
      expect(body.version).toBe('2026.09.1');
      expect(body.lang).toBe('es');
      expect(body.contentHash).toBe('a'.repeat(64));
    });

    it('returns 200 with requested language en when query param lang=en', async () => {
      const mockEnTerms = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        version: '2026.09.1',
        lang: 'en',
        title: 'Terms and Conditions',
        content: '# Terms and Conditions',
        contentHash: 'c'.repeat(64),
        publishedAt: new Date('2026-09-14T00:00:00Z'),
      };

      setDbClient(createMockDb([mockEnTerms]));

      const res = await app.request('/terms?lang=en');
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        version: string;
        lang: string;
        title: string;
        content: string;
        contentHash: string;
      };
      expect(body.version).toBe('2026.09.1');
      expect(body.lang).toBe('en');
      expect(body.title).toBe('Terms and Conditions');
      expect(body.contentHash).toBe('c'.repeat(64));
    });
  });

  describe('POST /terms/accept', () => {
    it('returns 422 for invalid request body or missing lang', async () => {
      const res = await app.request('/terms/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: '' }),
      });
      expect(res.status).toBe(422);

      const resMissingLang = await app.request('/terms/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'device-abc-123',
          version: '2026.09.1',
          contentHash: 'b'.repeat(64),
          platform: 'ios',
        }),
      });
      expect(resMissingLang.status).toBe(422);
    });

    it('returns 404 when no terms are published to accept', async () => {
      setDbClient(createMockDb([]));

      const res = await app.request('/terms/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'device-abc-123',
          version: '2026.09.1',
          lang: 'es',
          contentHash: 'b'.repeat(64),
          platform: 'ios',
        }),
      });

      expect(res.status).toBe(404);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('NO_ACTIVE_TERMS');
    });

    it('returns 422 when accepting an outdated terms version', async () => {
      const activeTerms = {
        version: '2026.09.1',
        lang: 'es',
        contentHash: 'a'.repeat(64),
        publishedAt: new Date('2026-09-14T00:00:00Z'),
      };

      setDbClient(createMockDb([activeTerms]));

      const res = await app.request('/terms/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'device-abc-123',
          version: '2025.01.1',
          lang: 'es',
          contentHash: 'a'.repeat(64),
          platform: 'ios',
        }),
      });

      expect(res.status).toBe(422);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('TERMS_VERSION_MISMATCH');
    });

    it('returns 422 when accepting with a mismatched contentHash', async () => {
      const activeTerms = {
        version: '2026.09.1',
        lang: 'es',
        contentHash: 'a'.repeat(64),
        publishedAt: new Date('2026-09-14T00:00:00Z'),
      };

      setDbClient(createMockDb([activeTerms]));

      const res = await app.request('/terms/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'device-abc-123',
          version: '2026.09.1',
          lang: 'es',
          contentHash: 'b'.repeat(64),
          platform: 'ios',
        }),
      });

      expect(res.status).toBe(422);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('TERMS_VERSION_MISMATCH');
    });

    it('inserts audit record with lang es and returns 201 on valid submission', async () => {
      let insertedRecord: unknown = null;
      const activeTerms = {
        version: '2026.09.1',
        lang: 'es',
        contentHash: 'b'.repeat(64),
        publishedAt: new Date('2026-09-14T00:00:00Z'),
      };

      setDbClient(
        createMockDb([activeTerms], (record) => {
          insertedRecord = record;
        }),
      );

      const payload = {
        deviceId: 'device-abc-123',
        version: '2026.09.1',
        lang: 'es',
        contentHash: 'b'.repeat(64),
        platform: 'ios',
      };

      const res = await app.request('/terms/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '192.168.1.50',
          'user-agent': 'SonoraApp/1.0',
        },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);
      expect(insertedRecord).toMatchObject({
        deviceId: 'device-abc-123',
        version: '2026.09.1',
        lang: 'es',
        contentHash: 'b'.repeat(64),
        platform: 'ios',
        ipAddress: '192.168.1.50',
        userAgent: 'SonoraApp/1.0',
      });
    });

    it('inserts audit record with lang en and returns 201 on valid English submission', async () => {
      let insertedRecord: unknown = null;
      const activeEnTerms = {
        version: '2026.09.1',
        lang: 'en',
        contentHash: 'c'.repeat(64),
        publishedAt: new Date('2026-09-14T00:00:00Z'),
      };

      setDbClient(
        createMockDb([activeEnTerms], (record) => {
          insertedRecord = record;
        }),
      );

      const payload = {
        deviceId: 'device-en-456',
        version: '2026.09.1',
        lang: 'en',
        contentHash: 'c'.repeat(64),
        platform: 'android',
      };

      const res = await app.request('/terms/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '10.0.0.1',
          'user-agent': 'SonoraAndroid/1.0',
        },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(201);
      expect(insertedRecord).toMatchObject({
        deviceId: 'device-en-456',
        version: '2026.09.1',
        lang: 'en',
        contentHash: 'c'.repeat(64),
        platform: 'android',
      });
    });

    it('falls back to x-forwarded-for when cf-connecting-ip is not present', async () => {
      let insertedRecord: unknown = null;
      const activeTerms = {
        version: '2026.09.1',
        lang: 'es',
        contentHash: 'b'.repeat(64),
        publishedAt: new Date('2026-09-14T00:00:00Z'),
      };

      setDbClient(
        createMockDb([activeTerms], (record) => {
          insertedRecord = record;
        }),
      );

      const res = await app.request('/terms/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.195, 70.41.3.18',
        },
        body: JSON.stringify({
          deviceId: 'device-abc-123',
          version: '2026.09.1',
          lang: 'es',
          contentHash: 'b'.repeat(64),
          platform: 'android',
        }),
      });

      expect(res.status).toBe(201);
      expect(insertedRecord).toMatchObject({
        ipAddress: '203.0.113.195',
        userAgent: 'unknown',
      });
    });

    it('handles missing IP and user-agent headers gracefully', async () => {
      let insertedRecord: unknown = null;
      const activeTerms = {
        version: '2026.09.1',
        lang: 'es',
        contentHash: 'b'.repeat(64),
        publishedAt: new Date('2026-09-14T00:00:00Z'),
      };

      setDbClient(
        createMockDb([activeTerms], (record) => {
          insertedRecord = record;
        }),
      );

      const res = await app.request('/terms/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId: 'device-abc-123',
          version: '2026.09.1',
          lang: 'es',
          contentHash: 'b'.repeat(64),
          platform: 'web',
        }),
      });

      expect(res.status).toBe(201);
      expect(insertedRecord).toMatchObject({
        ipAddress: 'unknown',
        userAgent: 'unknown',
      });
    });
  });
});
