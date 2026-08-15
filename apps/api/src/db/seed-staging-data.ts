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

const stagingTrack: NewExperience = {
  id: 'd4a1e6b2-8c3f-5a7e-9b0c-1d2e3f4a5b6c',
  slug: 'prueba-track-audio',
  title: '[PRUEBA] Track de prueba',
  description: 'Track de prueba para staging',
  format: 'track',
  themeKey: 'community',
  audioUrl: STAGING_AUDIO_KEY,
  durationSeconds: 180,
  latitude: -32.211913,
  longitude: -64.73809012343702,
  free: true,
  imageKey: TRACK_IMAGE_KEYS[1],
  geofenceBypassable: false,
  geoMode: 'formatDefaultRadius',
  radiusMeters: null,
  published: true,
};

const stagingTrip: NewExperience = {
  id: 'e5b2f7c3-9d40-5b8f-ac1d-2e3f4a5b6c7d',
  slug: 'prueba-trip-audio',
  title: '[PRUEBA] Recorrido de prueba',
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
};

const stagingFeedback: NewExperience = {
  id: 'f6c308d4-ae51-5c90-bd2e-3f4a5b6c7d8e',
  slug: 'prueba-feedback',
  title: '[PRUEBA] Feedback de prueba',
  description: 'Feedback general de prueba para staging',
  format: 'general-feedback',
  themeKey: 'community',
  audioUrl: null,
  durationSeconds: 0,
  latitude: -32.211913,
  longitude: -64.73809012343702,
  free: true,
  imageKey: TRACK_IMAGE_KEYS[2],
  geofenceBypassable: false,
  geoMode: 'formatDefaultRadius',
  radiusMeters: null,
  published: true,
};

export const stagingOnlyExperiences: readonly NewExperience[] = [
  stagingTrack,
  stagingTrip,
  stagingFeedback,
];

export const stagingOnlyWaypoints: readonly NewWaypoint[] = [
  {
    experienceId: stagingTrip.id!,
    order: 1,
    latitude: -32.212488,
    longitude: -64.736874,
    radiusMeters: 50,
  },
  {
    experienceId: stagingTrip.id!,
    order: 2,
    latitude: -32.21333,
    longitude: -64.736273,
    radiusMeters: 50,
  },
];
