import { Hono } from 'hono';
import {
  DEFAULT_REMOTE_CONFIG,
  MAP_REGIONS,
  bboxTuple,
  mapArchiveKey,
  mapArchivePath,
  mapStylePath,
  type MapRegionKey,
  type MapRegionPayload,
  type RemoteConfigPayload,
} from '@sonora/shared';
import type { Env, Variables } from '../index';
import { success } from '../middleware/problem-details';
import { configGuard } from '../middleware/config-guard';
import { resolveMapRenderer } from '../lib/map-renderer';

const configRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * The regions this environment publishes.
 *
 * A region reaches the payload only when the public bucket holds its archive:
 * `head` is the confirmation, and the size it reports is what the client shows
 * in the download prompt. A region that is not uploaded, or a bucket that cannot
 * answer, is omitted — the payload names downloads the app is expected to
 * finish, so an unpublished region must never travel.
 *
 * The public bucket is read from the bindings instead of `publicBucketGuard()`,
 * which answers 500 when no bucket is bound: `/config` bootstraps the whole app,
 * and an environment without artifacts still has to serve a payload.
 */
/** How long one bucket lookup may hold `/config` before the region counts as unpublished. */
const HEAD_TIMEOUT_MS = 1500;

async function readPublishedRegions(
  bucket: R2Bucket | undefined,
  origin: string,
  version: string,
): Promise<Record<string, MapRegionPayload>> {
  const entries = await Promise.all(
    (Object.keys(MAP_REGIONS) as MapRegionKey[]).map(async (key) => {
      const bbox = bboxTuple(MAP_REGIONS[key].bbox);
      if (!bbox || !bucket) return null;

      try {
        // `/config` bootstraps the whole app, so a bucket that hangs answers as
        // "not published" instead of holding the response. A timeout is not an
        // error: the region simply is not in the catalog this time.
        const head = await Promise.race([
          bucket.head(mapArchiveKey(key, version)),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), HEAD_TIMEOUT_MS)),
        ]);
        if (!head) return null;

        const region: MapRegionPayload = {
          bbox: [bbox[0], bbox[1], bbox[2], bbox[3]],
          label: MAP_REGIONS[key].label,
          archiveUrl: `${origin}${mapArchivePath(key, version)}`,
          archiveBytes: head.size,
        };
        return [key, region] as [string, MapRegionPayload];
      } catch {
        // A bucket that cannot answer publishes nothing for this region; the
        // bootstrap still answers, with a smaller catalog.
        return null;
      }
    }),
  );

  return Object.fromEntries(entries.filter((entry) => entry !== null));
}

configRouter.get('/', configGuard(), async (c) => {
  const {
    minimumVersion,
    blockOlderVersions,
    gracePeriodStart,
    gracePeriodEnd,
    bypassIosBrowser,
    mapArtifactVersion,
    mapPreloadRegions,
    mapRenderer,
    mapRendererPlatforms,
    mapRendererDeviceIds,
    mapRendererDeviceIdsBlocked,
  } = c.var.configEnv;

  // Read the headers directly instead of adding the strict device-id
  // middleware: `/config` bootstraps the whole app, so a malformed header must
  // not fail it — the resolver already treats an unusable id as unknown, and an
  // unusable platform as incapable. The platform comes from `injectDeviceId()`,
  // which is mounted globally and silently drops a value outside `PLATFORMS`,
  // so an unknown platform arrives here as unset and keeps the client on Leaflet.
  const deviceId = c.req.header('X-Device-Id');
  const devicePlatform = c.var.devicePlatform;

  // The payload now depends on two request headers, because the renderer can be
  // overridden per device and is gated by platform. Any cache in front of this
  // route must key on both, and the app keeps its own copy in storage, so there
  // is nothing to gain from an HTTP cache here.
  c.header('Vary', 'X-Device-Id, X-Device-Platform');
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

  const origin = new URL(c.req.url).origin;
  const regions = await readPublishedRegions(c.env?.PUBLIC_BUCKET, origin, mapArtifactVersion);

  return success(c, {
    ...DEFAULT_REMOTE_CONFIG,
    geofence: {
      ...DEFAULT_REMOTE_CONFIG.geofence,
      bypassIosBrowser,
    },
    map: {
      ...DEFAULT_REMOTE_CONFIG.map,
      renderer: resolveMapRenderer({
        platform: devicePlatform,
        capablePlatforms: mapRendererPlatforms,
        deviceId,
        allowed: mapRendererDeviceIds,
        blocked: mapRendererDeviceIdsBlocked,
        fallback: mapRenderer,
      }),
      // Derived, like every archive url: the environment only names the version.
      styleUrl: `${origin}${mapStylePath(mapArtifactVersion)}`,
      regions,
      download: {
        ...DEFAULT_REMOTE_CONFIG.map.download,
        // The configured set intersected with what is actually published: the
        // client is never told to preload a region it cannot download.
        preload: mapPreloadRegions.filter((key) => key in regions),
      },
    },
    appVersion,
  } satisfies RemoteConfigPayload);
});

export { configRouter };
