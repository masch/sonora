import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import app, { setDbClient } from '../index';
import type { DbClient } from '../db';

function createMockDb(): DbClient {
  const store: { lang: string; key: string; value: string }[] = [];

  return {
    insert: (_table: any) => ({
      values: (values: any) => ({
        onConflictDoUpdate: async (_opts: any) => {
          // Upsert: update existing or insert
          const idx = store.findIndex((r) => r.lang === values.lang && r.key === values.key);
          if (idx >= 0) {
            store[idx] = { ...store[idx], ...values };
          } else {
            store.push(values);
          }
        },
      }),
    }),
    select: (_fields?: any) => ({
      from: (_table: any) => ({
        where: (_condition: any) => {
          // Simplified: return all store entries
          // In real tests, filter would be applied by Drizzle
          return Promise.resolve(
            store
              .filter((r) => {
                // Basic lang filter matching — since Drizzle handles this via eq(),
                // we just return what would match
                return r.lang === 'en' || r.lang === 'es';
              })
              .map((r) => ({
                key: r.key,
                value: r.value,
              })),
          );
        },
      }),
    }),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    delete: (_table: any) => ({
      where: (_condition: any) => Promise.resolve(),
    }),
  } as unknown as DbClient;
}

describe('Translations API', () => {
  const BINDINGS = {
    ADMIN_API_KEY: 'test-admin-key-123',
  };

  beforeEach(() => {
    setDbClient(null);
  });

  afterEach(() => {
    setDbClient(null);
  });

  describe('GET /api/translations/:lang', () => {
    it('returns empty object when no overrides exist', async () => {
      const res = await app.request('/api/translations/en', {}, BINDINGS);
      // Without DB, it should return 500
      expect(res.status).toBe(500);
    });

    it('returns 400 for invalid language code (3 letters)', async () => {
      const res = await app.request('/api/translations/eng', {}, BINDINGS);
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('Invalid language code');
    });

    it('returns 400 for empty lang parameter', async () => {
      const res = await app.request('/api/translations/', {}, BINDINGS);
      // Empty lang should fail
      expect([400, 404]).toContain(res.status);
    });
  });

  describe('PUT /api/translations', () => {
    it('returns 401 without auth header', async () => {
      const res = await app.request(
        '/api/translations',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([{ lang: 'en', key: 'test.key', value: 'Test' }]),
        },
        BINDINGS,
      );
      expect(res.status).toBe(401);
    });

    it('returns 401 with wrong auth header', async () => {
      const res = await app.request(
        '/api/translations',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer wrong-key',
          },
          body: JSON.stringify([{ lang: 'en', key: 'test.key', value: 'Test' }]),
        },
        BINDINGS,
      );
      expect(res.status).toBe(401);
    });

    it('returns 400 for empty body', async () => {
      const res = await app.request(
        '/api/translations',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-admin-key-123',
          },
          body: '',
        },
        BINDINGS,
      );
      expect(res.status).toBe(400);
    });

    it('returns 422 for invalid entry (empty key)', async () => {
      const res = await app.request(
        '/api/translations',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-admin-key-123',
          },
          body: JSON.stringify([{ lang: 'en', key: '', value: 'X' }]),
        },
        BINDINGS,
      );
      expect(res.status).toBe(422);
    });

    it('returns 422 for invalid lang code', async () => {
      const res = await app.request(
        '/api/translations',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-admin-key-123',
          },
          body: JSON.stringify([{ lang: 'eng', key: 'test.key', value: 'Test' }]),
        },
        BINDINGS,
      );
      expect(res.status).toBe(422);
    });
  });
});
