import { DEFAULT_MAP_REGION, type MapRegionKey } from './regions';

/**
 * Version of the published map artifacts used when the environment does not
 * name one.
 *
 * The urls are derived from this version, so the environment only decides which
 * version the bucket holds (`MAP_ARTIFACT_VERSION`); nothing is compiled into
 * the client as a floor.
 */
export const DEFAULT_MAP_ARTIFACT_VERSION = 'v1';

/** Public media prefix every artifact is served under. */
const PUBLIC_MEDIA_PREFIX = '/media/public/';

/** Bucket key of a region archive, the same key the upload targets write. */
export function mapArchiveKey(
  region: MapRegionKey = DEFAULT_MAP_REGION,
  version: string = DEFAULT_MAP_ARTIFACT_VERSION,
): string {
  return `tiles/${region}/${version}.pmtiles`;
}

/** Bucket key of the shared style document, the same key the upload targets write. */
export function mapStyleKey(version: string = DEFAULT_MAP_ARTIFACT_VERSION): string {
  return `styles/${version}.json`;
}

/** Public path of a region archive, the url the app receives. */
export function mapArchivePath(
  region: MapRegionKey = DEFAULT_MAP_REGION,
  version: string = DEFAULT_MAP_ARTIFACT_VERSION,
): string {
  return `${PUBLIC_MEDIA_PREFIX}${mapArchiveKey(region, version)}`;
}

/** Public path of the shared style document. */
export function mapStylePath(version: string = DEFAULT_MAP_ARTIFACT_VERSION): string {
  return `${PUBLIC_MEDIA_PREFIX}${mapStyleKey(version)}`;
}
