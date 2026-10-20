import type { MiddlewareHandler } from 'hono';
import { DEFAULT_REMOTE_CONFIG } from '@sonora/shared';
import type { Env, Variables } from '../index';
import { normalizeDeviceIdList, normalizePlatformList } from '../lib/map-renderer';

export const configGuard = (): MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> => {
  return async (c, next) => {
    c.set('configEnv', {
      minimumVersion: c.env?.MINIMUM_APP_VERSION || '1.0.0',
      blockOlderVersions: c.env?.BLOCK_OLDER_VERSIONS === 'true',
      gracePeriodStart: c.env?.GRACE_PERIOD_START,
      gracePeriodEnd: c.env?.GRACE_PERIOD_END,
      bypassIosBrowser:
        c.env?.BYPASS_GEOFENCE_IOS_BROWSER !== undefined
          ? c.env.BYPASS_GEOFENCE_IOS_BROWSER === 'true'
          : DEFAULT_REMOTE_CONFIG.geofence.bypassIosBrowser,
      mapArchiveUrl: c.env?.MAP_ARCHIVE_URL || '',
      mapStyleUrl: c.env?.MAP_STYLE_URL || '',
      // Normalized at the edge: only the exact value enables the new renderer,
      // so an unset, empty or misspelled variable keeps every client on Leaflet.
      mapRenderer: c.env?.MAP_RENDERER === 'maplibre' ? 'maplibre' : 'leaflet',
      // Capability gate, normalized to a trimmed, lower-case, deduped list. This
      // one is **not** a secret — platform names are public — so unlike the
      // device lists it belongs in `wrangler.toml`, where adding `web` back is a
      // reviewable line instead of an out-of-band variable.
      mapRendererPlatforms: normalizePlatformList(c.env?.MAP_RENDERER_PLATFORMS),
      // Per-device overrides, normalized to trimmed and deduped lists. These two
      // are **secrets**: they are device ids, and this repository is public, so
      // the real lists are set out of band (`wrangler secret` / dev vars) and
      // must never be written into `wrangler.toml`.
      mapRendererDeviceIds: normalizeDeviceIdList(c.env?.MAP_RENDERER_DEVICE_IDS),
      mapRendererDeviceIdsBlocked: normalizeDeviceIdList(c.env?.MAP_RENDERER_DEVICE_IDS_BLOCKED),
    });
    await next();
  };
};
