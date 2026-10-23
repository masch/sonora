import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_MAP_ARTIFACT_VERSION, DEFAULT_REMOTE_CONFIG, MAP_REGIONS } from '@sonora/shared';
import app from '../index';

const BINDINGS = {
  MINIMUM_APP_VERSION: '0.0.0',
  BLOCK_OLDER_VERSIONS: 'false',
};

/**
 * A public-bucket double whose `head` answers only for the keys it was given.
 * `head` is all `/config` may do: it publishes what is already uploaded.
 */
function publicBucket(objects: Record<string, number | 'throws' | 'hangs'>) {
  const heads: string[] = [];
  const bucket = {
    head: async (key: string) => {
      heads.push(key);
      const size = objects[key];
      if (size === undefined) return null;
      if (size === 'throws') throw new Error('R2 unavailable');
      if (size === 'hangs') return new Promise<never>(() => {});
      return { key, size };
    },
  };

  return { bucket: bucket as never, heads };
}

const CALAMUCHITA_V1_KEY = 'tiles/calamuchita/v1.pmtiles';

interface MapBody {
  map: {
    renderer: string;
    styleUrl: string;
    regions: Record<
      string,
      { bbox: number[]; label: string; archiveUrl: string; archiveBytes: number }
    >;
    download: {
      preload: string[];
      autoMaxBytes: number;
      cacheMaxBytes: number;
      cellular: string;
    };
  };
}

