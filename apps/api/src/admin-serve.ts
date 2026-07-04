import { Hono } from 'hono';
import { type Env, type Variables } from './index';

const adminServeRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// Catch-all for admin SPA routes
adminServeRouter.get('*', async (c) => {
  return c.json(
    { error: 'Admin SPA not built yet. Run `cd apps/admin && bun run build` first.' },
    404,
  );
});

export { adminServeRouter };
