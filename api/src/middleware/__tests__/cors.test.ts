import { describe, it, expect } from 'vitest';
import app from '../../index';

describe('CORS behavior', () => {
  it('sets CORS headers when ALLOWED_ORIGIN matches', async () => {
    const req = new Request('http://localhost/feedback', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:8081',
        'Access-Control-Request-Method': 'POST',
      },
    });
    const res = await app.fetch(req, { ALLOWED_ORIGIN: 'http://localhost:8081' } as never);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:8081');
  });

  it('does not set CORS headers when ALLOWED_ORIGIN does not match', async () => {
    const req = new Request('http://localhost/feedback', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://malicious-site.com',
        'Access-Control-Request-Method': 'POST',
      },
    });
    const res = await app.fetch(req, { ALLOWED_ORIGIN: 'http://localhost:8081' } as never);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('sets custom ALLOWED_METHODS and ALLOWED_HEADERS', async () => {
    const req = new Request('http://localhost/feedback', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:8081',
        'Access-Control-Request-Method': 'POST',
      },
    });
    const res = await app.fetch(req, {
      ALLOWED_ORIGIN: 'http://localhost:8081',
      ALLOWED_METHODS: 'POST,GET',
      ALLOWED_HEADERS: 'Content-Type,X-Custom-Header',
    } as never);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:8081');
    expect(res.headers.get('access-control-allow-methods')).toBe('POST,GET');
    expect(res.headers.get('access-control-allow-headers')).toBe('Content-Type,X-Custom-Header');
  });

  it('only returns configured allowed methods and headers, even if other values are requested', async () => {
    const req = new Request('http://localhost/feedback', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:8081',
        'Access-Control-Request-Method': 'DELETE',
        'Access-Control-Request-Headers': 'X-Malicious-Header',
      },
    });
    const res = await app.fetch(req, {
      ALLOWED_ORIGIN: 'http://localhost:8081',
      ALLOWED_METHODS: 'POST,GET',
      ALLOWED_HEADERS: 'Content-Type',
    } as never);

    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:8081');
    expect(res.headers.get('access-control-allow-methods')).toBe('POST,GET');
    expect(res.headers.get('access-control-allow-headers')).toBe('Content-Type');

    const allowMethods = res.headers.get('access-control-allow-methods')?.split(',') || [];
    expect(allowMethods).not.toContain('DELETE');

    const allowHeaders = res.headers.get('access-control-allow-headers')?.split(',') || [];
    expect(allowHeaders).not.toContain('X-Malicious-Header');
  });

  it('supports loading ALLOWED_ORIGIN from process.env when c.env is empty (Node.js environment)', async () => {
    const originalValue = process.env.ALLOWED_ORIGIN;
    process.env.ALLOWED_ORIGIN = 'http://localhost:8081';

    try {
      const req = new Request('http://localhost/feedback', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:8081',
          'Access-Control-Request-Method': 'POST',
        },
      });
      const res = await app.fetch(req, {} as never);
      expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:8081');
    } finally {
      if (originalValue === undefined) {
        delete process.env.ALLOWED_ORIGIN;
      } else {
        process.env.ALLOWED_ORIGIN = originalValue;
      }
    }
  });
});
