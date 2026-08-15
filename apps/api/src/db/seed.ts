import { Pool } from 'pg';
import { logger } from '@sonora/shared';
import { createDbClient } from './index';
import {
  assertSeedEnv,
  baseExperiences,
  baseWaypoints,
  defaultThemes,
  seedExperiences,
} from './seed-data';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  logger.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

// Fail closed: refuses when SEED_ENV is present and not 'production'.
// Absent SEED_ENV (local dev) is permitted. Zero writes on refusal.
assertSeedEnv('base', process.env.SEED_ENV);

async function main() {
  logger.info('Seeding database...');
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
  });

  const db = createDbClient('pg', pool);

  try {
    await seedExperiences(db, {
      themes: defaultThemes,
      experiences: baseExperiences,
      waypoints: baseWaypoints,
    });

    logger.info('Seeding completed successfully! 🌱');
  } catch (error) {
    logger.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});
