import { TRACK_IMAGE_KEYS } from '@sonora/shared';
import type { NewExperience, NewWaypoint } from './schema';

/**
 * Staging-only data. Never imported by the base entry (`seed.ts`).
 *
 * Two sets, deliberately separate (see `stagingTestExperiences` and
 * `stagingArtworkTracks`):
 *
 * Test rows — written by hand (no combinatorial generation): four tracks and two trips that
 * exercise the geofence modes. Stable hardcoded UUIDs, unique slugs (changed only via PR),
 * `[PRUEBA]`/`[Test` prefixed titles, `published: false`.
 *
 * Artwork rows — the four pieces the home map illustration names and the published base
 * experiences do not cover. Their titles are the artwork's, they are published so staging shows
 * them, and their coordinates are the pinned positions of that illustration (±300 m; the doc
 * comment on `stagingArtworkTracks` states why).
 *
 * Both sets: stable hardcoded UUIDs + unique slugs, audio served from R2 reusing the shared
 * staging audio key, and `imageKey` values that are members of `TRACK_IMAGE_KEYS`.
 */

// Audio is served from R2. Staging audio rows reuse the existing object key
// already used by the base `pajaros-chiricotes` experience — the object exists
// in the staging private bucket, so no binary upload is needed.
export const STAGING_AUDIO_KEY = 'experiences/tracks-pajaros-chiricotes.mp3';

const stagingTracks: readonly NewExperience[] = [
  {
    id: 'd4a1e6b2-0000-5a7e-9b0c-1d2e3f4a5b6c',
    slug: 'test-track-00-free-hugo-forest',
    title: '[Test-T00] Free - Bosque de Hugo',
    description: 'Track de prueba para staging',
    format: 'track',
    themeKey: 'community',
    audioUrl: STAGING_AUDIO_KEY,
    durationSeconds: 180,
    latitude: -32.21139923856439,
    longitude: -64.73921167552203,
    free: true,
    imageKey: TRACK_IMAGE_KEYS[1],
    geofenceBypassable: false,
    geoMode: 'formatDefaultRadius',
    radiusMeters: null,
    published: false,
  },
  {
    id: 'd4a1e6b2-0001-5a7e-9b0c-1d2e3f4a5b6c',
    slug: 'test-track-01-geomode-default-format-hugo-path',
    title: '[Test-T01] Free - Camino de Hugo con restricción alcance formato',
    description: 'Track de prueba para staging',
    format: 'track',
    themeKey: 'community',
    audioUrl: STAGING_AUDIO_KEY,
    durationSeconds: 180,
    latitude: -32.210959146698336,
    longitude: -64.7396157534579,
    free: true,
    imageKey: TRACK_IMAGE_KEYS[1],
    geofenceBypassable: false,
    geoMode: 'formatDefaultRadius',
    radiusMeters: null,
    published: false,
  },
  {
    id: 'd4a1e6b2-0002-5a7e-9b0c-1d2e3f4a5b6c',
    slug: 'test-track-02-geomode-entity-radius-within-hugo-path',
    title: '[Test-T02] Free - Camino de Hugo mayor alcance',
    description: 'Track de prueba para staging',
    format: 'track',
    themeKey: 'community',
    audioUrl: STAGING_AUDIO_KEY,
    durationSeconds: 180,
    latitude: -32.210959146698336,
    longitude: -64.7396157534579,
    free: true,
    imageKey: TRACK_IMAGE_KEYS[1],
    geofenceBypassable: false,
    geoMode: 'entityRadius',
    radiusMeters: 70,
    published: false,
  },
  {
    id: 'd4a1e6b2-0003-5a7e-9b0c-1d2e3f4a5b6c',
    slug: 'test-track-03-geomode-unrestricted-hugo-path',
    title: '[Test-T03] Free - Camino de Hugo sin restricción alcance',
    description: 'Track de prueba para staging',
    format: 'track',
    themeKey: 'community',
    audioUrl: STAGING_AUDIO_KEY,
    durationSeconds: 180,
    latitude: -32.210959146698336,
    longitude: -64.7396157534579,
    free: true,
    imageKey: TRACK_IMAGE_KEYS[1],
    geofenceBypassable: false,
    geoMode: 'unrestricted',
    radiusMeters: null,
    published: false,
  },
];

const stagingTripTest1Id = 'e5b2f7c3-0000-5b8f-ac1d-2e3f4a5b6c7d';
const stagingTripTest2Id = 'e5b2f7c3-0001-5b8f-ac1d-2e3f4a5b6c7d';
const stagingTrips: readonly NewExperience[] = [
  {
    id: stagingTripTest1Id,
    slug: 'test-trip-00-geofence-default-format-hugo-path',
    title: '[Test-R00] Deriva de prueba',
    description: 'Recorrido de prueba para staging',
    format: 'trip',
    themeKey: 'landscapes',
    audioUrl: STAGING_AUDIO_KEY,
    durationSeconds: 1800,
    latitude: -32.211913,
    longitude: -64.73809012343702,
    free: false,
    price: 350000,
    currency: 'ARS',
    imageKey: TRACK_IMAGE_KEYS[0],
    geofenceBypassable: false,
    geoMode: 'formatDefaultRadius',
    radiusMeters: null,
    published: false,
  },
  {
    id: stagingTripTest2Id,
    slug: 'test-trip-01geofence-entity-radius-hugo-path',
    title: '[Test-R01] Deriva de prueba con geofence entidad',
    description: 'Deriva de prueba para staging',
    format: 'trip',
    themeKey: 'landscapes',
    audioUrl: STAGING_AUDIO_KEY,
    durationSeconds: 1800,
    latitude: -32.211913,
    longitude: -64.73809012343702,
    free: false,
    price: 350000,
    currency: 'ARS',
    imageKey: TRACK_IMAGE_KEYS[0],
    geofenceBypassable: false,
    geoMode: 'entityRadius',
    radiusMeters: 10,
    published: false,
  },
];

