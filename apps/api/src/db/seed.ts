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
];

const trips = [
  {
    id: 'a23baa7e-2c82-472f-9241-4f23e00c1732',
    slug: 'umepay-bosque',
    title: 'DERIVA POR EL CENTRO',
    description: 'Deriva por el centro, 3 secciones, 600mts',
    format: 'trip',
    themeKey: 'landscapes',
    audioUrl: 'experiences/trips-deriva-centro.mp3',
    durationSeconds: 2099,
    latitude: -32.211913,
    longitude: -64.73809012343702,
    priceLabel: '15 mil $',
    imageKey: 'trips-deriva-centro-cover',
    geofenceBypassable: true,
  },
] as const;

const tracks = [
  {
    id: '5a9463ce-daba-4756-892e-4dd4cb862309',
    slug: 'texto-maga',
    title: 'Texto Maga',
    description: 'Maga',
    format: 'track',
    themeKey: 'community',
    audioUrl: 'experiences/tracks-texto-maga.mp3',
    durationSeconds: 193,
    latitude: -32.211015,
    longitude: -64.73809012343702,
    priceLabel: 'FREE',
    imageKey: 'tracks-texto-maga-cover',
    geofenceBypassable: false,
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
    imageKey: 'tracks-pajaros-chiricotes-cover',
    geofenceBypassable: false,
  },
] as const;

const generalFeedback = {
  id: '00000000-0000-0000-0000-000000000000',
  slug: 'general-feedback',
  title: 'Comunidad',
  description: 'Comunidad y Feedback General',
  format: 'general-feedback',
  themeKey: 'community',
  durationSeconds: 0,
  latitude: 0,
  longitude: 0,
  priceLabel: 'FREE',
  imageKey: 'bonus-track',
  geofenceBypassable: false,
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
