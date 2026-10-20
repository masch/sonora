import { Hono } from 'hono';
import { DEFAULT_REMOTE_CONFIG, type RemoteConfigPayload } from '@sonora/shared';
import type { Env, Variables } from '../index';
import { success } from '../middleware/problem-details';
import { configGuard } from '../middleware/config-guard';
import { resolveMapRenderer } from '../lib/map-renderer';

const configRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

configRouter.get('/', configGuard(), (c) => {
  const {
    minimumVersion,
    blockOlderVersions,
    gracePeriodStart,
    gracePeriodEnd,
    bypassIosBrowser,
    mapArchiveUrl,
    mapStyleUrl,
    mapRenderer,
    mapRendererDeviceIds,
    mapRendererDeviceIdsBlocked,
  } = c.var.configEnv;

  // Read the header directly instead of adding the strict device-id
  // middleware: `/config` bootstraps the whole app, so a malformed header must
  // not fail it — the resolver already treats an unusable id as unknown.
  const deviceId = c.req.header('X-Device-Id');

  // The payload now depends on a request header, because the renderer can be
  // overridden per device. Any cache in front of this route must key on that
  // header, and the app keeps its own copy in storage, so there is nothing to
  // gain from an HTTP cache here.
  c.header('Vary', 'X-Device-Id');
  c.header('Cache-Control', 'no-store');

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
    map: {
      ...(DEFAULT_REMOTE_CONFIG.map ?? {}),
      archiveUrl: mapArchiveUrl,
      styleUrl: mapStyleUrl,
      renderer: resolveMapRenderer({
        deviceId,
        allowed: mapRendererDeviceIds,
        blocked: mapRendererDeviceIdsBlocked,
        fallback: mapRenderer,
      }),
    },
    appVersion,
  } satisfies RemoteConfigPayload);
});

export { configRouter };
