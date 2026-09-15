import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import app, { setDbClient } from '../index';
import type { DbClient } from '../db';

describe('Terms API', () => {
  beforeEach(() => {
    setDbClient(null);
  });

  afterEach(() => {
    setDbClient(null);
  });

  describe('GET /terms', () => {
    it('returns 500 when DB is not available', async () => {
      const res = await app.request('/terms');
      expect(res.status).toBe(500);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('DB_NOT_AVAILABLE');
    });

    it('returns 404 when no terms are published', async () => {
      const mockDb = {
        select: () => ({
          from: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
      } as unknown as DbClient;

      setDbClient(mockDb);

      const res = await app.request('/terms');
      expect(res.status).toBe(404);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('NOT_FOUND');
    });

    it('returns 200 with the active terms version', async () => {
      const mockTerms = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        version: '2026.09.1',
        title: 'Términos y Condiciones',
        content: '# Términos y Condiciones',
        contentHash: 'a'.repeat(64),
        publishedAt: new Date('2026-09-14T00:00:00Z'),
      };

      const mockDb = {
        select: () => ({
          from: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([mockTerms]),
            }),
          }),
        }),
      } as unknown as DbClient;

      setDbClient(mockDb);

      const res = await app.request('/terms');
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        version: string;
        title: string;
        content: string;
        contentHash: string;
        publishedAt: string;
      };
      expect(body.version).toBe('2026.09.1');
      expect(body.contentHash).toBe('a'.repeat(64));
    });
  });

  describe('POST /terms/accept', () => {
    it('returns 400 or 422 for invalid request body', async () => {
      const res = await app.request('/terms/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: '' }),
      });
      expect([400, 422]).toContain(res.status);
    });

    it('returns 404 when no terms are published to accept', async () => {
      const mockDb = {
        select: () => ({
          from: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
      } as unknown as DbClient;

      setDbClient(mockDb);

      const res = await app.request('/terms/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'device-abc-123',
          version: '2026.09.1',
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
        contentHash: 'a'.repeat(64),
        publishedAt: new Date('2026-09-14T00:00:00Z'),
      };

      const mockDb = {
        select: () => ({
          from: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([activeTerms]),
            }),
          }),
        }),
      } as unknown as DbClient;

      setDbClient(mockDb);

      const res = await app.request('/terms/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'device-abc-123',
          version: '2025.01.1',
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
        contentHash: 'a'.repeat(64),
        publishedAt: new Date('2026-09-14T00:00:00Z'),
      };

      const mockDb = {
        select: () => ({
          from: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([activeTerms]),
            }),
          }),
        }),
      } as unknown as DbClient;

      setDbClient(mockDb);

      const res = await app.request('/terms/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'device-abc-123',
          version: '2026.09.1',
          contentHash: 'b'.repeat(64),
          platform: 'ios',
        }),
      });

      expect(res.status).toBe(422);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('TERMS_VERSION_MISMATCH');
    });

    it('inserts audit record and returns 201 on valid submission matching active terms', async () => {
      let insertedRecord: unknown = null;
      const activeTerms = {
        version: '2026.09.1',
        contentHash: 'b'.repeat(64),
        publishedAt: new Date('2026-09-14T00:00:00Z'),
      };

      const mockDb = {
        select: () => ({
          from: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([activeTerms]),
            }),
          }),
        }),
        insert: () => ({
          values: (record: unknown) => {
            insertedRecord = record;
            return Promise.resolve();
          },
        }),
      } as unknown as DbClient;

      setDbClient(mockDb);

      const payload = {
        deviceId: 'device-abc-123',
        version: '2026.09.1',
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
        contentHash: 'b'.repeat(64),
        platform: 'ios',
        ipAddress: '192.168.1.50',
        userAgent: 'SonoraApp/1.0',
      });
    });

    it('falls back to x-forwarded-for when cf-connecting-ip is not present', async () => {
      let insertedRecord: unknown = null;
      const activeTerms = {
        version: '2026.09.1',
        contentHash: 'b'.repeat(64),
        publishedAt: new Date('2026-09-14T00:00:00Z'),
      };

      const mockDb = {
        select: () => ({
          from: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([activeTerms]),
            }),
          }),
        }),
        insert: () => ({
          values: (record: unknown) => {
            insertedRecord = record;
            return Promise.resolve();
          },
        }),
      } as unknown as DbClient;

      setDbClient(mockDb);

      const res = await app.request('/terms/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.195, 70.41.3.18',
        },
        body: JSON.stringify({
          deviceId: 'device-abc-123',
          version: '2026.09.1',
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
        contentHash: 'b'.repeat(64),
        publishedAt: new Date('2026-09-14T00:00:00Z'),
      };

      const mockDb = {
        select: () => ({
          from: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([activeTerms]),
            }),
          }),
        }),
        insert: () => ({
          values: (record: unknown) => {
            insertedRecord = record;
            return Promise.resolve();
          },
        }),
      } as unknown as DbClient;

      setDbClient(mockDb);

      const res = await app.request('/terms/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId: 'device-abc-123',
          version: '2026.09.1',
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

    it('handles publishedAt when stored as a string or non-Date object', async () => {
      const mockTerms = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        version: '2026.09.1',
        title: 'Términos y Condiciones',
        content: '# Términos y Condiciones',
        contentHash: 'a'.repeat(64),
        publishedAt: '2026-09-14T00:00:00Z',
      };

      const mockDb = {
        select: () => ({
          from: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([mockTerms]),
            }),
          }),
        }),
      } as unknown as DbClient;

      setDbClient(mockDb);

      const res = await app.request('/terms');
      expect(res.status).toBe(200);
      const body = (await res.json()) as { publishedAt: string };
      expect(body.publishedAt).toBe('2026-09-14T00:00:00Z');
    });
  });
});
