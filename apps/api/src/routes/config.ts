import { Hono } from 'hono';
import { DEFAULT_REMOTE_CONFIG, type RemoteConfigPayload } from '@sonora/shared';
import type { Env } from '../index';

const configRouter = new Hono<{ Bindings: Env }>();

configRouter.get('/', (c) => {
  const appVersion: RemoteConfigPayload['appVersion'] = {
    minimumVersion: c.env.MINIMUM_APP_VERSION,
    blockOlderVersions: c.env.BLOCK_OLDER_VERSIONS === 'true',
  };

  if (c.env.GRACE_PERIOD_START) {
    appVersion.gracePeriodStart = c.env.GRACE_PERIOD_START;
  }
  if (c.env.GRACE_PERIOD_END) {
    appVersion.gracePeriodEnd = c.env.GRACE_PERIOD_END;
  }

  return c.json({
    ...DEFAULT_REMOTE_CONFIG,
    appVersion,
  } satisfies RemoteConfigPayload);
});

export { configRouter };
