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

/** A place on the map, in the order the app already carries coordinates. */
export interface MapPoint {
  latitude: number;
  longitude: number;
}

/** What resolution reads from a published region: its box, and nothing else. */
export interface MapRegionBox {
  bbox: MapBbox;
}

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

/**
 * The region a point belongs to, or `null` when no published box holds it.
 *
 * The experience decides the map: the region is the one whose bbox contains the
 * experience's own coordinates, never a global default and never the nearest one.
 * A point outside every published box resolves nothing on purpose — a map of
 * somewhere else is worse than a map that says so.
 *
 * The box is inclusive on every edge: a point exactly on the boundary is inside,
 * because the published box is exactly what the ingest downloaded.
 *
 * When two boxes overlap, the first region in catalog order wins. The catalog is
 * ordered (it is the payload's `regions` record), so the same point always
 * resolves the same archive instead of flickering with iteration order.
 *
 * `null` or non-finite coordinates resolve nothing: a broken value must not fall
 * into the first box that happens to compare favourably.
 */
export function regionForPoint(
  regions: Readonly<Record<string, MapRegionBox>>,
  point: MapPoint | null | undefined,
): string | null {
  if (!point) return null;
  const { latitude, longitude } = point;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  for (const [key, region] of Object.entries(regions)) {
    const [west, south, east, north] = region.bbox;
    if (longitude >= west && longitude <= east && latitude >= south && latitude <= north) {
      return key;
    }
  }

  return null;
}
