import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { hashDeviceId, injectDeviceId } from '../middleware/device-id';

describe('device-id middleware', () => {
  describe('hashDeviceId', () => {
    it('hashes a device ID using SHA-256', async () => {
      const deviceId = 'test-device-123';
      const hash = await hashDeviceId(deviceId);
      expect(hash).toBe('a6896270a62b75eaa63ba4724c236adc366bd774d53a252437d0759ca314058b');
    });

    it('produces the same hash for the same input', async () => {
      const hash1 = await hashDeviceId('device-abc');
      const hash2 = await hashDeviceId('device-abc');
      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different inputs', async () => {
      const hash1 = await hashDeviceId('device-abc');
      const hash2 = await hashDeviceId('device-def');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('injectDeviceId middleware', () => {
    it.each([
      { label: 'UUID v4', id: '550e8400-e29b-4a4a-a716-446655440000' },
      { label: 'Android ID (hex 64-bit)', id: 'd6a66d9d0351085d' },
      { label: 'iOS vendor ID', id: 'a23baa7e-2c82-472f-9241-4f23e00c1732' },
      { label: 'arbitrary string', id: 'not-a-uuid' },
      { label: 'numeric', id: '12345' },
    ])('accepts $label as X-Device-Id', async ({ id }) => {
      const app = new Hono<{ Variables: { deviceId?: string } }>();
      app.use('*', injectDeviceId());
      app.get('/test', (c) => {
        return c.json({ deviceId: c.get('deviceId') });
      });

      const res = await app.request('/test', {
        headers: { 'X-Device-Id': id },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { deviceId: string | null };
      // Now pass-through: c.var.deviceId is the raw header value, not hashed
      expect(body.deviceId).toBe(id);
    });

    it('does not set the deviceId variable if X-Device-Id header is missing', async () => {
      const app = new Hono<{ Variables: { deviceId?: string } }>();
      app.use('*', injectDeviceId());
      app.get('/test', (c) => {
        return c.json({ deviceId: c.get('deviceId') || null });
      });

      const res = await app.request('/test');
      expect(res.status).toBe(200);
      const body = (await res.json()) as { deviceId: string | null };
      expect(body.deviceId).toBeNull();
    });

    it('returns 400 INVALID_DEVICE_ID for empty X-Device-Id header', async () => {
      const app = new Hono<{ Variables: { deviceId?: string } }>();
      app.use('*', injectDeviceId());
      app.get('/test', (c) => {
        return c.json({ deviceId: c.get('deviceId') || null });
      });

      const res = await app.request('/test', {
        headers: { 'X-Device-Id': '' },
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string; detail: string; status: number };
      expect(body.code).toBe('INVALID_DEVICE_ID');
      expect(body.detail).toBe('The X-Device-Id header must not be empty.');
      expect(body.status).toBe(400);
    });

    it('returns 400 INVALID_DEVICE_ID for whitespace-only value (direct middleware call)', async () => {
      const middleware = injectDeviceId();
      const json = vi.fn(
        (body: unknown, s: number) => ({ body, status: s }) as unknown as Response,
      );
      const c = {
        req: { header: () => '   ' },
        var: {},
        set: vi.fn(),
        get: vi.fn(),
        json,
      } as any;
      const next = vi.fn();

      await middleware(c, next);

      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_DEVICE_ID' }),
        400,
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 400 INVALID_DEVICE_ID for X-Device-Id longer than 256 characters', async () => {
      const app = new Hono<{ Variables: { deviceId?: string } }>();
      app.use('*', injectDeviceId());
      app.get('/test', (c) => {
        return c.json({ deviceId: c.get('deviceId') || null });
      });

      const longStr = 'a'.repeat(257);
      const res = await app.request('/test', {
        headers: { 'X-Device-Id': longStr },
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string; detail: string; status: number };
      expect(body.code).toBe('INVALID_DEVICE_ID');
      expect(body.detail).toBe('The X-Device-Id header must be 256 characters or fewer.');
      expect(body.status).toBe(400);
    });
  });

  describe('X-Device-Platform header', () => {
    it('sets devicePlatform to ios when X-Device-Platform is ios', async () => {
      const app = new Hono<{ Variables: { deviceId?: string; devicePlatform?: string } }>();
      app.use('*', injectDeviceId());
      app.get('/test', (c) => {
        return c.json({
          deviceId: c.get('deviceId') || null,
          devicePlatform: c.get('devicePlatform') || null,
        });
      });

      const res = await app.request('/test', {
        headers: { 'X-Device-Platform': 'ios', 'X-Device-Id': 'test-id' },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { deviceId: string; devicePlatform: string };
      expect(body.devicePlatform).toBe('ios');
    });

    it('sets devicePlatform to android and web', async () => {
      const app = new Hono<{ Variables: { deviceId?: string; devicePlatform?: string } }>();
      app.use('*', injectDeviceId());
      app.get('/test', (c) => {
        return c.json({ devicePlatform: c.get('devicePlatform') || null });
      });

      const res1 = await app.request('/test', {
        headers: { 'X-Device-Platform': 'android', 'X-Device-Id': 'id' },
      });
      expect(res1.status).toBe(200);
      expect(((await res1.json()) as { devicePlatform: string }).devicePlatform).toBe('android');

      const res2 = await app.request('/test', {
        headers: { 'X-Device-Platform': 'web', 'X-Device-Id': 'id' },
      });
      expect(res2.status).toBe(200);
      expect(((await res2.json()) as { devicePlatform: string }).devicePlatform).toBe('web');
    });

    it('silently ignores invalid X-Device-Platform value', async () => {
      const app = new Hono<{ Variables: { deviceId?: string; devicePlatform?: string } }>();
      app.use('*', injectDeviceId());
      app.get('/test', (c) => {
        return c.json({ devicePlatform: c.get('devicePlatform') || null });
      });

      const res = await app.request('/test', {
        headers: { 'X-Device-Platform': 'windows', 'X-Device-Id': 'id' },
      });

      expect(res.status).toBe(200);
      expect(((await res.json()) as { devicePlatform: string | null }).devicePlatform).toBeNull();
    });

    it('silently ignores case-mismatched platform value', async () => {
      const app = new Hono<{ Variables: { deviceId?: string; devicePlatform?: string } }>();
      app.use('*', injectDeviceId());
      app.get('/test', (c) => {
        return c.json({ devicePlatform: c.get('devicePlatform') || null });
      });

      const res = await app.request('/test', {
        headers: { 'X-Device-Platform': 'iOS', 'X-Device-Id': 'id' },
      });

      expect(res.status).toBe(200);
      expect(((await res.json()) as { devicePlatform: string | null }).devicePlatform).toBeNull();
    });

    it('leaves devicePlatform undefined when X-Device-Platform is missing', async () => {
      const app = new Hono<{ Variables: { deviceId?: string; devicePlatform?: string } }>();
      app.use('*', injectDeviceId());
      app.get('/test', (c) => {
        return c.json({ devicePlatform: c.get('devicePlatform') || null });
      });

      const res = await app.request('/test', {
        headers: { 'X-Device-Id': 'test-id' },
      });

      expect(res.status).toBe(200);
      expect(((await res.json()) as { devicePlatform: string | null }).devicePlatform).toBeNull();
    });

    it('sets both deviceId and devicePlatform when both headers present', async () => {
      const app = new Hono<{ Variables: { deviceId?: string; devicePlatform?: string } }>();
      app.use('*', injectDeviceId());
      app.get('/test', (c) => {
        return c.json({
          deviceId: c.get('deviceId') || null,
          devicePlatform: c.get('devicePlatform') || null,
        });
      });

      const res = await app.request('/test', {
        headers: {
          'X-Device-Id': '550e8400-e29b-4a4a-a716-446655440000',
          'X-Device-Platform': 'android',
        },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { deviceId: string; devicePlatform: string };
      expect(body.deviceId).toBe('550e8400-e29b-4a4a-a716-446655440000');
      expect(body.devicePlatform).toBe('android');
    });
  });
});
