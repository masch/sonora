import { describe, it, expect } from 'vitest';
import { DEFAULT_REMOTE_CONFIG } from '@sonora/shared';
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
    expect(geofence).toHaveProperty('bypassIosBrowser');
    expect(typeof geofence.bypassIosBrowser).toBe('boolean');

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
  });

  it('honors BYPASS_GEOFENCE_IOS_BROWSER env override', async () => {
    const resOff = await app.request(
      '/config',
      {},
      { ...BINDINGS, BYPASS_GEOFENCE_IOS_BROWSER: 'false' },
    );
    const bodyOff = (await resOff.json()) as { geofence: { bypassIosBrowser: boolean } };
    expect(bodyOff.geofence.bypassIosBrowser).toBe(false);

    const resOn = await app.request(
      '/config',
      {},
      { ...BINDINGS, BYPASS_GEOFENCE_IOS_BROWSER: 'true' },
    );
    const bodyOn = (await resOn.json()) as { geofence: { bypassIosBrowser: boolean } };
    expect(bodyOn.geofence.bypassIosBrowser).toBe(true);
  });

  it('honors MAP_ARCHIVE_URL and MAP_STYLE_URL env overrides', async () => {
    const res = await app.request(
      '/config',
      {},
      {
        ...BINDINGS,
        MAP_ARCHIVE_URL: 'https://api.example/media/public/tiles/calamuchita/v1.pmtiles',
        MAP_STYLE_URL: 'https://api.example/media/public/styles/v1.json',
      },
    );
    const body = (await res.json()) as { map: { archiveUrl: string; styleUrl: string } };
    expect(body.map.archiveUrl).toBe(
      'https://api.example/media/public/tiles/calamuchita/v1.pmtiles',
    );
    expect(body.map.styleUrl).toBe('https://api.example/media/public/styles/v1.json');
  });

  it('sends map.renderer from MAP_RENDERER', async () => {
    const res = await app.request('/config', {}, { ...BINDINGS, MAP_RENDERER: 'maplibre' });
    const body = (await res.json()) as { map: { renderer: string } };
    expect(body.map.renderer).toBe('maplibre');
  });

  it('falls back to leaflet when MAP_RENDERER is unset or unknown', async () => {
    const unset = await app.request('/config', {}, BINDINGS);
    const unsetBody = (await unset.json()) as { map: { renderer: string } };
    expect(unsetBody.map.renderer).toBe('leaflet');

    for (const value of ['', 'MapLibre', 'maplibre ', 'webgl']) {
      const res = await app.request('/config', {}, { ...BINDINGS, MAP_RENDERER: value });
      const body = (await res.json()) as { map: { renderer: string } };
      expect({ value, renderer: body.map.renderer }).toEqual({ value, renderer: 'leaflet' });
    }
  });

  it('serves maplibre to an allowed device on a leaflet environment', async () => {
    const res = await app.request(
      '/config',
      { headers: { 'X-Device-Id': 'device-allowed' } },
      {
        ...BINDINGS,
        MAP_RENDERER: 'leaflet',
        MAP_RENDERER_DEVICE_IDS: 'device-allowed',
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { map: { renderer: string } };
    expect(body.map.renderer).toBe('maplibre');
  });

  it('serves leaflet to a blocked device on a maplibre environment', async () => {
    const res = await app.request(
      '/config',
      { headers: { 'X-Device-Id': 'device-blocked' } },
      {
        ...BINDINGS,
        MAP_RENDERER: 'maplibre',
        MAP_RENDERER_DEVICE_IDS_BLOCKED: 'device-blocked',
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { map: { renderer: string } };
    expect(body.map.renderer).toBe('leaflet');
  });

  it('sends the plain environment renderer when the device header is absent', async () => {
    for (const renderer of ['leaflet', 'maplibre'] as const) {
      const res = await app.request(
        '/config',
        {},
        {
          ...BINDINGS,
          MAP_RENDERER: renderer,
          MAP_RENDERER_DEVICE_IDS: 'device-allowed',
          MAP_RENDERER_DEVICE_IDS_BLOCKED: 'device-blocked',
        },
      );
      const body = (await res.json()) as { map: { renderer: string } };
      expect({ renderer, served: body.map.renderer }).toEqual({ renderer, served: renderer });
    }
  });

  it('ignores a header no list knows without failing the bootstrap', async () => {
    for (const deviceId of ['{"garbage":true}', 'unknown-device', 'not a hash at all']) {
      const res = await app.request(
        '/config',
        { headers: { 'X-Device-Id': deviceId } },
        {
          ...BINDINGS,
          MAP_RENDERER: 'maplibre',
          MAP_RENDERER_DEVICE_IDS: 'device-allowed',
          MAP_RENDERER_DEVICE_IDS_BLOCKED: 'device-blocked',
        },
      );
      expect({ deviceId, status: res.status }).toEqual({ deviceId, status: 200 });
      const body = (await res.json()) as { map: { renderer: string } };
      expect({ deviceId, served: body.map.renderer }).toEqual({ deviceId, served: 'maplibre' });
    }
  });

  it('sends empty map urls when the environment publishes no artifacts', async () => {
    const res = await app.request('/config', {}, BINDINGS);
    const body = (await res.json()) as { map: { archiveUrl: string; styleUrl: string } };
    expect(body.map.archiveUrl).toBe('');
    expect(body.map.styleUrl).toBe('');
  });

  it('keeps every default map field in the response', async () => {
    const res = await app.request(
      '/config',
      {},
      {
        ...BINDINGS,
        MAP_ARCHIVE_URL: 'https://api.example/media/public/tiles/calamuchita/v1.pmtiles',
        MAP_STYLE_URL: 'https://api.example/media/public/styles/v1.json',
      },
    );
    const body = (await res.json()) as { map: Record<string, unknown> };
    // The route resolves the map payload field by field over the shared defaults,
    // so a field added to DEFAULT_REMOTE_CONFIG.map has to reach the client
    // instead of being dropped by a literal built here.
    expect(Object.keys(body.map).sort()).toEqual(
      Object.keys(DEFAULT_REMOTE_CONFIG.map ?? {}).sort(),
    );
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
        bypassIosBrowser: boolean;
      };
      audio: { rewindOffsetMs: number };
      feedback: { syncIntervalSec: number };
      appVersion: {
        minimumVersion: string;
        blockOlderVersions: boolean;
      };
    };

    expect(body.geofence.trip.radiusMeters).toBe(100);
    expect(body.geofence.trip.defaultMode).toBe('formatDefaultRadius');
    expect(body.geofence.track.radiusMeters).toBe(300);
    expect(body.geofence.track.defaultMode).toBe('formatDefaultRadius');
    expect(body.geofence.bypassGeofence).toBe(false);
    expect(body.geofence.bypassIosBrowser).toBe(true);
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
