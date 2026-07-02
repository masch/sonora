import { Hono } from 'hono';
import { DEFAULT_REMOTE_CONFIG, type RemoteConfigPayload } from '@sonora/shared';

const configRouter = new Hono();

configRouter.get('/', (c) => {
  return c.json(DEFAULT_REMOTE_CONFIG satisfies RemoteConfigPayload);
});

export { configRouter };
