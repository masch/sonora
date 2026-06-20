import { Hono } from 'hono';
import { experiences, waypoints } from '../db/schema';
import { type Env, type Variables } from '../index';
import { eq } from 'drizzle-orm';

const experiencesRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

experiencesRouter.get('/', async (c) => {
  const db = c.var.db;
  if (!db) {
    return c.json({ error: 'Database client not available' }, 500);
  }
  try {
    const list = await db.select().from(experiences);
    const result = [];
    for (const exp of list) {
      const expWaypoints = await db
        .select()
        .from(waypoints)
        .where(eq(waypoints.experienceId, exp.id))
        .orderBy(waypoints.order);
      result.push({
        ...exp,
        waypoints: expWaypoints,
      });
    }
    return c.json(result);
  } catch (err) {
    console.error('Failed to fetch experiences:', err);
    return c.json({ error: 'Failed to fetch experiences' }, 500);
  }
});

export { experiencesRouter };
