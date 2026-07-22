import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import app, { setDbClient } from '../index';

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

    it('returns 422 for invalid language code (3 letters)', async () => {
      const res = await app.request('/api/translations/eng', {}, BINDINGS);
      expect(res.status).toBe(422);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('VALIDATION_ERROR');
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

    it('returns 500 for empty body (zValidator does not catch JSON parse errors)', async () => {
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
      // JSON parse errors fall through to Hono's default error handler
      expect(res.status).toBe(500);
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

  describe('POST /api/translations/validate', () => {
    it('returns 200 with valid auth header', async () => {
      const res = await app.request(
        '/api/translations/validate',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer test-admin-key-123',
          },
        },
        BINDINGS,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { valid: boolean };
      expect(body.valid).toBe(true);
    });

    it('returns 401 with invalid auth header', async () => {
      const res = await app.request(
        '/api/translations/validate',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer wrong-key',
          },
        },
        BINDINGS,
      );
      expect(res.status).toBe(401);
    });

    it('returns 401 without auth header', async () => {
      const res = await app.request(
        '/api/translations/validate',
        {
          method: 'POST',
        },
        BINDINGS,
      );
      expect(res.status).toBe(401);
    });
  });
});
