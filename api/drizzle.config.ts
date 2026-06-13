import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  migrations: {
    schema: 'sonora_db_migrations',
    table: '__drizzle_migrations',
  },
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
