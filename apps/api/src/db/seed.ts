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
    key: 'stories',
    labelKey: 'experiences.categories.stories',
    order: 2,
    applicableFormat: 'trip' as const,
  },
  {
    key: 'landscapes',
    labelKey: 'experiences.categories.landscapes',
    order: 3,
    applicableFormat: 'trip' as const,
  },
  {
    key: 'poems',
    labelKey: 'experiences.categories.poems',
    order: 4,
    applicableFormat: 'track' as const,
  },
  {
    key: 'community',
    labelKey: 'experiences.categories.community',
    order: 5,
    applicableFormat: null,
  },
  {
    key: 'children',
    labelKey: 'experiences.categories.children',
    order: 6,
    applicableFormat: null,
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
    audioUrl: 'experiences/umepay-recorrido-bosque.mp3',
    durationSeconds: 2065,
    latitude: -32.211913,
    longitude: -64.73809012343702,
    priceLabel: '15 mil $',
    imageKey: 'deriva-centro',
    isDownloadable: true,
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
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    durationSeconds: 425,
    latitude: -32.211015,
    longitude: -64.73809012343702,
    priceLabel: 'FREE',
    imageKey: 'track-texto-maga',
    isDownloadable: false,
  },
  {
    id: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
    slug: 'tacuarita-azul',
    title: 'Tacuarita Azul',
    description: 'Paisaje sonoro',
    format: 'track',
    themeKey: 'landscapes',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    durationSeconds: 344,
    latitude: -32.2115,
    longitude: -64.7385,
    imageKey: 'tacuarita-azul',
    isDownloadable: true,
  },
  {
    id: '2a3b4c5d-6e7f-8a9b-0c1d-2e3f4a5b6c7d',
    slug: 'el-arroyo',
    title: 'El arroyo',
    description: 'Historia',
    format: 'track',
    themeKey: 'stories',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    durationSeconds: 302,
    latitude: -32.212,
    longitude: -64.739,
    imageKey: 'el-arroyo',
    isDownloadable: true,
  },
  {
    id: '3a4b5c6d-7e8f-9a0b-1c2d-3e4f5a6b7c8d',
    slug: 'la-piedra-antigua',
    title: 'La piedra antigua',
    description: 'Poema',
    format: 'track',
    themeKey: 'poems',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    durationSeconds: 353,
    latitude: -32.2125,
    longitude: -64.7395,
    imageKey: 'la-piedra-antigua',
    isDownloadable: true,
  },
  {
    id: '4a5b6c7d-8e9f-0a1b-2c3d-4e5f6a7b8c9d',
    slug: 'viento-chanares',
    title: 'Viento en los chañares',
    description: 'Paisaje sonoro',
    format: 'track',
    themeKey: 'landscapes',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    durationSeconds: 279,
    latitude: -32.213,
    longitude: -64.74,
    imageKey: 'viento-chanares',
    isDownloadable: true,
  },
  {
    id: '5a6b7c8d-9e0f-1a2b-3c4d-5e6f7a8b9c0d',
    slug: 'voces-monte',
    title: 'Voces del monte',
    description: 'Comunidad',
    format: 'track',
    themeKey: 'community',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
    durationSeconds: 420,
    latitude: -32.2135,
    longitude: -64.7405,
    imageKey: 'voces-monte',
    isDownloadable: true,
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
  isDownloadable: false,
} as const;

const defaultExperiences = [...trips, ...tracks, generalFeedback] as const;

const defaultWaypoints = [
  {
    experienceId: 'a23baa7e-2c82-472f-9241-4f23e00c1732',
    order: 1,
    latitude: -32.211913,
    longitude: -64.73809012343702,
    radiusMeters: 50,
  },
  {
    experienceId: 'a23baa7e-2c82-472f-9241-4f23e00c1732',
    order: 2,
    latitude: -32.2125,
    longitude: -64.7385,
    radiusMeters: 50,
  },
  {
    experienceId: 'a23baa7e-2c82-472f-9241-4f23e00c1732',
    order: 3,
    latitude: -32.213,
    longitude: -64.739,
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
