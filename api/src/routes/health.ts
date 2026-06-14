import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { type DbClient } from '../db';
import { type Env, type Variables } from '../index';

const healthRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

function checkBasic(c: { env?: Env }) {
  return { status: 'ok' as const, environment: c.env?.ENVIRONMENT || 'unknown' };
}

async function checkDb(db: DbClient | undefined) {
  if (!db) {
    return { status: 'error' as const, message: 'No database client configured' };
  }
  try {
    const result = await db.execute(sql`SELECT 1 AS alive`);
    return { status: 'ok' as const, connected: true, alive: result.rows?.[0]?.alive === 1 };
  } catch (err) {
    return { status: 'error' as const, message: String(err) };
  }
}

healthRouter.get('/', (c) => {
  return c.json(checkBasic(c));
});

healthRouter.get('/db', async (c) => {
  const result = await checkDb(c.var.db);
  return c.json(result, result.status === 'ok' ? 200 : 503);
});

healthRouter.get('/full', async (c) => {
  const basic = checkBasic(c);
  const db = await checkDb(c.var.db);

  const checks = { basic, database: db };
  const overall = db.status === 'ok' ? 'ok' : 'degraded';

  return c.json({ status: overall, environment: basic.environment, checks });
});

export { healthRouter };
