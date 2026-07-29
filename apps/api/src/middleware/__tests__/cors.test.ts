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

  it('allows request when ALLOWED_ORIGIN contains multiple comma-separated origins and matches one of them', async () => {
    const origins = 'http://localhost:8081,http://localhost:8082';

    // First origin match
    const req1 = new Request('http://localhost/feedback', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:8081',
        'Access-Control-Request-Method': 'POST',
      },
    });
    const res1 = await app.fetch(req1, { ALLOWED_ORIGIN: origins } as never);
    expect(res1.headers.get('access-control-allow-origin')).toBe('http://localhost:8081');

    // Second origin match
    const req2 = new Request('http://localhost/feedback', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:8082',
        'Access-Control-Request-Method': 'POST',
      },
    });
    const res2 = await app.fetch(req2, { ALLOWED_ORIGIN: origins } as never);
    expect(res2.headers.get('access-control-allow-origin')).toBe('http://localhost:8082');

    // Non-matching origin
    const req3 = new Request('http://localhost/feedback', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:8083',
        'Access-Control-Request-Method': 'POST',
      },
    });
    const res3 = await app.fetch(req3, { ALLOWED_ORIGIN: origins } as never);
    expect(res3.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('uses default methods and headers when no env overrides are provided', async () => {
    const req = new Request('http://localhost/feedback', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:8081',
        'Access-Control-Request-Method': 'POST',
      },
    });
    const res = await app.fetch(req, {
      ALLOWED_ORIGIN: 'http://localhost:8081',
    } as never);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:8081');
    const methods = res.headers.get('access-control-allow-methods')?.split(',') || [];
    expect(methods).toContain('POST');
    expect(methods).toContain('GET');
    expect(methods).toContain('OPTIONS');
    expect(methods).toContain('HEAD');
  });

  it('uses the hardcoded default methods and headers regardless of Access-Control-Request-* values', async () => {
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
    } as never);

    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:8081');
    const methods = res.headers.get('access-control-allow-methods')?.split(',') || [];
    expect(methods.sort()).toEqual(
      ['POST', 'GET', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].sort(),
    );

    const headers = res.headers.get('access-control-allow-headers')?.split(',') || [];
    expect(headers.sort()).toEqual(
      [
        'Content-Type',
        'Authorization',
        'Range',
        'Cache-Control',
        'Pragma',
        'X-Device-Id',
        'X-Signature',
        'X-Timestamp',
        'X-Nonce',
        'Retry-After',
      ].sort(),
    );
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

  it('uses ALLOWED_METHODS from env when provided', async () => {
    const req = new Request('http://localhost/feedback', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:8081',
        'Access-Control-Request-Method': 'POST',
      },
    });
    const res = await app.fetch(req, {
      ALLOWED_ORIGIN: 'http://localhost:8081',
      ALLOWED_METHODS: 'GET,POST',
    } as never);
    const methods = res.headers.get('access-control-allow-methods')?.split(',') || [];
    expect(methods.sort()).toEqual(['GET', 'POST'].sort());
    expect(methods).not.toContain('DELETE');
  });

  it('uses ALLOWED_HEADERS from env when provided', async () => {
    const req = new Request('http://localhost/feedback', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:8081',
        'Access-Control-Request-Method': 'POST',
      },
    });
    const res = await app.fetch(req, {
      ALLOWED_ORIGIN: 'http://localhost:8081',
      ALLOWED_HEADERS: 'Content-Type,X-Device-Id',
    } as never);
    const headers = res.headers.get('access-control-allow-headers')?.split(',') || [];
    expect(headers.sort()).toEqual(['Content-Type', 'X-Device-Id'].sort());
    expect(headers).not.toContain('Authorization');
  });

  it('exposes Content-Length and Content-Range headers', async () => {
    const req = new Request('http://localhost/feedback', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:8081',
        'Access-Control-Request-Method': 'GET',
      },
    });
    const res = await app.fetch(req, { ALLOWED_ORIGIN: 'http://localhost:8081' } as never);
    expect(res.headers.get('access-control-expose-headers')).toBe(
      'Content-Length,Content-Range,ETag,x-audio-etag,Retry-After',
    );
  });
});
