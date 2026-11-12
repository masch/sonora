import { TRACK_IMAGE_KEYS } from '@sonora/shared';
import type { NewExperience, NewWaypoint } from './schema';

/**
 * Staging-only data. Never imported by the base entry (`seed.ts`).
 *
 * Two sets, deliberately separate (see `stagingTestExperiences` and
 * `stagingShowcaseExperiences`):
 *
 * Test rows — written by hand (no combinatorial generation): four tracks and two trips that
 * exercise the geofence modes. Stable hardcoded UUIDs, unique slugs (changed only via PR),
 * `[PRUEBA]`/`[Test` prefixed titles, `published: false`.
 *
 * Showcase rows — the trip `DERIVA PÒLEN SOMOS` and the track `Fuego`: staging content the
 * published base experiences do not cover. The title and description are the pieces' own, and
 * they are published so staging shows them (the doc comment on `stagingShowcaseExperiences`
 * states what their coordinates are and are not).
 *
 * Both sets: stable hardcoded UUIDs + unique slugs, `imageKey` values that are members of
 * `TRACK_IMAGE_KEYS`, and audio served from R2 objects that already exist in the staging
 * bucket — this seed uploads no binary.
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

/** Shared placeholder description for showcase rows that carry no description of their own. */
const STAGING_SHOWCASE_DESCRIPTION =
  'Pieza de staging: título de la obra, audio y portada provisorios, posición aproximada.';

/**
 * The two staging pieces the published base experiences do not cover yet: the trip
 * `DERIVA PÒLEN SOMOS` and the track `Fuego`.
 *
 * Audio and covers
 * ----------------
 * Both rows play audio that already lives in the staging private bucket, so this seed uploads
 * no binary: `DERIVA PÒLEN SOMOS` reuses the shared `STAGING_AUDIO_KEY` (180 s) and `Fuego`
 * points at its own object, `experiences/trips-deriva-fuego.mp3` (303 s). Covers are members of
 * `TRACK_IMAGE_KEYS`.
 *
 * Where the coordinates come from
 * -------------------------------
 * These are the positions the pieces are published with on staging, rounded from the published
 * figures: they are good enough to see the pieces where they belong, but they are **not**
 * surveyed ground truth and must be replaced before anyone walks a geofence (the default
 * trip/track radius is 100 m).
 *
 * `DERIVA PÒLEN SOMOS` is a trip, so it renders as one; it carries no waypoints yet —
 * `stagingOnlyWaypoints` only covers the two test trips.
 *
 * `published: true` because staging is where these two are meant to appear next to the base
 * experiences.
 */
export const stagingShowcaseExperiences: readonly NewExperience[] = [
  {
    id: 'f6c3a8d4-0000-5c9a-b2e1-4a5b6c7d8e9f',
    slug: 'deriva-polem-somos',
    title: 'DERIVA PÒLEN SOMOS',
    description: STAGING_SHOWCASE_DESCRIPTION,
    format: 'trip',
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
    slug: 'fuego',
    title: 'Fuego',
    description: 'Maga de Massi',
    format: 'track',
    themeKey: 'community',
    audioUrl: 'experiences/trips-deriva-fuego.mp3',
    durationSeconds: 303,
    latitude: -32.191576848045585,
    longitude: -64.75240243117017,
    free: true,
    imageKey: TRACK_IMAGE_KEYS[2],
    geofenceBypassable: false,
    geoMode: 'formatDefaultRadius',
    radiusMeters: null,
    published: true,
  },
];

export const stagingOnlyExperiences: readonly NewExperience[] = [
  ...stagingTestExperiences,
  ...stagingShowcaseExperiences,
];
