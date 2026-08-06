import {
  GENERAL_FEEDBACK_EXPERIENCE_ID,
  INSTRUCTIONS_AUDIO_KEY,
  INSTRUCTIONS_IMAGE_KEY,
  INSTRUCTIONS_SLUG,
} from '@sonora/shared';
import { inArray } from 'drizzle-orm';
import { Pool } from 'pg';
import { createDbClient } from './index';
import { experiences, themes, waypoints } from './schema';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const defaultThemes = [
  {
    key: 'birds',
    labelKey: 'experiences.categories.birds',
    order: 1,
    applicableFormat: 'track' as const,
  },
  {
    key: 'landscapes',
    labelKey: 'experiences.categories.landscapes',
    order: 2,
    applicableFormat: 'trip' as const,
  },
  {
    key: 'community',
    labelKey: 'experiences.categories.community',
    order: 3,
    applicableFormat: 'track' as const,
  },
  {
    key: 'onboarding',
    labelKey: 'experiences.categories.onboarding',
    order: 4,
    applicableFormat: 'trip' as const,
  },
];

const trips = [
  {
    id: 'a23baa7e-2c82-472f-9241-4f23e00c1733',
    slug: INSTRUCTIONS_SLUG,
    title: 'INSTRUCTIONS',
    description: 'Cómo usar la app de Sonora',
    format: 'trip',
    themeKey: 'onboarding',
    audioUrl: INSTRUCTIONS_AUDIO_KEY,
    durationSeconds: 116,
    latitude: -32.212228424258456,
    longitude: -64.73806565212881,
    free: true,
    price: null,
    currency: null,
    imageKey: INSTRUCTIONS_IMAGE_KEY,
    geofenceBypassable: false,
    published: false,
  },
  {
    id: 'a23baa7e-2c82-472f-9241-4f23e00c1732',
    slug: 'umepay-bosque',
    title: 'DERIVA DEL BOSQUE AL RÍO',
    description: 'Deriva del bosque al río, 3 secciones, 600mts',
    format: 'trip',
    themeKey: 'landscapes',
    audioUrl: 'experiences/trips-deriva-centro.mp3',
    durationSeconds: 2104,
    latitude: -32.211913,
    longitude: -64.73809012343702,
    free: false,
    price: 1000000,
    currency: 'ARS',
    imageKey: 'trips-deriva-centro-cover',
    geofenceBypassable: false,
    published: true,
  },
] as const;

const tracks = [
  {
    id: '5a9463ce-daba-4756-892e-4dd4cb862309',
    slug: 'texto-maga',
    title: 'En Nogales, una vez',
    description: 'Maga',
    format: 'track',
    themeKey: 'community',
    audioUrl: 'experiences/tracks-texto-maga.mp3',
    durationSeconds: 193,
    latitude: -32.211015,
    longitude: -64.73809012343702,
    free: true,
    imageKey: 'tracks-texto-maga-cover',
    geofenceBypassable: false,
    published: true,
  },
  {
    id: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
    slug: 'pajaros-chiricotes',
    title: 'Pájaros chiricotes',
    description: 'Pájaros chiricotes en el dique',
    format: 'track',
    themeKey: 'birds',
    audioUrl: 'experiences/tracks-pajaros-chiricotes.mp3',
    durationSeconds: 139,
    latitude: -32.2115,
    longitude: -64.7385,
    free: true,
    imageKey: 'tracks-pajaros-chiricotes-cover',
    geofenceBypassable: false,
    published: false,
  },
] as const;

const generalFeedback = {
  id: GENERAL_FEEDBACK_EXPERIENCE_ID,
  slug: 'general-feedback',
  title: 'Comunidad',
  description: 'Comunidad y Feedback General',
  format: 'general-feedback',
  themeKey: 'community',
  durationSeconds: 0,
  latitude: 0,
  longitude: 0,
  free: true,
  imageKey: 'bonus-track',
  geofenceBypassable: false,
  published: true,
} as const;

const defaultExperiences = [...trips, ...tracks, generalFeedback] as const;

const defaultWaypoints = [
  {
    experienceId: 'a23baa7e-2c82-472f-9241-4f23e00c1732',
    order: 1,
    latitude: -32.212488,
    longitude: -64.736874,
    radiusMeters: 50,
  },
  {
    experienceId: 'a23baa7e-2c82-472f-9241-4f23e00c1732',
    order: 2,
    latitude: -32.21333,
    longitude: -64.736273,
    radiusMeters: 50,
  },
  {
    experienceId: 'a23baa7e-2c82-472f-9241-4f23e00c1733',
    order: 1,
    latitude: -32.212228424258456,
    longitude: -64.73806565212881,
    radiusMeters: 50,
  },
];

async function main() {
  console.log('Seeding database...');
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
  });

  const db = createDbClient('pg', pool);

  try {
    // 1. Upsert Themes (update if exists, insert if not)
    console.log('Seeding themes...');
    for (const theme of defaultThemes) {
      await db.insert(themes).values(theme).onConflictDoUpdate({ target: themes.key, set: theme });
    }

    const seededExperienceIds = defaultExperiences.map((e) => e.id!);

    // 2. Upsert Experiences (update if exists, insert if not)
    console.log('Seeding experiences...');
    for (const exp of defaultExperiences) {
      await db
        .insert(experiences)
        .values(exp)
        .onConflictDoUpdate({ target: experiences.id, set: exp });
    }

    // 3. Replace waypoints only for seeded experiences (leave others untouched)
    console.log('Seeding waypoints...');
    await db
      .delete(waypoints)
      .where(inArray(waypoints.experienceId, seededExperienceIds as [string, ...string[]]));
    for (const wp of defaultWaypoints) {
      await db.insert(waypoints).values(wp);
    }

    console.log('Seeding completed successfully! 🌱');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
