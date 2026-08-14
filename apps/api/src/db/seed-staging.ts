import { Pool } from 'pg';
import { createDbClient } from './index';
import {
  assertSeedEnv,
  baseExperiences,
  baseWaypoints,
  defaultThemes,
  seedExperiences,
} from './seed-data';
import { stagingOnlyExperiences, stagingOnlyWaypoints } from './seed-staging-data';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

// Fail closed: refuses (exit 1, zero writes) unless SEED_ENV === 'staging'.
assertSeedEnv('staging', process.env.SEED_ENV);

async function main() {
  console.log('Seeding staging database (base + staging-only data)...');
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
  });

  const db = createDbClient('pg', pool);

  try {
    await seedExperiences(db, {
      themes: defaultThemes,
      experiences: [...baseExperiences, ...stagingOnlyExperiences],
      waypoints: [...baseWaypoints, ...stagingOnlyWaypoints],
    });

    console.log('Staging seeding completed successfully! 🌱');
  } catch (error) {
    console.error('Error seeding staging database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
