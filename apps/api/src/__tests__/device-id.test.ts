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
    it('sets the deviceId variable if X-Device-Id header is a valid UUID v4', async () => {
      const app = new Hono<{ Variables: { deviceId?: string } }>();
      app.use('*', injectDeviceId());
      app.get('/test', (c) => {
        return c.json({ deviceId: c.get('deviceId') });
      });

      const validUuid = '550e8400-e29b-4a4a-a716-446655440000';
      const res = await app.request('/test', {
        headers: {
          'X-Device-Id': validUuid,
        },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { deviceId: string | null };
      const expectedHash = await hashDeviceId(validUuid);
      expect(body.deviceId).toBe(expectedHash);
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

    it('returns 400 INVALID_DEVICE_ID for empty string X-Device-Id header', async () => {
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
      expect(body.detail).toBe('The X-Device-Id header must be a valid UUID v4.');
      expect(body.status).toBe(400);
    });

    it('returns 400 INVALID_DEVICE_ID for whitespace-only value (direct middleware call)', async () => {
      // HTTP headers are trimmed per RFC 7230, so Hono never delivers
      // whitespace-only values. This test calls the middleware directly
      // to cover the internal whitespace check.
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
      expect(body.detail).toBe('The X-Device-Id header must be a valid UUID v4.');
      expect(body.status).toBe(400);
    });

    it('returns 400 INVALID_DEVICE_ID for non-UUID X-Device-Id header', async () => {
      const app = new Hono<{ Variables: { deviceId?: string } }>();
      app.use('*', injectDeviceId());
      app.get('/test', (c) => {
        return c.json({ deviceId: c.get('deviceId') || null });
      });

      const res = await app.request('/test', {
        headers: { 'X-Device-Id': 'not-a-uuid' },
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string; detail: string; status: number };
      expect(body.code).toBe('INVALID_DEVICE_ID');
      expect(body.detail).toBe('The X-Device-Id header must be a valid UUID v4.');
      expect(body.status).toBe(400);
    });
  });
});
