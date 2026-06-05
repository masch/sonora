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

console.log('Server running on http://localhost:3000');
const server = serve({ fetch: app.fetch, port: 3000 });

function shutdown() {
  console.log('Shutting down gracefully...');
  server.close();
  pool.end().catch((err) => console.error('Error closing pool:', err));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
