import type { MiddlewareHandler } from 'hono';
import { DEFAULT_REMOTE_CONFIG } from '@sonora/shared';
import type { Env, Variables } from '../index';

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
    });
    await next();
  };
};
