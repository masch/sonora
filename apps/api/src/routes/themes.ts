import { Hono } from 'hono';
import { themes } from '../db/schema';
import { type Env, type Variables } from '../index';

const themesRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

themesRouter.get('/', async (c) => {
  const db = c.var.db;
  if (!db) {
    return c.json({ error: 'Database client not available' }, 500);
  }
  try {
    const list = await db.select().from(themes).orderBy(themes.order);
    return c.json(list);
  } catch (err) {
    console.error('Failed to fetch themes:', err);
    return c.json({ error: 'Failed to fetch themes' }, 500);
  }
});

export { themesRouter };
