import { Hono } from 'hono';
import { DEFAULT_REMOTE_CONFIG, type RemoteConfigPayload } from '@sonora/shared';
import type { Env } from '../index';
import { success } from '../middleware/problem-details';

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

  return success(c, {
    ...DEFAULT_REMOTE_CONFIG,
    appVersion,
  } satisfies RemoteConfigPayload);
});

export { configRouter };
