import { serve } from '@hono/node-server';
import { Pool } from 'pg';
import app, { setDbClient } from './index';
import { createDbClient } from './db';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

const db = createDbClient('pg', pool);
setDbClient(db);

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
console.log(`Server running on http://0.0.0.0:${port}`);
const server = serve({ fetch: app.fetch, port, hostname: '0.0.0.0' });

async function shutdown() {
  console.log('Shutting down gracefully...');
  server.close();
  try {
    await pool.end();
  } catch (err) {
    console.error('Error closing pool:', err);
  }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
