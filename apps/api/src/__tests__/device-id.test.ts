import { describe, it, expect } from 'vitest';
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
    it('sets the deviceId variable if X-Device-Id header is present', async () => {
      const app = new Hono<{ Variables: { deviceId?: string } }>();
      app.use('*', injectDeviceId());
      app.get('/test', (c) => {
        return c.json({ deviceId: c.get('deviceId') });
      });

      const res = await app.request('/test', {
        headers: {
          'X-Device-Id': 'my-secret-device',
        },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { deviceId: string | null };
      const expectedHash = await hashDeviceId('my-secret-device');
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
  });
});
