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
export const MapRegionPayloadSchema = z.strictObject({
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  label: z.string().min(1),
  archiveUrl: z.string().min(1),
  archiveBytes: z.number().int().nonnegative(),
});

export type MapRegionPayload = z.infer<typeof MapRegionPayloadSchema>;

/**
 * When and how much the app downloads without asking.
 *
 * Every value is a config value (S4): the silent ceiling, the cache budget and
 * the cellular policy are adjustable without a release.
 */
export const MapDownloadPolicySchema = z.strictObject({
  /** Regions the app prefetches at startup, named by the server, never guessed. */
  preload: z.array(z.string().min(1)),
  /** Ceiling for a silent download, WiFi included. */
  autoMaxBytes: z.number().positive(),
  /** Budget the downloaded archives may occupy on the device. */
  cacheMaxBytes: z.number().positive(),
  cellular: MapCellularPolicySchema,
});

export type MapDownloadPolicy = z.infer<typeof MapDownloadPolicySchema>;

/**
 * One group of basemap layers a client can show or hide. `id` is an open string,
 * not an enum: the server may announce a group before every published build knows
 * it, so validation must accept it and the consumer ignores what it does not
 * implement. Freezing the list here would turn a forward-compatible payload into a
 * rejected one.
 */
export const MapLayerGroupSchema = z.object({
  id: z.string().min(1),
  /** Draws it when the experience opens; the control can still switch it. */
  defaultVisible: z.boolean().default(true),
});

/**
 * Deliberately not strict. A mistyped key inside a selection is dropped and the
 * documented default applies, which errs towards hiding the control rather than
 * drawing something nobody asked for; making it strict would resurrect, one level
 * deeper, the whole-object rejection this contract exists to prevent.
 */
export const MapLayerSelectionSchema = z.object({
  /**
   * Whether the selector is offered at all. Off by default: the control does not
   * exist yet in every published build, and a payload must never change behaviour
   * the app did not ship.
   */
  showControl: z.boolean().default(false),
  /** Order is the server's: the control renders it as received. */
  groups: z.array(MapLayerGroupSchema).default([]),
});

/**
 * The catalog of published regions plus the renderer and download policy.
 *
 * `regions` is keyed by region (`calamuchita`) and holds only what the server
 * confirmed is published: an archive the bucket does not have never reaches a
 * client that would fail to download it.
 *
 * Passthrough, not strict, on purpose. The store validates every top-level field
 * of `/config` on its own and keeps the default for the ones that fail, so a
 * strict `map` meant a field this build has never heard of discarded the whole
 * object: an old build lost its renderer, its region catalog and its download
 * policy the moment the server added a nested field. An unknown key is tolerated
 * and carried instead: it travels in the parsed output — the mobile store
 * persists it into the config cache as it does every field — but nothing reads
 * it, so it costs nothing, which is what makes adding a field safe. Rejecting it
 * cost the whole object.
 *
 * `layers` is deliberately absent from the wire until the installed base carries
 * this schema, and `apps/api/src/routes/config.ts` strips it for that reason.
 */
export const MapConfigSchema = z.looseObject({
  renderer: MapRendererSchema,
  styleUrl: z.string(),
  regions: z.record(z.string(), MapRegionPayloadSchema),
  download: MapDownloadPolicySchema,
  // `.prefault` is the v4 form of what `.default` did in v3: apply the value and
  // then parse it, so an omitted `layers` still materializes its own defaults.
  layers: MapLayerSelectionSchema.prefault({}),
});

export type MapConfig = z.infer<typeof MapConfigSchema>;

/**
 * Instructions audio for one experience format: the slug doubles as the
 * download-cache track id on the client, so it must stay stable across
 * releases — changing it makes every installed device re-download the audio.
 * `audioKey` is the object key in the public audio bucket; `/config` derives
 * the absolute url from the request origin, so the same compiled value serves
 * every environment. `route` is where the global player navigates when this
 * audio is current: the instructions experience has no detail screen of its
 * own, so the destination is the format's list, chosen by configuration
 * rather than compiled into the app.
 */
export const ExperienceInstructionsConfigSchema = z.looseObject({
  slug: z.string().min(1),
  audioKey: z.string().min(1).regex(/^[^/]/, 'must be a bucket key, not an absolute path or url'),
  route: z.string().regex(/^\//, 'must be an app path starting with /'),
});
export type ExperienceInstructionsConfig = z.infer<typeof ExperienceInstructionsConfigSchema>;

/**
 * Per-format configuration the app reads from `/config`, keyed by experience
 * format (`trip`, `track`, ...). Every declared format must carry its
 * instructions node; a new node type travels without a schema change on older
 * clients, which tolerate unknown keys instead of rejecting the payload.
 */
export const ExperiencesConfigSchema = z.record(
  z.string(),
  z.looseObject({
    instructions: ExperienceInstructionsConfigSchema,
  }),
);
export type ExperiencesConfig = z.infer<typeof ExperiencesConfigSchema>;

/**
 * The compiled per-format configuration `/config` publishes: instructions
 * audio per experience format. The slug doubles as the client's download-cache
 * track id — never change a slug once released. The audio keys name objects in
 * the public bucket (`make api-upload-public-audio-*`).
 */
export const EXPERIENCES_CONFIG_DEFAULT: ExperiencesConfig = {
  trip: {
    instructions: {
      slug: 'instructions-trip',
      audioKey: 'instructions/trip.mp3',
      route: '/derivas',
    },
  },
  track: {
    instructions: {
      slug: 'instructions-track',
      audioKey: 'instructions/track.mp3',
      route: '/poetics',
    },
  },
};

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
  /**
   * Per-experience-format configuration, compiled: the instructions audio and
   * its navigation route are the same in every environment, so the defaults
   * below are the single source and `/config` publishes them unchanged.
   */
  experiences: ExperiencesConfigSchema.default(EXPERIENCES_CONFIG_DEFAULT),
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
  experiences: EXPERIENCES_CONFIG_DEFAULT,
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
    // The schema default, so an untouched config changes nothing: the layer
    // control stays hidden until the server turns it on.
    layers: { showControl: false, groups: [] },
  },
};

/**
 * Artifact version the server derives the urls from when the environment does
 * not name one. Re-exported here so the schema and the route agree.
 */
export { DEFAULT_MAP_ARTIFACT_VERSION };
