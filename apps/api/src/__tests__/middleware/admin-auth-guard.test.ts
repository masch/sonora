import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { adminAuthGuard } from '../../middleware/admin-auth-guard';

function createTestApp(env: Record<string, unknown> = {}) {
  const app = new Hono<{
    Bindings: Record<string, unknown>;
    Variables: Record<string, unknown>;
  }>();

  app.get('/protected', adminAuthGuard(), (c) => c.json({ ok: true }));

  // Return a fetch wrapper that injects env
  return (req: Request) => app.fetch(req, env);
}

describe('adminAuthGuard middleware', () => {
  it('returns 500 when ADMIN_API_KEY is not set in env', async () => {
    const fetch = createTestApp({});
    const res = await fetch(
      new Request('http://localhost/protected', {
        headers: { Authorization: 'Bearer any-key' },
      }),
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('code', 'MISCONFIG');
    expect(body).toHaveProperty('detail', 'An unexpected error occurred');
    expect(body).toHaveProperty('status', 500);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const fetch = createTestApp({ ADMIN_API_KEY: 'my-secret-key' });
    const res = await fetch(new Request('http://localhost/protected'));
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('code', 'UNAUTHORIZED');
    expect(body).toHaveProperty('detail', 'Valid authentication is required.');
    expect(body).toHaveProperty('status', 401);
  });

  it('returns 401 when Authorization header does not match', async () => {
    const fetch = createTestApp({ ADMIN_API_KEY: 'my-secret-key' });
    const res = await fetch(
      new Request('http://localhost/protected', {
        headers: { Authorization: 'Bearer wrong-key' },
      }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('code', 'UNAUTHORIZED');
    expect(body).toHaveProperty('detail', 'Valid authentication is required.');
    expect(body).toHaveProperty('status', 401);
  });

  it('calls next() when Authorization matches', async () => {
    const fetch = createTestApp({ ADMIN_API_KEY: 'my-secret-key' });
    const res = await fetch(
      new Request('http://localhost/protected', {
        headers: { Authorization: 'Bearer my-secret-key' },
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('requires Bearer prefix in token', async () => {
    const fetch = createTestApp({ ADMIN_API_KEY: 'my-secret-key' });
    // Send key without Bearer prefix
    const res = await fetch(
      new Request('http://localhost/protected', {
        headers: { Authorization: 'my-secret-key' },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 401 with empty Authorization header', async () => {
    const fetch = createTestApp({ ADMIN_API_KEY: 'my-secret-key' });
    const res = await fetch(
      new Request('http://localhost/protected', {
        headers: { Authorization: '' },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('handles empty ADMIN_API_KEY env value (falsy)', async () => {
    const fetch = createTestApp({ ADMIN_API_KEY: '' });
    const res = await fetch(
      new Request('http://localhost/protected', {
        headers: { Authorization: 'Bearer any-key' },
      }),
    );
    // Empty string is falsy → falls to misconfig
    expect(res.status).toBe(500);
  });
});
