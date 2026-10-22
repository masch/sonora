import { z } from 'zod';
import { GEO_MODES } from '../geo/proximity';
import { DEFAULT_MAP_ARTIFACT_VERSION } from '../map/artifacts';
import { DEFAULT_MAP_REGION } from '../map/regions';

export const RemoteConfigAppVersionSchema = z.object({
  minimumVersion: z.string().min(1),
  blockOlderVersions: z.boolean(),
  gracePeriodStart: z.string().optional(),
  gracePeriodEnd: z.string().optional(),
});

export const RemoteConfigSocialSchema = z.object({
  instagramHandle: z.string().min(1),
});

/** Map implementations a build can mount. `leaflet` is the historical one. */
export const MAP_RENDERERS = ['leaflet', 'maplibre'] as const;

export const MapRendererSchema = z.enum(MAP_RENDERERS);

export type MapRenderer = z.infer<typeof MapRendererSchema>;

/** What the app may do on a metered connection. */
export const MAP_CELLULAR_POLICIES = ['ask', 'auto', 'never'] as const;

export const MapCellularPolicySchema = z.enum(MAP_CELLULAR_POLICIES);

export type MapCellularPolicy = z.infer<typeof MapCellularPolicySchema>;

/**
 * One published region: the box it covers, its label, the archive the app draws
 * it from and how many bytes that archive is.
 *
 * The bbox is numeric here, not the `w,s,e,n` string the tooling reads, so the
 * client never parses it. Strict, because the shape broke cleanly (S3): a
 * payload that still carries a legacy field has nowhere to put it, and accepting
 * it silently would mean the client trusts a shape the server no longer serves.
 */
export const MapRegionPayloadSchema = z
  .object({
    bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    label: z.string().min(1),
    archiveUrl: z.string().min(1),
    archiveBytes: z.number().int().nonnegative(),
  })
  .strict();

export type MapRegionPayload = z.infer<typeof MapRegionPayloadSchema>;

/**
 * When and how much the app downloads without asking.
 *
 * Every value is a config value (S4): the silent ceiling, the cache budget and
 * the cellular policy are adjustable without a release.
 */
export const MapDownloadPolicySchema = z
  .object({
    /** Regions the app prefetches at startup, named by the server, never guessed. */
    preload: z.array(z.string().min(1)),
    /** Ceiling for a silent download, WiFi included. */
    autoMaxBytes: z.number().positive(),
    /** Budget the downloaded archives may occupy on the device. */
    cacheMaxBytes: z.number().positive(),
    cellular: MapCellularPolicySchema,
  })
  .strict();

export type MapDownloadPolicy = z.infer<typeof MapDownloadPolicySchema>;

/**
 * The catalog of published regions plus the renderer and download policy.
 *
 * `regions` is keyed by region (`calamuchita`) and holds only what the server
 * confirmed is published: an archive the bucket does not have never reaches a
 * client that would fail to download it.
 */
export const MapConfigSchema = z
  .object({
    renderer: MapRendererSchema,
    styleUrl: z.string(),
    regions: z.record(z.string(), MapRegionPayloadSchema),
    download: MapDownloadPolicySchema,
  })
  .strict();

export type MapConfig = z.infer<typeof MapConfigSchema>;

export const RemoteConfigPayloadSchema = z.object({
  geofence: z.object({
    trip: z.object({
      radiusMeters: z.number().positive(),
      defaultMode: z.enum(GEO_MODES),
    }),
    track: z.object({
      radiusMeters: z.number().positive(),
      defaultMode: z.enum(GEO_MODES),
    }),
    bypassGeofence: z.boolean(),
    bypassIosBrowser: z.boolean().default(true),
  }),
  audio: z.object({
    rewindOffsetMs: z.number().positive(),
  }),
  feedback: z.object({
    syncIntervalSec: z.number().positive(),
  }),
  appVersion: RemoteConfigAppVersionSchema,
  social: RemoteConfigSocialSchema,
  /** Public map catalog. An empty `regions` means nothing is published yet. */
  map: MapConfigSchema,
});

export type RemoteConfigPayload = z.infer<typeof RemoteConfigPayloadSchema>;

export const DEFAULT_REMOTE_CONFIG: RemoteConfigPayload = {
  geofence: {
    trip: { radiusMeters: 100, defaultMode: 'formatDefaultRadius' },
    track: { radiusMeters: 300, defaultMode: 'formatDefaultRadius' },
    bypassGeofence: false,
    bypassIosBrowser: true,
  },
  audio: { rewindOffsetMs: 10000 },
  feedback: { syncIntervalSec: 30 },
  appVersion: { minimumVersion: '0.0.0', blockOlderVersions: false },
  social: {
    instagramHandle: 'sonora.derivapoetica',
  },
  // The client floor carries no artifact url: the archive url is per region and
  // every region the server publishes is resolved at `/config` time. The
  // renderer here is only overridden by the build's own choice in the store.
  map: {
    renderer: 'leaflet',
    styleUrl: '',
    regions: {},
    download: {
      preload: [DEFAULT_MAP_REGION],
      autoMaxBytes: 8_000_000,
      cacheMaxBytes: 100_000_000,
      cellular: 'ask',
    },
  },
};

/**
 * Artifact version the server derives the urls from when the environment does
 * not name one. Re-exported here so the schema and the route agree.
 */
export { DEFAULT_MAP_ARTIFACT_VERSION };
