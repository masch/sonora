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

  describe('mobile and native client support', () => {
    it('allows request with Origin: null (mobile WebView) and returns ACAO: null', async () => {
      const req = new Request('http://localhost/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'null',
        },
        body: JSON.stringify({
          experienceId: 'test',
          message: 'null origin test',
          idempotencyKey: 'cors-null-origin',
          createdAt: new Date().toISOString(),
        }),
      });
      const res = await app.fetch(req, { ALLOWED_ORIGIN: 'http://localhost:8081' } as never);
      expect(res.headers.get('access-control-allow-origin')).toBe('null');
    });

    it('allows preflight OPTIONS with Origin: null', async () => {
      const req = new Request('http://localhost/feedback', {
        method: 'OPTIONS',
        headers: {
          Origin: 'null',
          'Access-Control-Request-Method': 'POST',
        },
      });
      const res = await app.fetch(req, { ALLOWED_ORIGIN: 'http://localhost:8081' } as never);
      expect(res.status).toBe(204);
      expect(res.headers.get('access-control-allow-origin')).toBe('null');
    });

    it('handles request with no Origin header (native HTTP clients)', async () => {
      const req = new Request('http://localhost/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experienceId: 'test',
          message: 'no origin test',
          idempotencyKey: 'cors-no-origin',
          createdAt: new Date().toISOString(),
        }),
      });
      const res = await app.fetch(req, { ALLOWED_ORIGIN: 'http://localhost:8081' } as never);
      // No Origin → no ACAO header set, but request should pass through
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
      expect(res.status).toBe(201);
    });

    it('handles preflight OPTIONS with no Origin header', async () => {
      const req = new Request('http://localhost/feedback', {
        method: 'OPTIONS',
        headers: { 'Access-Control-Request-Method': 'POST' },
      });
      const res = await app.fetch(req, { ALLOWED_ORIGIN: 'http://localhost:8081' } as never);
      // OPTIONS without Origin should still return proper CORS headers
      expect(res.status).toBe(204);
      expect(res.headers.get('access-control-allow-methods')).toBeTruthy();
      expect(res.headers.get('access-control-allow-headers')).toBeTruthy();
    });
  });

  it('default allow-methods includes HEAD', async () => {
    const req = new Request('http://localhost/feedback', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:8081',
        'Access-Control-Request-Method': 'HEAD',
      },
    });
    const res = await app.fetch(req, { ALLOWED_ORIGIN: 'http://localhost:8081' } as never);
    const methods = res.headers.get('access-control-allow-methods')?.split(',') || [];
    expect(methods).toContain('HEAD');
  });

  describe('permissive mode (no ALLOWED_ORIGIN configured)', () => {
    it('allows any origin when ALLOWED_ORIGIN is not set', async () => {
      const req = new Request('http://localhost/feedback', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://any-origin.com',
          'Access-Control-Request-Method': 'POST',
        },
      });
      const res = await app.fetch(req, {} as never);
      expect(res.headers.get('access-control-allow-origin')).toBe('https://any-origin.com');
    });

    it('allows Origin: null in permissive mode', async () => {
      const req = new Request('http://localhost/feedback', {
        method: 'OPTIONS',
        headers: {
          Origin: 'null',
          'Access-Control-Request-Method': 'POST',
        },
      });
      const res = await app.fetch(req, {} as never);
      expect(res.status).toBe(204);
      expect(res.headers.get('access-control-allow-origin')).toBe('null');
    });
  });
});
