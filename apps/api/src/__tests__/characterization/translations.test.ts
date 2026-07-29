import { describe, it, expect } from 'vitest';
import app from '../../index';

const ENV_AUTH = { ADMIN_API_KEY: 'test-admin-key' };
const BASE = 'http://localhost';

describe('PUT /api/translations — characterization', () => {
  it('captures current behavior when Authorization missing (no env)', async () => {
    const res = await app.request(
      '/api/translations',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ lang: 'en', key: 't', value: 'v' }]),
      },
      {},
    );
    // No ADMIN_API_KEY in env → 500 (misconfig)
    expect(res.status).toBe(500);
  });

  it('captures current behavior when Authorization wrong', async () => {
    const res = await app.fetch(
      new Request(`${BASE}/api/translations`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer wrong-key',
        },
        body: JSON.stringify([{ lang: 'en', key: 't', value: 'v' }]),
      }),
      ENV_AUTH,
    );
    // Valid ADMIN_API_KEY in env, but wrong Authorization header → 401
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('code', 'UNAUTHORIZED');
    expect(body).toHaveProperty('detail', 'Valid authentication is required.');
    expect(body).toHaveProperty('status', 401);
  });

  it('captures 422 for empty key', async () => {
    const res = await app.fetch(
      new Request(`${BASE}/api/translations`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-admin-key',
        },
        body: JSON.stringify([{ lang: 'en', key: '', value: 'v' }]),
      }),
      ENV_AUTH,
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('code', 'VALIDATION_ERROR');
    expect(body).toHaveProperty('detail', 'The request contains invalid fields.');
    expect(body).toHaveProperty('status', 422);
    const errors = body.errors as Array<Record<string, unknown>>;
    expect(errors.length).toBeGreaterThan(0);
  });

  it('captures 500 for empty body (zValidator does not catch JSON parse errors)', async () => {
    const res = await app.fetch(
      new Request(`${BASE}/api/translations`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-admin-key',
        },
      }),
      ENV_AUTH,
    );
    // JSON parse errors fall through to Hono's default error handler
    expect(res.status).toBe(500);
  });
});

describe('GET /api/translations/session — characterization', () => {
  it('captures 200 with valid auth', async () => {
    const res = await app.fetch(
      new Request(`${BASE}/api/translations/session`, {
        method: 'GET',
        headers: { Authorization: 'Bearer test-admin-key' },
      }),
      ENV_AUTH,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ valid: true });
  });

  it('captures current behavior when auth missing (no env)', async () => {
    const res = await app.request('/api/translations/session', { method: 'GET' }, {});
    // No ADMIN_API_KEY in env → 500
    expect(res.status).toBe(500);
  });

  it('captures 401 when auth wrong with valid env', async () => {
    const res = await app.fetch(
      new Request(`${BASE}/api/translations/session`, {
        method: 'GET',
        headers: { Authorization: 'Bearer wrong-key' },
      }),
      ENV_AUTH,
    );
    expect(res.status).toBe(401);
  });
});
