import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { deviceIdGuard } from '../../middleware/device-id-guard';
import { injectDeviceId } from '../../middleware/device-id';

// ── Unit tests ─────────────────────────────────────────────

describe('deviceIdGuard unit', () => {
  it('returns problem response when deviceId is undefined', async () => {
    const guard = deviceIdGuard();
    const json = vi.fn((body: unknown, s: number) => ({ body, status: s }) as unknown as Response);
    const c = { var: { deviceId: undefined }, json } as any;
    const next = vi.fn();

    const result = (await guard(c, next)) as unknown as { status: number; body: { code: string } };

    expect(result.status).toBe(400);
    expect(result.body.code).toBe('DEVICE_ID_REQUIRED');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns problem response when deviceId is empty string', async () => {
    const guard = deviceIdGuard();
    const json = vi.fn((body: unknown, s: number) => ({ body, status: s }) as unknown as Response);
    const c = { var: { deviceId: '' }, json } as any;
    const next = vi.fn();

    const result = (await guard(c, next)) as unknown as { status: number };

    expect(result.status).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when deviceId is set', async () => {
    const guard = deviceIdGuard();
    const c = { var: { deviceId: 'abc123' }, json: vi.fn() } as any;
    const next = vi.fn();

    await guard(c, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('response has RFC 7807 shape', async () => {
    const guard = deviceIdGuard();
    const json = vi.fn((body: unknown, s: number) => ({ body, status: s }) as unknown as Response);
    const c = { var: { deviceId: undefined }, json } as any;
    const next = vi.fn();

    const result = (await guard(c, next)) as unknown as { body: Record<string, unknown> };

    expect(result.body).toMatchObject({
      code: 'DEVICE_ID_REQUIRED',
      detail: expect.any(String),
      status: 400,
    });
  });
});

// ── Integration tests ─────────────────────────────────────

describe('deviceIdGuard integration', () => {
  function createTestApp() {
    const app = new Hono<{
      Variables: { deviceId?: string };
    }>();

    // Simulates injectDeviceId() — no header → no deviceId
    app.get('/needs-device', deviceIdGuard(), (c) => c.json({ ok: true }));

    return app;
  }

  it('blocks request when X-Device-Id header is missing', async () => {
    const app = createTestApp();
    const res = await app.request('/needs-device');
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('code', 'DEVICE_ID_REQUIRED');
    expect(body).toHaveProperty('status', 400);
  });

  it('allows request when deviceId is set by injectDeviceId middleware', async () => {
    const app = new Hono<{
      Bindings: Record<string, unknown>;
      Variables: { deviceId?: string };
    }>();

    // Full chain: injectDeviceId → deviceIdGuard → handler
    app.use('*', injectDeviceId());
    app.get('/needs-device', deviceIdGuard(), (c) => c.json({ ok: true }));

    const res = await app.request('/needs-device', {
      headers: { 'X-Device-Id': 'my-device' },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
