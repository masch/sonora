import { describe, it, expect, vi } from 'vitest';
import { urlGuard } from '../../middleware/url-guard';

// ── Unit tests ─────────────────────────────────────────────

describe('urlGuard', () => {
  const mockContext = (url: string): any => ({
    req: { url },
    set: vi.fn(),
    json: vi.fn((body: unknown, s: number) => ({ body, status: s }) as unknown as Response),
  });

  it('rejects with INVALID_REQUEST_URL when request URL is malformed', async () => {
    const guard = urlGuard();
    const c = mockContext('not-a-valid-url');
    const next = vi.fn();

    const result = (await guard(c, next)) as unknown as { status: number; body: { code: string } };

    expect(result.status).toBe(400);
    expect(result.body.code).toBe('INVALID_REQUEST_URL');
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects with INVALID_REQUEST_URL when protocol is not http(s)', async () => {
    const guard = urlGuard();
    const c = mockContext('ftp://example.com/experiences');
    const next = vi.fn();

    const result = (await guard(c, next)) as unknown as { status: number };

    expect(result.status).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('sets requestUrl and calls next() for a valid https URL', async () => {
    const guard = urlGuard();
    const c = mockContext('https://example.com/experiences');
    const next = vi.fn();

    await guard(c, next);

    expect(next).toHaveBeenCalledOnce();
    expect(c.set).toHaveBeenCalledWith('requestUrl', expect.any(URL));
  });

  it('accepts a valid http URL', async () => {
    const guard = urlGuard();
    const c = mockContext('http://localhost/experiences');
    const next = vi.fn();

    await guard(c, next);

    expect(next).toHaveBeenCalledOnce();
    expect(c.set).toHaveBeenCalledWith('requestUrl', expect.any(URL));
  });
});