export const stagingTestExperiences: readonly NewExperience[] = [...stagingTracks, ...stagingTrips];

export type WaypointInput = Omit<NewWaypoint, 'experienceId'>;

export const stagingHugoPathWaypoints: readonly WaypointInput[] = [
  {
    order: 1,
    latitude: -32.212488,
    longitude: -64.736874,
    radiusMeters: 50,
  },
  {
    order: 2,
    latitude: -32.21333,
    longitude: -64.736273,
    radiusMeters: 50,
  },
];

export const stagingTripTest1HugoPathWaypoints: readonly NewWaypoint[] =
  stagingHugoPathWaypoints.map((newWayPoint) => ({
    ...newWayPoint,
    experienceId: stagingTripTest1Id,
  }));

export const stagingTripTest2HugoPathWaypoints: readonly NewWaypoint[] =
  stagingHugoPathWaypoints.map((newWayPoint) => ({
    ...newWayPoint,
    experienceId: stagingTripTest2Id,
  }));

export const stagingOnlyWaypoints: readonly NewWaypoint[] = [
  ...stagingTripTest1HugoPathWaypoints,
  ...stagingTripTest2HugoPathWaypoints,
];

/**
 * The four pieces the artwork `apps/mobile/assets/images/sonora/home-map.jpg` names and
 * the two published base experiences do not cover yet: LAVANDAS, INCENDIO, NINA and
 * MANIFIESTO DE UN BROTE. They are staging rows, not production content: the title is the
 * artwork's own, everything else is a placeholder.
 *
 * Where the coordinates come from
 * -------------------------------
 * The illustration's base map is a real render of Umepay — calibrated against the vector
 * geometry of the local archive (`.tools/cache/out/calamuchita.pmtiles`) it lands within a
 * few pixels of the real roads, river and landuse — but **its pins were placed by hand**: the
 * real coordinates of `umepay-bosque` fall ~150 px (~300 m) from the pin drawn for it, and
 * those of `texto-maga` ~376 px (~700 m) from theirs. So each latitude/longitude below is the
 * position of the pin the artwork draws, resolved through that calibration, and inherits the
 * same **±300 m** uncertainty. They are good enough to place the points on staging and to see
 * them where the artwork shows them; they are not surveyed ground truth and must be replaced
 * before anyone walks a geofence (the default trip/track radius is 100 m).
 *
 * Audio and covers are reused rather than invented: the shared staging audio key and existing
 * covers mean this seed adds no binary and no R2 upload. `published: true` because staging is
 * where these four are meant to appear next to the two live experiences.
 */
const STAGING_ARTWORK_DESCRIPTION =
  'Pieza de staging: título del mapa de la obra, audio y portada provisorios, posición aproximada.';

export const stagingArtworkTracks: readonly NewExperience[] = [
  {
    id: 'f6c3a8d4-0000-5c9a-b2e1-4a5b6c7d8e9f',
    slug: 'lavandas-somos-raices',
    title: 'LAVANDAS -somos raíces',
    description: STAGING_ARTWORK_DESCRIPTION,
    format: 'track',
    themeKey: 'community',
    audioUrl: STAGING_AUDIO_KEY,
    durationSeconds: 180,
    latitude: -32.189743,
    longitude: -64.752577,
    free: true,
    imageKey: TRACK_IMAGE_KEYS[1],
    geofenceBypassable: false,
    geoMode: 'formatDefaultRadius',
    radiusMeters: null,
    published: true,
  },
  {
    id: 'f6c3a8d4-0001-5c9a-b2e1-4a5b6c7d8e9f',
    slug: 'incendio',
    title: 'INCENDIO',
    description: STAGING_ARTWORK_DESCRIPTION,
    format: 'track',
    themeKey: 'community',
    audioUrl: STAGING_AUDIO_KEY,
    durationSeconds: 180,
    latitude: -32.192807,
    longitude: -64.752621,
    free: true,
    imageKey: TRACK_IMAGE_KEYS[2],
    geofenceBypassable: false,
    geoMode: 'formatDefaultRadius',
    radiusMeters: null,
    published: true,
  },
  {
    id: 'f6c3a8d4-0002-5c9a-b2e1-4a5b6c7d8e9f',
    slug: 'nina',
    title: 'NINA',
    description: STAGING_ARTWORK_DESCRIPTION,
    format: 'track',
    themeKey: 'community',
    audioUrl: STAGING_AUDIO_KEY,
    durationSeconds: 180,
    latitude: -32.194208,
    longitude: -64.744619,
    free: true,
    imageKey: TRACK_IMAGE_KEYS[0],
    geofenceBypassable: false,
    geoMode: 'formatDefaultRadius',
    radiusMeters: null,
    published: true,
  },
  {
    id: 'f6c3a8d4-0003-5c9a-b2e1-4a5b6c7d8e9f',
    slug: 'manifiesto-de-un-brote',
    title: 'MANIFIESTO DE UN BROTE',
    description: STAGING_ARTWORK_DESCRIPTION,
    format: 'track',
    themeKey: 'community',
    audioUrl: STAGING_AUDIO_KEY,
    durationSeconds: 180,
    latitude: -32.207657,
    longitude: -64.731576,
    free: true,
    imageKey: TRACK_IMAGE_KEYS[1],
    geofenceBypassable: false,
    geoMode: 'formatDefaultRadius',
    radiusMeters: null,
    published: true,
  },
];

export const stagingOnlyExperiences: readonly NewExperience[] = [
  ...stagingTestExperiences,
  ...stagingArtworkTracks,
];
