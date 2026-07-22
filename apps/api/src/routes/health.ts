import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { type DbClient } from '../db';
import { type Env, type Variables } from '../index';
import { ERRORS, problem, success } from '../middleware/problem-details';

import { envGuard } from '../middleware/env-guard';

const healthRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

healthRouter.use('*', envGuard());

function checkBasic(c: { var: Variables }) {
  return { status: 'ok' as const, environment: c.var.environment };
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
  return success(c, checkBasic(c));
});

healthRouter.get('/db', async (c) => {
  const result = await checkDb(c.var.db);
  if (result.status === 'error') {
    return problem(c, ERRORS.DB_NOT_AVAILABLE, result.message);
  }
  return success(c, result);
});

healthRouter.get('/full', async (c) => {
  const basic = checkBasic(c);
  const db = await checkDb(c.var.db);

  const checks = { basic, database: db };
  const overall = db.status === 'ok' ? 'ok' : 'degraded';

  return success(c, { status: overall, environment: basic.environment, checks });
});

export { healthRouter };
