import { describe, it, expect } from 'vitest';
import {
  RemoteConfigPayloadSchema,
  RemoteConfigAppVersionSchema,
  RemoteConfigSocialSchema,
  DEFAULT_REMOTE_CONFIG,
  type RemoteConfigPayload,
} from '../schemas/config';

const fullPayload: RemoteConfigPayload = {
  geofence: {
    trip: { radiusMeters: 50, defaultMode: 'formatDefaultRadius' },
    track: { radiusMeters: 50, defaultMode: 'formatDefaultRadius' },
    bypassGeofence: false,
    bypassIosBrowser: true,
  },
  audio: { rewindOffsetMs: 10000 },
  feedback: { syncIntervalSec: 30 },
  appVersion: {
    minimumVersion: '1.0.0',
    blockOlderVersions: true,
    gracePeriodStart: '2026-07-02T00:00:00Z',
    gracePeriodEnd: '2026-07-09T00:00:00Z',
  },
  social: {
    instagramHandle: 'sonora.derivapoetica',
  },
  map: {
    renderer: 'leaflet',
    styleUrl: 'https://api.example/media/public/styles/v1.json',
    regions: {
      calamuchita: {
        bbox: [-64.83, -32.28, -64.66, -32.12],
        label: 'Valle de Calamuchita',
        archiveUrl: 'https://api.example/media/public/tiles/calamuchita/v1.pmtiles',
        archiveBytes: 1_234_567,
      },
    },
    download: {
      preload: ['calamuchita'],
      autoMaxBytes: 8_000_000,
      cacheMaxBytes: 100_000_000,
      cellular: 'ask',
    },
    layers: { showControl: false, groups: [] },
  },
};

