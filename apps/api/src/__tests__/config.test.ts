import { describe, it, expect } from 'vitest';
import app from '../index';

const BINDINGS = {
  MINIMUM_APP_VERSION: '0.0.0',
  BLOCK_OLDER_VERSIONS: 'false',
};

describe('GET /config', () => {
  it('returns 200 with application/json content type', async () => {
    const res = await app.request('/config', {}, BINDINGS);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });

  it('returns all RemoteConfigPayload fields with correct types', async () => {
    const res = await app.request('/config', {}, BINDINGS);
    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toHaveProperty('geofence');
    expect(body).toHaveProperty('audio');
    expect(body).toHaveProperty('feedback');
    expect(body).toHaveProperty('appVersion');

    const geofence = body.geofence as Record<string, unknown>;
    expect(geofence).toHaveProperty('bypassGeofence');
    expect(typeof geofence.bypassGeofence).toBe('boolean');

    const tripGeo = (geofence.trip as Record<string, unknown>) ?? {};
    const trackGeo = (geofence.track as Record<string, unknown>) ?? {};
    expect(typeof tripGeo.radiusMeters).toBe('number');
    expect(typeof tripGeo.defaultMode).toBe('string');
    expect(typeof trackGeo.radiusMeters).toBe('number');
    expect(typeof trackGeo.defaultMode).toBe('string');

    const audio = body.audio as Record<string, unknown>;
    expect(typeof audio.rewindOffsetMs).toBe('number');

    const feedback = body.feedback as Record<string, unknown>;
    expect(typeof feedback.syncIntervalSec).toBe('number');

    const appVersion = body.appVersion as Record<string, unknown>;
    expect(typeof appVersion.minimumVersion).toBe('string');
    expect(typeof appVersion.blockOlderVersions).toBe('boolean');
    expect(typeof appVersion.blockOlderVersions).toBe('boolean');
  });

  it('does not include grace period fields when env vars are absent', async () => {
    const res = await app.request('/config', {}, BINDINGS);
    const body = (await res.json()) as { appVersion: Record<string, unknown> };
    expect(body.appVersion).not.toHaveProperty('gracePeriodStart');
    expect(body.appVersion).not.toHaveProperty('gracePeriodEnd');
  });

  it('includes gracePeriodStart and gracePeriodEnd when env vars are set', async () => {
    const bindings = {
      ...BINDINGS,
      GRACE_PERIOD_START: '2026-07-02T00:00:00Z',
      GRACE_PERIOD_END: '2026-07-09T00:00:00Z',
    };
    const res = await app.request('/config', {}, bindings);
    const body = (await res.json()) as {
      appVersion: { gracePeriodStart: string; gracePeriodEnd: string };
    };
    expect(body.appVersion.gracePeriodStart).toBe('2026-07-02T00:00:00Z');
    expect(body.appVersion.gracePeriodEnd).toBe('2026-07-09T00:00:00Z');
  });

  it('returns DEFAULT_REMOTE_CONFIG values', async () => {
    const res = await app.request('/config', {}, BINDINGS);
    const body = (await res.json()) as {
      geofence: {
        trip: { radiusMeters: number; defaultMode: string };
        track: { radiusMeters: number; defaultMode: string };
        bypassGeofence: boolean;
      };
      audio: { rewindOffsetMs: number };
      feedback: { syncIntervalSec: number };
      appVersion: {
        minimumVersion: string;
        blockOlderVersions: boolean;
      };
    };

    expect(body.geofence.trip.radiusMeters).toBe(50);
    expect(body.geofence.trip.defaultMode).toBe('type');
    expect(body.geofence.track.radiusMeters).toBe(50);
    expect(body.geofence.track.defaultMode).toBe('type');
    expect(body.geofence.bypassGeofence).toBe(false);
    expect(body.audio.rewindOffsetMs).toBe(10000);
    expect(body.feedback.syncIntervalSec).toBe(30);
    expect(body.appVersion.minimumVersion).toBe('0.0.0');
    expect(body.appVersion.blockOlderVersions).toBe(false);
  });

  it('has no null values in any field (recursive)', async () => {
    const res = await app.request('/config', {}, BINDINGS);
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

  it('returns default version values when env vars are set to gate-off defaults', async () => {
    const res = await app.request('/config', {}, BINDINGS);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { appVersion: { minimumVersion: string } };
    expect(body.appVersion.minimumVersion).toBe('0.0.0');
  });

  it('includes CORS headers when Origin is present', async () => {
    const req = new Request('http://localhost/config', {
      headers: { Origin: 'https://sonora.app' },
    });
    const res = await app.fetch(req, BINDINGS);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://sonora.app');
  });
});
