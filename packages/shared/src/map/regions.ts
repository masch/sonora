/**
 * Map regions we publish tiles for.
 *
 * The key is the one thing that ties the places a region appears: the bbox the
 * ingest downloads, the archive path in the bucket (`tiles/<key>/<version>.pmtiles`)
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

/** A box the client can place, in the order every map library expects. */
export type MapBbox = [west: number, south: number, east: number, north: number];

export function isMapRegionKey(value: string): value is MapRegionKey {
  return value in MAP_REGIONS;
}

/**
 * Turns a declared `w,s,e,n` string into the numeric box the payload carries.
 *
 * The string stays the format the ingest tooling reads, so this is the only
 * place that parses it. Returns `null` instead of a box nobody can use: a value
 * that is not four finite numbers, or a degenerate/inverted box with no area,
 * means the region cannot be published and the server omits it.
 */
export function bboxTuple(bbox: string): MapBbox | null {
  const parts = bbox.split(',').map((part) => part.trim());
  if (parts.length !== 4 || parts.some((part) => part.length === 0)) return null;

  const [west, south, east, north] = parts.map(Number);
  if (![west, south, east, north].every(Number.isFinite)) return null;
  if (!(west < east) || !(south < north)) return null;

  return [west, south, east, north];
}
