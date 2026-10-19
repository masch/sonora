import { DEFAULT_MAP_REGION, type MapRegionKey } from './regions';

/**
 * Version of the published map artifacts this build falls back to.
 *
 * The remote config carries the urls the environment publishes, so this is only
 * the compiled floor: it lets a cold start without network, or a payload that
 * carries no map field, still resolve an archive.
 */
export const DEFAULT_MAP_ARTIFACT_VERSION = 'v1';

/** Public path of a region archive, the same key the upload targets write. */
export function mapArchivePath(
  region: MapRegionKey = DEFAULT_MAP_REGION,
  version: string = DEFAULT_MAP_ARTIFACT_VERSION,
): string {
  return `/media/public/tiles/${region}/${version}.pmtiles`;
}

/** Public path of the shared style document, the same key the upload targets write. */
export function mapStylePath(version: string = DEFAULT_MAP_ARTIFACT_VERSION): string {
  return `/media/public/styles/${version}.json`;
}
