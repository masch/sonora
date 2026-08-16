import { TRACK_IMAGE_KEYS } from '@sonora/shared';
import type { NewExperience, NewWaypoint } from './schema';

/**
 * Staging-only test data. Never imported by the base entry (`seed.ts`).
 *
 * Contract (specs: db-seeding):
 * - Three explicit experiences written by hand (no combinatorial generation):
 *   one track, one trip, and one general-feedback.
 * - Stable hardcoded UUIDs + unique slugs (changed only via PR).
 * - `[PRUEBA]`-prefixed titles.
 * - Audio is served from R2; audio rows reuse the shared staging audio key.
 * - `imageKey` values are members of the valid `TRACK_IMAGE_KEYS`.
 */

// Audio is served from R2. Staging audio rows reuse the existing object key
// already used by the base `pajaros-chiricotes` experience — the object exists
// in the staging private bucket, so no binary upload is needed.
export const STAGING_AUDIO_KEY = 'experiences/tracks-pajaros-chiricotes.mp3';

const stagingTracks: readonly NewExperience[] = [
  {
    id: 'd4a1e6b2-0000-5a7e-9b0c-1d2e3f4a5b6c',
    slug: 'test-track-free-hugo-forest',
    title: '[Test] Free - Bosque de Hugo',
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
    published: true,
  },
  {
    id: 'd4a1e6b2-0001-5a7e-9b0c-1d2e3f4a5b6c',
    slug: 'test-track-geomode-default-format-hugo-path',
    title: '[Test] Free - Camino de Hugo con restricción alcance formato',
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
    published: true,
  },
  {
    id: 'd4a1e6b2-0002-5a7e-9b0c-1d2e3f4a5b6c',
    slug: 'test-track-geomode-entity-radius-within-hugo-path',
    title: '[Test] Free - Camino de Hugo mayor alcance',
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
    published: true,
  },
  {
    id: 'd4a1e6b2-0003-5a7e-9b0c-1d2e3f4a5b6c',
    slug: 'test-track-geomode-unrestricted-hugo-path',
    title: '[Test] Free - Camino de Hugo sin restricción alcance',
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
    published: true,
  },
];

const stagingTripTest1Id = 'e5b2f7c3-0000-5b8f-ac1d-2e3f4a5b6c7d';
const stagingTripTest2Id = 'e5b2f7c3-0001-5b8f-ac1d-2e3f4a5b6c7d';
const stagingTrips: readonly NewExperience[] = [
  {
    id: stagingTripTest1Id,
    slug: 'test-trip-geofence-default-format-hugo-path',
    title: '[Test] Recorrido de prueba',
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
    published: true,
  },
  {
    id: stagingTripTest2Id,
    slug: 'test-trip-geofence-entity-radius-hugo-path',
    title: '[Test] Deriva de prueba con geofence entidad',
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
    published: true,
  },
];

export const stagingOnlyExperiences: readonly NewExperience[] = [...stagingTracks, ...stagingTrips];

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