describe('GET /config', () => {
  it('returns 200 with application/json content type', async () => {
    const res = await app.request('/config', {}, BINDINGS);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });

  it('tells caches the payload depends on both device headers', async () => {
    // The renderer can be overridden per device *and* is gated by platform, so a
    // shared cache that ignored either header would hand one client's answer to
    // another. The app keeps its own copy in storage, so there is nothing to gain
    // from caching this over HTTP.
    const res = await app.request('/config', {}, BINDINGS);

    expect(res.headers.get('vary')).toContain('X-Device-Id');
    expect(res.headers.get('vary')).toContain('X-Device-Platform');
    expect(res.headers.get('cache-control')).toBe('no-store');
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

  it('lists a published region with the size the bucket reports', async () => {
    const { bucket, heads } = publicBucket({ [CALAMUCHITA_V1_KEY]: 4_321_000 });

    const res = await app.request('/config', {}, { ...BINDINGS, PUBLIC_BUCKET: bucket } as never);

    expect(res.status).toBe(200);
    const body = (await res.json()) as MapBody;
    // The bbox travels as numbers and the archive url is derived from the key the
    // head just confirmed, so the client never builds a url out of a variable.
    expect(body.map.regions).toEqual({
      calamuchita: {
        bbox: [-64.83, -32.28, -64.66, -32.12],
        label: 'Valle de Calamuchita',
        archiveUrl: 'http://localhost/media/public/tiles/calamuchita/v1.pmtiles',
        archiveBytes: 4_321_000,
      },
    });
    expect(heads).toEqual([CALAMUCHITA_V1_KEY]);
  });

  it('omits a region whose archive the bucket does not hold', async () => {
    // A region that is not uploaded must never reach the client: it would name a
    // download that cannot finish.
    const { bucket } = publicBucket({});

    const res = await app.request('/config', {}, { ...BINDINGS, PUBLIC_BUCKET: bucket } as never);
    const body = (await res.json()) as MapBody;

    expect(body.map.regions).toEqual({});
    expect(body.map.download.preload).toEqual([]);
  });

  it('keeps a published region when another region is missing', async () => {
    // Two regions in the catalog, one uploaded: the payload carries the one the
    // bucket has and drops the other, instead of failing the whole bootstrap.
    const { bucket } = publicBucket({ [CALAMUCHITA_V1_KEY]: 10 });

    const res = await app.request('/config', {}, { ...BINDINGS, PUBLIC_BUCKET: bucket } as never);
    const body = (await res.json()) as MapBody;

    expect(Object.keys(body.map.regions)).toEqual(['calamuchita']);
  });

  it('treats an unavailable bucket as publishing nothing instead of failing', async () => {
    const { bucket } = publicBucket({ [CALAMUCHITA_V1_KEY]: 'throws' });

    const res = await app.request('/config', {}, { ...BINDINGS, PUBLIC_BUCKET: bucket } as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as MapBody;
    expect(body.map.regions).toEqual({});
  });

  it('derives the archive and style urls from the request origin', async () => {
    const { bucket, heads } = publicBucket({ [CALAMUCHITA_V1_KEY]: 10 });

    const res = await app.fetch(new Request('https://api.example/config'), {
      ...BINDINGS,
      PUBLIC_BUCKET: bucket,
    } as never);
    const body = (await res.json()) as MapBody;

    expect(body.map.styleUrl).toBe('https://api.example/media/public/styles/v1.json');
    expect(body.map.regions.calamuchita.archiveUrl).toBe(
      'https://api.example/media/public/tiles/calamuchita/v1.pmtiles',
    );
    // The urls follow the same version the head read, so publishing v7 needs one
    // variable and no url edits.
    expect(heads).toEqual(['tiles/calamuchita/v1.pmtiles']);
  });

  it('uses MAP_ARTIFACT_VERSION for the head key, the archive url and the style url', async () => {
    const { bucket, heads } = publicBucket({ 'tiles/calamuchita/v7.pmtiles': 10 });

    const res = await app.request('/config', {}, {
      ...BINDINGS,
      MAP_ARTIFACT_VERSION: 'v7',
      PUBLIC_BUCKET: bucket,
    } as never);
    const body = (await res.json()) as MapBody;

    expect(heads).toEqual(['tiles/calamuchita/v7.pmtiles']);
    expect(body.map.regions.calamuchita.archiveUrl).toBe(
      'http://localhost/media/public/tiles/calamuchita/v7.pmtiles',
    );
    expect(body.map.styleUrl).toBe('http://localhost/media/public/styles/v7.json');
  });

  it('falls back to the compiled version when MAP_ARTIFACT_VERSION is unusable', async () => {
    for (const value of ['', '   ', 'v7/../../private', '../v7']) {
      const { bucket, heads } = publicBucket({ [CALAMUCHITA_V1_KEY]: 10 });

      const res = await app.request('/config', {}, {
        ...BINDINGS,
        MAP_ARTIFACT_VERSION: value,
        PUBLIC_BUCKET: bucket,
      } as never);
      const body = (await res.json()) as MapBody;

      expect({ value, heads }).toEqual({ value, heads: [CALAMUCHITA_V1_KEY] });
      expect({ value, styleUrl: body.map.styleUrl }).toEqual({
        value,
        styleUrl: `http://localhost/media/public/styles/${DEFAULT_MAP_ARTIFACT_VERSION}.json`,
      });
    }
  });

  it('sends the download policy: the preload set, the ceiling, the budget and the cellular rule', async () => {
    const { bucket } = publicBucket({ [CALAMUCHITA_V1_KEY]: 4_000_000 });

    const res = await app.request('/config', {}, { ...BINDINGS, PUBLIC_BUCKET: bucket } as never);
    const body = (await res.json()) as MapBody;

    expect(body.map.download).toEqual({
      preload: ['calamuchita'],
      autoMaxBytes: 8_000_000,
      cacheMaxBytes: 100_000_000,
      cellular: 'ask',
    });
  });

  it('takes the preload set from MAP_PRELOAD_REGIONS', async () => {
    const { bucket } = publicBucket({ [CALAMUCHITA_V1_KEY]: 4_000_000 });

    const res = await app.request('/config', {}, {
      ...BINDINGS,
      MAP_PRELOAD_REGIONS: ' calamuchita ',
      PUBLIC_BUCKET: bucket,
    } as never);
    const body = (await res.json()) as MapBody;

    expect(body.map.download.preload).toEqual(['calamuchita']);
  });

  it('never asks a client to preload a region it did not publish', async () => {
    const { bucket } = publicBucket({});

    const res = await app.request('/config', {}, {
      ...BINDINGS,
      MAP_PRELOAD_REGIONS: 'calamuchita',
      PUBLIC_BUCKET: bucket,
    } as never);
    const body = (await res.json()) as MapBody;

    expect(body.map.download.preload).toEqual([]);
  });

  it('publishes no region when no bucket is bound, and still derives the style url', async () => {
    const res = await app.request('/config', {}, BINDINGS);
    const body = (await res.json()) as MapBody;

    expect(body.map.regions).toEqual({});
    expect(body.map.download.preload).toEqual([]);
    expect(body.map.styleUrl).toBe('http://localhost/media/public/styles/v1.json');
  });

  it('answers the bootstrap when the bucket hangs, with an empty catalog', async () => {
    // `/config` bootstraps the app: a bucket that never answers must cost a
    // bounded wait, not the whole startup.
    vi.useFakeTimers();
    try {
      const { bucket } = publicBucket({ [CALAMUCHITA_V1_KEY]: 'hangs' });
      const pending = app.request('/config', {}, { ...BINDINGS, PUBLIC_BUCKET: bucket } as never);
      await vi.advanceTimersByTimeAsync(2_000);
      const res = await pending;
      const body = (await res.json()) as MapBody;

      expect(res.status).toBe(200);
      expect(body.map.regions).toEqual({});
    } finally {
      vi.useRealTimers();
    }
  });

  it('disarms the bucket bound once the lookup answers', async () => {
    // The bound only exists for a bucket that hangs. A lookup that answers first
    // must clear it: an armed timer outlives the response it was protecting and
    // keeps the runtime awake for nothing.
    vi.useFakeTimers();
    try {
      const { bucket } = publicBucket({ [CALAMUCHITA_V1_KEY]: 4_000_000 });
      const res = await app.request('/config', {}, {
        ...BINDINGS,
        PUBLIC_BUCKET: bucket,
      } as never);
      const body = (await res.json()) as MapBody;

      expect(body.map.regions.calamuchita.archiveBytes).toBe(4_000_000);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('sends the renderer and every map field the defaults describe', async () => {
    const res = await app.request('/config', {}, BINDINGS);
    const body = (await res.json()) as MapBody;

    // The route resolves the map payload over the shared defaults, so a field
    // added to DEFAULT_REMOTE_CONFIG.map has to reach the client instead of being
    // dropped by a literal built here.
    expect(Object.keys(body.map).sort()).toEqual(Object.keys(DEFAULT_REMOTE_CONFIG.map).sort());
    expect(body.map.renderer).toBe('leaflet');
    expect(MAP_REGIONS.calamuchita.bbox.split(',').map(Number)).toEqual([
      -64.83, -32.28, -64.66, -32.12,
    ]);
  });

  it('sends map.renderer from MAP_RENDERER', async () => {
    const res = await app.request(
      '/config',
      { headers: { 'X-Device-Platform': 'android' } },
      { ...BINDINGS, MAP_RENDERER: 'maplibre' },
    );
    const body = (await res.json()) as { map: { renderer: string } };
    expect(body.map.renderer).toBe('maplibre');
  });

  it('serves leaflet to the web even when the environment renders maplibre', async () => {
    // The web export does not emit the MapLibre worker, so a browser cannot mount
    // the new map (L37). Capability, not preference: no list can override it.
    const res = await app.request(
      '/config',
      { headers: { 'X-Device-Platform': 'web', 'X-Device-Id': 'device-allowed' } },
      {
        ...BINDINGS,
        MAP_RENDERER: 'maplibre',
        MAP_RENDERER_DEVICE_IDS: 'device-allowed',
        MAP_RENDERER_PLATFORMS: 'android,ios',
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { map: { renderer: string } };
    expect(body.map.renderer).toBe('leaflet');
  });

  it('serves maplibre to android on a maplibre environment', async () => {
    const res = await app.request(
      '/config',
      { headers: { 'X-Device-Platform': 'android' } },
      { ...BINDINGS, MAP_RENDERER: 'maplibre', MAP_RENDERER_PLATFORMS: 'android,ios' },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { map: { renderer: string } };
    expect(body.map.renderer).toBe('maplibre');
  });

  it('serves leaflet to a client that sends no platform header', async () => {
    const res = await app.request(
      '/config',
      {},
      { ...BINDINGS, MAP_RENDERER: 'maplibre', MAP_RENDERER_PLATFORMS: 'android,ios' },
    );
    const body = (await res.json()) as { map: { renderer: string } };
    expect(body.map.renderer).toBe('leaflet');
  });

  it('lets MAP_RENDERER_PLATFORMS turn the new map on for the web', async () => {
    const res = await app.request(
      '/config',
      { headers: { 'X-Device-Platform': 'web' } },
      { ...BINDINGS, MAP_RENDERER: 'maplibre', MAP_RENDERER_PLATFORMS: 'android,ios,web' },
    );
    const body = (await res.json()) as { map: { renderer: string } };
    expect(body.map.renderer).toBe('maplibre');
  });

  it('falls back to leaflet when MAP_RENDERER is unset or unknown', async () => {
    const unset = await app.request(
      '/config',
      { headers: { 'X-Device-Platform': 'android' } },
      BINDINGS,
    );
    const unsetBody = (await unset.json()) as { map: { renderer: string } };
    expect(unsetBody.map.renderer).toBe('leaflet');

    for (const value of ['', 'MapLibre', 'maplibre ', 'webgl']) {
      const res = await app.request(
        '/config',
        { headers: { 'X-Device-Platform': 'android' } },
        { ...BINDINGS, MAP_RENDERER: value },
      );
      const body = (await res.json()) as { map: { renderer: string } };
      expect({ value, renderer: body.map.renderer }).toEqual({ value, renderer: 'leaflet' });
    }
  });

  it('serves maplibre to an allowed device on a leaflet environment', async () => {
    const res = await app.request(
      '/config',
      { headers: { 'X-Device-Id': 'device-allowed', 'X-Device-Platform': 'android' } },
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
      { headers: { 'X-Device-Id': 'device-blocked', 'X-Device-Platform': 'android' } },
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
        { headers: { 'X-Device-Platform': 'android' } },
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
        { headers: { 'X-Device-Id': deviceId, 'X-Device-Platform': 'android' } },
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

  it('does not include grace period fields when env vars are absent', async () => {
    const res = await app.request('/config', {}, BINDINGS);
    const body = (await res.json()) as { appVersion: Record<string, unknown> };
    expect(body.appVersion).not.toHaveProperty('gracePeriodStart');
    expect(body.appVersion).not.toHaveProperty('gracePeriodEnd');
  });

  it('returns default version values when env vars are set to gate-off defaults', async () => {
    const res = await app.request('/config', {}, BINDINGS);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { appVersion: { minimumVersion: string } };
    expect(body.appVersion.minimumVersion).toBe('0.0.0');
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
