import { Hono } from 'hono';
import { themes } from '../db/schema';
import { type Env, type Variables } from '../index';
import { success } from '../middleware/problem-details';
import { dbGuard } from '../middleware/db-guard';

const themesRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

themesRouter.get('/', dbGuard(), async (c) => {
  const db = c.var.db!;
  const list = await db.select().from(themes).orderBy(themes.order);
  return success(c, list);
});

export { themesRouter };
