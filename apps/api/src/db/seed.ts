import { Pool } from 'pg';
import { createDbClient } from './index';
import { tracks } from './schema';
import { TRACKS } from '@sonora/shared';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

async function main() {
  console.log('Seeding database...');
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
  });

  const db = createDbClient('pg', pool);

  try {
    const defaultTracks = Object.values(TRACKS).map((track) => ({
      id: track.uuid,
      slug: track.id,
      title: track.title,
      description: track.description,
      durationSeconds: track.durationSeconds,
      audioUrl: track.audioRemoteUrl,
      feedbackTrigger: track.feedbackTrigger ?? null,
    }));

    for (const track of defaultTracks) {
      await db
        .insert(tracks)
        .values(track)
        .onConflictDoUpdate({
          target: tracks.slug,
          set: {
            title: track.title,
            description: track.description,
            durationSeconds: track.durationSeconds,
            audioUrl: track.audioUrl,
            feedbackTrigger: track.feedbackTrigger,
          },
        });
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
