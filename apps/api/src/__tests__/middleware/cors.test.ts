import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { configureCors } from '../../middleware/cors';

function createTestApp(env: Record<string, unknown> = {}) {
  const app = new Hono<{
    Bindings: Record<string, unknown>;
    Variables: Record<string, unknown>;
  }>();

  app.use('*', configureCors());
  app.post('/test', (c) => c.json({ ok: true }));

  return (req: Request) => app.fetch(req, env);
}

describe('configureCors middleware', () => {
  it('includes X-Signature, X-Timestamp, X-Nonce in Access-Control-Allow-Headers on preflight', async () => {
    const fetch = createTestApp({});
    const res = await fetch(
      new Request('http://localhost/test', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:8082',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'x-signature, x-timestamp, x-nonce, retry-after',
        },
      }),
    );

    const allowHeaders = res.headers.get('Access-Control-Allow-Headers')?.toLowerCase() ?? '';
    expect(allowHeaders).toContain('x-signature');
    expect(allowHeaders).toContain('x-timestamp');
    expect(allowHeaders).toContain('x-nonce');
    expect(allowHeaders).toContain('retry-after');
  });

  it('includes Retry-After in Access-Control-Expose-Headers on POST', async () => {
    const fetch = createTestApp({});
    const res = await fetch(
      new Request('http://localhost/test', {
        method: 'POST',
        headers: { Origin: 'http://localhost:8082' },
      }),
    );

    const exposeHeaders = res.headers.get('Access-Control-Expose-Headers') ?? '';
    expect(exposeHeaders).toContain('Retry-After');
  });

  it('includes Access-Control-Allow-Credentials: true on preflight OPTIONS requests', async () => {
    const fetch = createTestApp({});
    const res = await fetch(
      new Request('http://localhost/test', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:8082',
          'Access-Control-Request-Method': 'POST',
        },
      }),
    );

    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:8082');
  });

  it('includes Access-Control-Allow-Credentials: true on cross-origin POST requests', async () => {
    const fetch = createTestApp({});
    const res = await fetch(
      new Request('http://localhost/test', {
        method: 'POST',
        headers: {
          Origin: 'http://localhost:8082',
        },
      }),
    );

    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:8082');
  });

  it('respects ALLOWED_ORIGIN env binding when configured', async () => {
    const fetch = createTestApp({ ALLOWED_ORIGIN: 'https://admin.sonora.app' });

    const validRes = await fetch(
      new Request('http://localhost/test', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://admin.sonora.app',
          'Access-Control-Request-Method': 'POST',
        },
      }),
    );
    expect(validRes.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(validRes.headers.get('Access-Control-Allow-Origin')).toBe('https://admin.sonora.app');

    const invalidRes = await fetch(
      new Request('http://localhost/test', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://malicious-site.com',
          'Access-Control-Request-Method': 'POST',
        },
      }),
    );
    expect(invalidRes.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
