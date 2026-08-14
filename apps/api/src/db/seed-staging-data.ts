import { TRACK_IMAGE_KEYS } from '@sonora/shared';
import type { NewExperience, NewWaypoint } from './schema';

/**
 * Staging-only test data. Never imported by the base entry (`seed.ts`).
 *
 * Contract (specs: db-seeding):
 * - Stable hardcoded UUIDs + unique slugs (changed only via PR).
 * - `[PRUEBA]`-prefixed titles; every schema matrix combination exactly once.
 * - Paid prices in integer minor units: track 150000, trip 350000 ARS.
 * - Audio keys are real keys in the staging R2 private bucket.
 * - `imageKey` cycles the valid `TRACK_IMAGE_KEYS`.
 */

type Category = 'track' | 'trip' | 'feedback';
type Tier = 'libre-audio' | 'libre-sin-audio' | 'pago';

interface StagingRow {
  id: string;
  slug: string;
  category: Category;
  tier: Tier;
  suffix: 1 | 2 | 3 | 4;
}

// Suffix 1..4 encodes the (geofenceBypassable, published) combo.
const COMBO: Record<1 | 2 | 3 | 4, { geofenceBypassable: boolean; published: boolean }> = {
  1: { geofenceBypassable: false, published: true },
  2: { geofenceBypassable: false, published: false },
  3: { geofenceBypassable: true, published: true },
  4: { geofenceBypassable: true, published: false },
};

// Audio is served from R2. Staging audio rows reuse the existing object key
// already used by the base `pajaros-chiricotes` experience — the object exists
// in the staging private bucket, so no binary upload is needed.
export const STAGING_AUDIO_KEY = 'experiences/tracks-pajaros-chiricotes.mp3';

const TRACK_ROWS: StagingRow[] = [
  {
    id: '91aec4ed-1728-556b-a7c5-a6d1ec16d8fa',
    slug: 'prueba-track-libre-audio-1',
    category: 'track',
    tier: 'libre-audio',
    suffix: 1,
  },
  {
    id: '85332989-b435-5ae5-ab19-fa4992dc1e83',
    slug: 'prueba-track-libre-audio-2',
    category: 'track',
    tier: 'libre-audio',
    suffix: 2,
  },
  {
    id: 'e235a48f-0ed4-563d-9d31-84c02f9a8690',
    slug: 'prueba-track-libre-audio-3',
    category: 'track',
    tier: 'libre-audio',
    suffix: 3,
  },
  {
    id: 'cd9688ff-797a-50e6-87b9-a18d85543483',
    slug: 'prueba-track-libre-audio-4',
    category: 'track',
    tier: 'libre-audio',
    suffix: 4,
  },
  {
    id: '5ddfd7c4-2166-5f6a-a600-2da284d26e0b',
    slug: 'prueba-track-libre-sin-audio-1',
    category: 'track',
    tier: 'libre-sin-audio',
    suffix: 1,
  },
  {
    id: 'f2901e1d-1612-5c69-bdc9-20d3c0a028b0',
    slug: 'prueba-track-libre-sin-audio-2',
    category: 'track',
    tier: 'libre-sin-audio',
    suffix: 2,
  },
  {
    id: '70f33e7c-de86-53d3-aa7f-6fd0935bdd83',
    slug: 'prueba-track-libre-sin-audio-3',
    category: 'track',
    tier: 'libre-sin-audio',
    suffix: 3,
  },
  {
    id: '274a41ef-ca88-52fd-95ca-ca263d7409f2',
    slug: 'prueba-track-libre-sin-audio-4',
    category: 'track',
    tier: 'libre-sin-audio',
    suffix: 4,
  },
  {
    id: '90c6ba34-efa7-5e24-8366-6d4d2a4ab01d',
    slug: 'prueba-track-pago-1',
    category: 'track',
    tier: 'pago',
    suffix: 1,
  },
  {
    id: '3e151bd3-6b7c-5ae9-a3d6-1c1446f8cea9',
    slug: 'prueba-track-pago-2',
    category: 'track',
    tier: 'pago',
    suffix: 2,
  },
  {
    id: '171c05f8-de2d-548b-9165-4df82e6fb74d',
    slug: 'prueba-track-pago-3',
    category: 'track',
    tier: 'pago',
    suffix: 3,
  },
  {
    id: 'c8837737-b768-5ba9-a7c1-1dd505ad2de7',
    slug: 'prueba-track-pago-4',
    category: 'track',
    tier: 'pago',
    suffix: 4,
  },
];

