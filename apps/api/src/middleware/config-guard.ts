import type { MiddlewareHandler } from 'hono';
import {
  DEFAULT_MAP_ARTIFACT_VERSION,
  DEFAULT_MAP_REGION,
  DEFAULT_REMOTE_CONFIG,
  isMapRegionKey,
  type MapRegionKey,
} from '@sonora/shared';
import type { Env, Variables } from '../index';
import { normalizeDeviceIdList, normalizePlatformList } from '../lib/map-renderer';

/**
 * Artifact versions are a path segment of the bucket key, so only a value that
 * cannot leave that segment is accepted; anything else is the compiled version.
 */
const ARTIFACT_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Normalizes `MAP_ARTIFACT_VERSION`: trimmed, or the compiled version when unusable. */
export function normalizeArtifactVersion(value: string | undefined): string {
  const candidate = value?.trim();
  if (!candidate || !ARTIFACT_VERSION_PATTERN.test(candidate)) {
    return DEFAULT_MAP_ARTIFACT_VERSION;
  }
  return candidate;
}

/**
 * Normalizes `MAP_PRELOAD_REGIONS`: split, trimmed, deduped and kept only when
 * the name is a region this build knows.
 *
 * An unset (or blank) variable is the documented default, the region this build
 * was built around. A name that is not a region is dropped and never replaced:
 * preloading a region the operator did not ask for would be a guess.
 */
export function normalizePreloadRegions(value: string | undefined): readonly MapRegionKey[] {
  if (!value || value.trim().length === 0) return [DEFAULT_MAP_REGION];

  const entries = new Set<MapRegionKey>();
  for (const part of value.split(',')) {
    const entry = part.trim();
    if (!isMapRegionKey(entry) || entries.has(entry)) continue;
    entries.add(entry);
  }
  return [...entries];
}

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
      // The artifact urls are derived from this version and the request origin,
      // never from a variable, so publishing v7 is one line and the head that
      // confirms the object reads the same key the client is given.
      mapArtifactVersion: normalizeArtifactVersion(c.env?.MAP_ARTIFACT_VERSION),
      // Which regions the app prefetches when it opens. Chosen here, never
      // guessed by the client and never "all of them".
      mapPreloadRegions: normalizePreloadRegions(c.env?.MAP_PRELOAD_REGIONS),
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