describe('RemoteConfigPayloadSchema', () => {
  describe('per-format geofence shape (GEOF.1)', () => {
    it('defaults: trip radiusMeters 100 / defaultMode type, track present & positive', () => {
      expect(DEFAULT_REMOTE_CONFIG.geofence.trip.radiusMeters).toBe(100);
      expect(DEFAULT_REMOTE_CONFIG.geofence.trip.defaultMode).toBe('formatDefaultRadius');
      expect(DEFAULT_REMOTE_CONFIG.geofence.track.radiusMeters).toBeGreaterThan(0);
      expect(DEFAULT_REMOTE_CONFIG.geofence.track.defaultMode).toBe('formatDefaultRadius');
      expect(DEFAULT_REMOTE_CONFIG.geofence.bypassGeofence).toBe(false);
      expect(DEFAULT_REMOTE_CONFIG.geofence.bypassIosBrowser).toBe(true);
    });

    it('preserves all fields on parse', () => {
      const result = RemoteConfigPayloadSchema.parse(fullPayload);
      expect(result).toEqual(fullPayload);
    });

    it('rejects empty payload (no defaults in schema)', () => {
      const result = RemoteConfigPayloadSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('rejects non-positive trip.radiusMeters', () => {
      const schema = RemoteConfigPayloadSchema.shape.geofence.shape.trip.shape.radiusMeters;
      expect(schema.safeParse(-10).success).toBe(false);
      expect(schema.safeParse(0).success).toBe(false);
    });

    it('rejects non-positive track.radiusMeters', () => {
      const schema = RemoteConfigPayloadSchema.shape.geofence.shape.track.shape.radiusMeters;
      expect(schema.safeParse(-1).success).toBe(false);
      expect(schema.safeParse(0).success).toBe(false);
    });

    it('rejects invalid trip.defaultMode', () => {
      const schema = RemoteConfigPayloadSchema.shape.geofence.shape.trip.shape.defaultMode;
      expect(schema.safeParse('off').success).toBe(false);
    });

    it('rejects invalid track.defaultMode', () => {
      const schema = RemoteConfigPayloadSchema.shape.geofence.shape.track.shape.defaultMode;
      expect(schema.safeParse('off').success).toBe(false);
    });

    it('rejects non-number radiusMeters', () => {
      const schema = RemoteConfigPayloadSchema.shape.geofence.shape.trip.shape.radiusMeters;
      expect(schema.safeParse('fifty').success).toBe(false);
    });

    it('rejects non-boolean bypassGeofence', () => {
      const schema = RemoteConfigPayloadSchema.shape.geofence.shape.bypassGeofence;
      expect(schema.safeParse('yes').success).toBe(false);
    });
  });

  describe('audio / feedback', () => {
    it('rejects negative rewindOffsetMs', () => {
      const schema = RemoteConfigPayloadSchema.shape.audio.shape.rewindOffsetMs;
      expect(schema.safeParse(-1).success).toBe(false);
    });

    it('rejects negative syncIntervalSec', () => {
      const schema = RemoteConfigPayloadSchema.shape.feedback.shape.syncIntervalSec;
      expect(schema.safeParse(-5).success).toBe(false);
    });
  });

  describe('appVersion', () => {
    it('parses valid appVersion', () => {
      const result = RemoteConfigPayloadSchema.safeParse(fullPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.appVersion.minimumVersion).toBe('1.0.0');
        expect(result.data.appVersion.blockOlderVersions).toBe(true);
        expect(result.data.appVersion.gracePeriodStart).toBe('2026-07-02T00:00:00Z');
        expect(result.data.appVersion.gracePeriodEnd).toBe('2026-07-09T00:00:00Z');
      }
    });

    it('parses appVersion without grace periods (optional)', () => {
      const payload: RemoteConfigPayload = {
        geofence: {
          trip: { radiusMeters: 50, defaultMode: 'formatDefaultRadius' },
          track: { radiusMeters: 50, defaultMode: 'formatDefaultRadius' },
          bypassGeofence: false,
          bypassIosBrowser: true,
        },
        audio: { rewindOffsetMs: 10000 },
        feedback: { syncIntervalSec: 30 },
        appVersion: { minimumVersion: '1.0.0', blockOlderVersions: true },
        social: { instagramHandle: 'sonora.derivapoetica' },
        map: fullPayload.map,
      };
      const result = RemoteConfigPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.appVersion.gracePeriodStart).toBeUndefined();
        expect(result.data.appVersion.gracePeriodEnd).toBeUndefined();
      }
    });

    it('rejects non-boolean bypassIosBrowser', () => {
      const schema = RemoteConfigPayloadSchema.shape.geofence.shape.bypassIosBrowser;
      expect(schema.safeParse('yes').success).toBe(false);
    });

    it('rejects non-string gracePeriodStart', () => {
      const schema = RemoteConfigAppVersionSchema.shape.gracePeriodStart;
      expect(schema.safeParse(123).success).toBe(false);
    });

    it('rejects empty minimumVersion string', () => {
      const schema = RemoteConfigAppVersionSchema.shape.minimumVersion;
      expect(schema.safeParse('').success).toBe(false);
    });

    it('rejects non-boolean blockOlderVersions', () => {
      const schema = RemoteConfigAppVersionSchema.shape.blockOlderVersions;
      expect(schema.safeParse('yes').success).toBe(false);
    });
  });

  describe('social configuration', () => {
    it('defaults instagramHandle to sonora.derivapoetica', () => {
      expect(DEFAULT_REMOTE_CONFIG.social.instagramHandle).toBe('sonora.derivapoetica');
    });

    it('rejects empty instagramHandle', () => {
      const schema = RemoteConfigSocialSchema.shape.instagramHandle;
      expect(schema.safeParse('').success).toBe(false);
    });

    it('accepts valid instagramHandle', () => {
      const schema = RemoteConfigSocialSchema.shape.instagramHandle;
      expect(schema.safeParse('sonora.derivapoetica').success).toBe(true);
    });
  });

  describe('map catalog, renderer and download policy', () => {
    const withMap = (map: Record<string, unknown>): Record<string, unknown> => ({
      ...fullPayload,
      map,
    });

    const region = {
      bbox: [-64.83, -32.28, -64.66, -32.12],
      label: 'Valle de Calamuchita',
      archiveUrl: 'https://api.example/media/public/tiles/calamuchita/v1.pmtiles',
      archiveBytes: 1_234_567,
    };

    const download = {
      preload: ['calamuchita'],
      autoMaxBytes: 8_000_000,
      cacheMaxBytes: 100_000_000,
      cellular: 'ask',
    };

    it('parses the region catalog with numeric bboxes and a size per region', () => {
      const result = RemoteConfigPayloadSchema.safeParse(fullPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.map.regions.calamuchita).toEqual(region);
        expect(result.data.map.download).toEqual(download);
        expect(result.data.map.styleUrl).toBe('https://api.example/media/public/styles/v1.json');
      }
    });

    it('accepts an empty catalog, which is what an environment with nothing published sends', () => {
      const result = RemoteConfigPayloadSchema.safeParse(
        withMap({
          renderer: 'leaflet',
          styleUrl: '',
          regions: {},
          download: { ...download, preload: [] },
        }),
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.map.regions).toEqual({});
        expect(result.data.map.download.preload).toEqual([]);
      }
    });

    it('rejects a map payload with no region catalog and no download policy', () => {
      // Not about the stray keys: `map` tolerates those (proven above). What is
      // missing here is required — no `regions` and no `download` — and that is
      // what the rejection is about.
      const result = RemoteConfigPayloadSchema.safeParse(
        withMap({
          archiveUrl: 'https://api.example/media/public/tiles/calamuchita/v1.pmtiles',
          styleUrl: 'https://api.example/media/public/styles/v1.json',
          renderer: 'leaflet',
        }),
      );
      expect(result.success).toBe(false);
    });

    it('tolerates a stray map-level field and keeps the complete catalog', () => {
      // Reversed by forward tolerance: `map` is `.passthrough()`, so an unknown
      // sibling is carried through the parse instead of costing the client the
      // catalog it did understand. It is never read, but it is kept — not
      // dropped — which is what the parsed object below would show.
      const result = RemoteConfigPayloadSchema.safeParse(
        withMap({
          archiveUrl: 'https://api.example/media/public/tiles/calamuchita/v1.pmtiles',
          styleUrl: '',
          renderer: 'leaflet',
          regions: { calamuchita: region },
          download,
        }),
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.map.regions).toEqual({ calamuchita: region });
        expect(result.data.map.download).toEqual(download);
      }
    });

    it('tolerates a nested field this build does not know and keeps the rest of map intact', () => {
      // The compatibility guarantee: the server may add a field to `map` before
      // every published build knows it. Rejecting the whole object would cost an
      // old build its renderer, the region catalog and the download policy.
      const result = RemoteConfigPayloadSchema.safeParse(
        withMap({ ...fullPayload.map, futureField: { anything: true } }),
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.map.renderer).toBe(fullPayload.map.renderer);
        expect(result.data.map.styleUrl).toBe(fullPayload.map.styleUrl);
        expect(result.data.map.regions).toEqual(fullPayload.map.regions);
        expect(result.data.map.download).toEqual(fullPayload.map.download);
      }
    });

    it('accepts a layer group the build does not implement yet', () => {
      // `id` is an open string, not an enum: the server can announce a group
      // before the app knows it, and the consumer ignores what it cannot draw.
      const result = RemoteConfigPayloadSchema.safeParse(
        withMap({
          ...fullPayload.map,
          layers: { showControl: true, groups: [{ id: 'future-group', defaultVisible: false }] },
        }),
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.map.layers).toEqual({
          showControl: true,
          groups: [{ id: 'future-group', defaultVisible: false }],
        });
      }
    });

    it('hides the layer control and lists no groups when the payload omits layers', () => {
      const { layers: _layers, ...mapWithoutLayers } = fullPayload.map;
      const result = RemoteConfigPayloadSchema.safeParse(withMap(mapWithoutLayers));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.map.layers).toEqual({ showControl: false, groups: [] });
      }
      expect(DEFAULT_REMOTE_CONFIG.map.layers).toEqual({ showControl: false, groups: [] });
    });

    it('rejects a region whose bbox is still the string the tooling reads', () => {
      const result = RemoteConfigPayloadSchema.safeParse(
        withMap({
          renderer: 'leaflet',
          styleUrl: '',
          regions: { calamuchita: { ...region, bbox: '-64.83,-32.28,-64.66,-32.12' } },
          download,
        }),
      );
      expect(result.success).toBe(false);
    });

    it('rejects a bbox that is not four numbers', () => {
      const bboxSchema = RemoteConfigPayloadSchema.shape.map.shape.regions;
      for (const bbox of [[1, 2, 3], [1, 2, 3, '4'], []]) {
        const result = bboxSchema.safeParse({ calamuchita: { ...region, bbox } });
        expect({ bbox, success: result.success }).toEqual({ bbox, success: false });
      }
    });

    it('rejects a region with no archive url, no label or a negative size', () => {
      const regionsSchema = RemoteConfigPayloadSchema.shape.map.shape.regions;
      const invalid = [
        { ...region, archiveUrl: '' },
        { ...region, label: '' },
        { ...region, archiveBytes: -1 },
        { ...region, archiveBytes: 1.5 },
      ];
      for (const entry of invalid) {
        const result = regionsSchema.safeParse({ calamuchita: entry });
        expect({ entry, success: result.success }).toEqual({ entry, success: false });
      }
    });

    it('keeps maplibre when the payload asks for it', () => {
      const result = RemoteConfigPayloadSchema.safeParse(
        withMap({ ...fullPayload.map, renderer: 'maplibre' }),
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.map.renderer).toBe('maplibre');
      }
    });

    it('rejects an unknown renderer value instead of defaulting it', () => {
      // The schema rejects; the API normalizes at the edge, so a rejected value
      // never travels. Asserted here so the choice is pinned.
      const result = RemoteConfigPayloadSchema.safeParse(
        withMap({ ...fullPayload.map, renderer: 'webgl' }),
      );
      expect(result.success).toBe(false);
    });

    it('rejects a cellular policy outside ask, auto and never', () => {
      const result = RemoteConfigPayloadSchema.safeParse(
        withMap({ ...fullPayload.map, download: { ...download, cellular: 'wifi' } }),
      );
      expect(result.success).toBe(false);
    });

    it('rejects a non-positive download budget', () => {
      const downloadSchema = RemoteConfigPayloadSchema.shape.map.shape.download;
      for (const value of [0, -1]) {
        expect({
          value,
          ok: downloadSchema.safeParse({ ...download, autoMaxBytes: value }).success,
        }).toEqual({
          value,
          ok: false,
        });
        expect({
          value,
          ok: downloadSchema.safeParse({ ...download, cacheMaxBytes: value }).success,
        }).toEqual({
          value,
          ok: false,
        });
      }
    });

    it('ships leaflet, an empty catalog and the agreed download numbers as defaults', () => {
      expect(DEFAULT_REMOTE_CONFIG.map.renderer).toBe('leaflet');
      expect(DEFAULT_REMOTE_CONFIG.map.regions).toEqual({});
      expect(DEFAULT_REMOTE_CONFIG.map.download).toEqual({
        preload: ['calamuchita'],
        autoMaxBytes: 8_000_000,
        cacheMaxBytes: 100_000_000,
        cellular: 'ask',
      });
    });
  });

  describe('TypeScript types', () => {
    it('DEFAULT_REMOTE_CONFIG satisfies RemoteConfigPayload', () => {
      const check: RemoteConfigPayload = DEFAULT_REMOTE_CONFIG;
      expect(check.geofence.bypassGeofence).toBe(false);
      expect(check.geofence.trip.defaultMode).toBe('formatDefaultRadius');
      expect(check.geofence.track.defaultMode).toBe('formatDefaultRadius');
      expect(check.social.instagramHandle).toBe('sonora.derivapoetica');
    });
  });
});
