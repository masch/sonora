import { Pool } from 'pg';
import { createDbClient } from './index';
import { trips } from './schema';

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
    const defaultTrips = [
      {
        id: 'a23baa7e-2c82-472f-9241-4f23e00c1732',
        slug: 'umepay-bosque',
        title: 'DERIVA POR EL CENTRO',
        description: 'Deriva por el centro, 3 secciones, 600mts',
        durationMinutes: 45,
        audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        feedbackTrigger: 'manual',
      },
      {
        id: '5a9463ce-daba-4756-892e-4dd4cb862309',
        slug: 'rio-claro',
        title: 'BONUS TRACK',
        description: 'Mindfulness',
        durationMinutes: 10,
        audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
        feedbackTrigger: null,
      },
    ];

    for (const trip of defaultTrips) {
      await db
        .insert(trips)
        .values(trip)
        .onConflictDoUpdate({
          target: trips.slug,
          set: {
            title: trip.title,
            description: trip.description,
            durationMinutes: trip.durationMinutes,
            audioUrl: trip.audioUrl,
            feedbackTrigger: trip.feedbackTrigger,
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
