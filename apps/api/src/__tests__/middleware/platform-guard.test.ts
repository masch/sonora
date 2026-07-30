import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { platformGuard } from '../../middleware/platform-guard';
import { injectDeviceId } from '../../middleware/device-id';

// ── Unit tests ─────────────────────────────────────────────

describe('platformGuard unit', () => {
  it('returns problem response when devicePlatform is undefined', async () => {
    const guard = platformGuard();
    const json = vi.fn((body: unknown, s: number) => ({ body, status: s }) as unknown as Response);
    const c = { var: { devicePlatform: undefined }, json } as any;
    const next = vi.fn();

    const result = (await guard(c, next)) as unknown as { status: number; body: { code: string } };

    expect(result.status).toBe(400);
    expect(result.body.code).toBe('PLATFORM_REQUIRED');
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when devicePlatform is set', async () => {
    const guard = platformGuard();
    const c = { var: { devicePlatform: 'ios' }, json: vi.fn() } as any;
    const next = vi.fn();

    await guard(c, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('response has RFC 7807 shape', async () => {
    const guard = platformGuard();
    const json = vi.fn((body: unknown, s: number) => ({ body, status: s }) as unknown as Response);
    const c = { var: { devicePlatform: undefined }, json } as any;
    const next = vi.fn();

    const result = (await guard(c, next)) as unknown as { body: Record<string, unknown> };

    expect(result.body).toMatchObject({
      code: 'PLATFORM_REQUIRED',
      detail: expect.any(String),
      status: 400,
    });
  });
});

// ── Integration tests ─────────────────────────────────────

describe('platformGuard integration', () => {
  it('blocks request when X-Device-Platform header is missing', async () => {
    const app = new Hono<{
      Bindings: Record<string, unknown>;
      Variables: { devicePlatform?: string };
    }>();

    app.get('/needs-platform', platformGuard(), (c) => c.json({ ok: true }));

    const res = await app.request('/needs-platform');
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('code', 'PLATFORM_REQUIRED');
    expect(body).toHaveProperty('status', 400);
  });

  it('allows request when platform is set by injectDeviceId middleware', async () => {
    const app = new Hono<{
      Bindings: Record<string, unknown>;
      Variables: { deviceId?: string; devicePlatform?: string };
    }>();

    app.use('*', injectDeviceId());
    app.post('/needs-platform', platformGuard(), (c) => c.json({ ok: true }));

    const res = await app.request('/needs-platform', {
      method: 'POST',
      headers: {
        'X-Device-Id': 'test-device-hash',
        'X-Device-Platform': 'android',
      },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('blocks when platform header is missing but device ID is present', async () => {
    const app = new Hono<{
      Bindings: Record<string, unknown>;
      Variables: { deviceId?: string; devicePlatform?: string };
    }>();

    app.use('*', injectDeviceId());
    app.post('/needs-platform', platformGuard(), (c) => c.json({ ok: true }));

    const res = await app.request('/needs-platform', {
      method: 'POST',
      headers: { 'X-Device-Id': 'test-device-hash' },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('code', 'PLATFORM_REQUIRED');
  });
});