const TRIP_ROWS: StagingRow[] = [
  {
    id: '936fa355-6f1e-536a-8225-d046d6e02564',
    slug: 'prueba-trip-libre-audio-1',
    category: 'trip',
    tier: 'libre-audio',
    suffix: 1,
  },
  {
    id: 'b51cfa97-fc6c-5d13-81f5-d3cae539cbb2',
    slug: 'prueba-trip-libre-audio-2',
    category: 'trip',
    tier: 'libre-audio',
    suffix: 2,
  },
  {
    id: '8303ea64-cc76-5f3f-8054-993ede57dfef',
    slug: 'prueba-trip-libre-audio-3',
    category: 'trip',
    tier: 'libre-audio',
    suffix: 3,
  },
  {
    id: 'd968e51a-cce3-52b0-9409-1626418676af',
    slug: 'prueba-trip-libre-audio-4',
    category: 'trip',
    tier: 'libre-audio',
    suffix: 4,
  },
  {
    id: 'bc62c51e-6e08-518d-87f3-1c24d5df6223',
    slug: 'prueba-trip-libre-sin-audio-1',
    category: 'trip',
    tier: 'libre-sin-audio',
    suffix: 1,
  },
  {
    id: 'a90a813e-8962-5a21-afe3-1cc7b54589f8',
    slug: 'prueba-trip-libre-sin-audio-2',
    category: 'trip',
    tier: 'libre-sin-audio',
    suffix: 2,
  },
  {
    id: '2754f7e2-1ca1-5178-a0d4-678967af6805',
    slug: 'prueba-trip-libre-sin-audio-3',
    category: 'trip',
    tier: 'libre-sin-audio',
    suffix: 3,
  },
  {
    id: 'c7b0e40b-d6e2-52ec-b403-3aeb04c755b2',
    slug: 'prueba-trip-libre-sin-audio-4',
    category: 'trip',
    tier: 'libre-sin-audio',
    suffix: 4,
  },
  {
    id: '227e1e6d-bea4-5415-8e25-ce8d7b41f187',
    slug: 'prueba-trip-pago-1',
    category: 'trip',
    tier: 'pago',
    suffix: 1,
  },
  {
    id: '55571f67-d288-5eae-8015-fa5e4df8cace',
    slug: 'prueba-trip-pago-2',
    category: 'trip',
    tier: 'pago',
    suffix: 2,
  },
  {
    id: '32d4ba14-66d4-565d-94ae-cebb70978465',
    slug: 'prueba-trip-pago-3',
    category: 'trip',
    tier: 'pago',
    suffix: 3,
  },
  {
    id: 'ec47f4b8-b51f-5b3a-a4a6-4c3ed8af1ae8',
    slug: 'prueba-trip-pago-4',
    category: 'trip',
    tier: 'pago',
    suffix: 4,
  },
];

const FEEDBACK_ROWS: StagingRow[] = [
  {
    id: '40c8af46-4ee7-5434-925a-9e4fa9efc731',
    slug: 'prueba-feedback-1',
    category: 'feedback',
    tier: 'libre-sin-audio',
    suffix: 1,
  },
  {
    id: '711d5393-5dbd-576b-a212-7b64783e60f8',
    slug: 'prueba-feedback-2',
    category: 'feedback',
    tier: 'libre-sin-audio',
    suffix: 2,
  },
  {
    id: '4eb9fcc5-15fd-5f6d-9797-81881b8fb618',
    slug: 'prueba-feedback-3',
    category: 'feedback',
    tier: 'libre-sin-audio',
    suffix: 3,
  },
  {
    id: 'b8cb5d2c-4d41-5886-9621-50ad446163be',
    slug: 'prueba-feedback-4',
    category: 'feedback',
    tier: 'libre-sin-audio',
    suffix: 4,
  },
];

function buildTitle(row: StagingRow): string {
  const label =
    row.category === 'track'
      ? row.tier === 'pago'
        ? 'Track pago'
        : row.tier === 'libre-audio'
          ? 'Track libre con audio'
          : 'Track libre sin audio'
      : row.category === 'trip'
        ? row.tier === 'pago'
          ? 'Recorrido pago'
          : row.tier === 'libre-audio'
            ? 'Recorrido libre con audio'
            : 'Recorrido libre sin audio'
        : 'Feedback';
  return `[PRUEBA] ${label} ${row.suffix}`;
}

function buildExperience(row: StagingRow, imageKeyIndex: number): NewExperience {
  const format =
    row.category === 'feedback' ? 'general-feedback' : row.category === 'track' ? 'track' : 'trip';
  const themeKey = row.category === 'trip' ? 'landscapes' : 'community';
  const durationSeconds = row.category === 'track' ? 180 : row.category === 'trip' ? 1800 : 0;
  const free = row.tier !== 'pago';
  const hasAudio = row.tier !== 'libre-sin-audio';
  const price = free ? undefined : row.category === 'track' ? 150000 : 350000;

  return {
    id: row.id,
    slug: row.slug,
    title: buildTitle(row),
    description: `Test ${row.category} ${row.suffix} (staging seed)`,
    format,
    themeKey,
    audioUrl: hasAudio ? STAGING_AUDIO_KEY : null,
    durationSeconds,
    latitude: -32.211913,
    longitude: -64.73809012343702,
    free,
    price,
    currency: free ? undefined : 'ARS',
    imageKey: TRACK_IMAGE_KEYS[imageKeyIndex % TRACK_IMAGE_KEYS.length],
    geofenceBypassable: COMBO[row.suffix].geofenceBypassable,
    published: COMBO[row.suffix].published,
  };
}

const ALL_ROWS: StagingRow[] = [...TRACK_ROWS, ...TRIP_ROWS, ...FEEDBACK_ROWS];

export const stagingOnlyExperiences: readonly NewExperience[] = ALL_ROWS.map((row, i) =>
  buildExperience(row, i),
);

export const stagingOnlyWaypoints: readonly NewWaypoint[] = TRIP_ROWS.flatMap((row) => [
  {
    experienceId: row.id,
    order: 1,
    latitude: -32.212488,
    longitude: -64.736874,
    radiusMeters: 50,
  },
  {
    experienceId: row.id,
    order: 2,
    latitude: -32.21333,
    longitude: -64.736273,
    radiusMeters: 50,
  },
]);
