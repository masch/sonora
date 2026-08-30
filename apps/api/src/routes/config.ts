import { Hono } from 'hono';
import { DEFAULT_REMOTE_CONFIG, type RemoteConfigPayload } from '@sonora/shared';
import type { Env, Variables } from '../index';
import { success } from '../middleware/problem-details';
import { configGuard } from '../middleware/config-guard';

const configRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

configRouter.get('/', configGuard(), (c) => {
  const { minimumVersion, blockOlderVersions, gracePeriodStart, gracePeriodEnd, bypassIosBrowser } =
    c.var.configEnv;

  const appVersion: RemoteConfigPayload['appVersion'] = {
    minimumVersion,
    blockOlderVersions,
  };

  if (gracePeriodStart) {
    appVersion.gracePeriodStart = gracePeriodStart;
  }
  if (gracePeriodEnd) {
    appVersion.gracePeriodEnd = gracePeriodEnd;
  }

  return success(c, {
    ...DEFAULT_REMOTE_CONFIG,
    geofence: {
      ...DEFAULT_REMOTE_CONFIG.geofence,
      bypassIosBrowser,
    },
    appVersion,
  } satisfies RemoteConfigPayload);
});

export { configRouter };
