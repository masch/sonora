import { describe, it, expect } from 'vitest';
import app from '../index';

describe('GET /config', () => {
  it('returns 200 with application/json content type', async () => {
    const res = await app.request('/config');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });

  it('returns all RemoteConfigPayload fields with correct types', async () => {
    const res = await app.request('/config');
    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toHaveProperty('geofence');
    expect(body).toHaveProperty('audio');
    expect(body).toHaveProperty('feedback');

    const geofence = body.geofence as Record<string, unknown>;
    expect(geofence).toHaveProperty('bypassGeofence');
    expect(typeof geofence.radiusMeters).toBe('number');

    expect(typeof geofence.bypassGeofence).toBe('boolean');

    const audio = body.audio as Record<string, unknown>;
    expect(typeof audio.rewindOffsetMs).toBe('number');

    const feedback = body.feedback as Record<string, unknown>;
    expect(typeof feedback.syncIntervalSec).toBe('number');
  });

  it('returns DEFAULT_REMOTE_CONFIG values', async () => {
    const res = await app.request('/config');
    const body = (await res.json()) as {
      geofence: { radiusMeters: number; bypassGeofence: boolean };
      audio: { rewindOffsetMs: number };
      feedback: { syncIntervalSec: number };
    };

    expect(body.geofence.radiusMeters).toBe(50);
    expect(body.geofence.bypassGeofence).toBe(false);
    expect(body.audio.rewindOffsetMs).toBe(10000);
    expect(body.feedback.syncIntervalSec).toBe(30);
  });

  it('has no null values in any field (recursive)', async () => {
    const res = await app.request('/config');
    const body = (await res.json()) as Record<string, unknown>;

    const checkNoNull = (obj: Record<string, unknown>, path: string): void => {
      for (const [key, value] of Object.entries(obj)) {
        expect(`${path}.${key}`).toBeDefined();
        expect(value).not.toBeNull();
        if (typeof value === 'object' && value !== null) {
          checkNoNull(value as Record<string, unknown>, `${path}.${key}`);
        }
      }
    };

    checkNoNull(body, '');
  });

  it('is stateless — responds without bindings', async () => {
    const res = await app.request('/config');
    expect(res.status).toBe(200);
    // Static endpoint — no DB, KV, or external calls needed
  });

  it('includes CORS headers when Origin is present', async () => {
    const req = new Request('http://localhost/config', {
      headers: { Origin: 'https://sonora.app' },
    });
    const res = await app.fetch(req, {} as never);
    // In permissive mode (no ALLOWED_ORIGIN), origin should be echoed back
    expect(res.headers.get('access-control-allow-origin')).toBe('https://sonora.app');
  });
});
