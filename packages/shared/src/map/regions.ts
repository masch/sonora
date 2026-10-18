/**
 * Map regions we publish tiles for.
 *
 * The key is the one thing that ties the three places a region appears: the bbox
 * the ingest downloads, the archive path in the bucket (`tiles/<key>/<version>.pmtiles`)
 * and the url the app receives. Adding a region is one entry here plus the upload.
 */
export interface MapRegion {
  /** Bounding box in w,s,e,n order, the same order the tooling uses. */
  bbox: string;
  /** Human-readable name, for the admin and for logs. */
  label: string;
}

export const MAP_REGIONS = {
  calamuchita: { bbox: '-64.83,-32.28,-64.66,-32.12', label: 'Valle de Calamuchita' },
} as const satisfies Record<string, MapRegion>;

export type MapRegionKey = keyof typeof MAP_REGIONS;

export const DEFAULT_MAP_REGION: MapRegionKey = 'calamuchita';

export function isMapRegionKey(value: string): value is MapRegionKey {
  return value in MAP_REGIONS;
}
