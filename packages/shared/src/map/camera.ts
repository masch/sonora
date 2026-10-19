import type { MapDocument, MapReferenceGeometry } from './document';

/** Bounding box in WGS84. */
export interface GeoBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

function coordinatesOf(geometry: MapReferenceGeometry): [number, number][] {
  switch (geometry.type) {
    case 'Point':
      return [geometry.coordinates];
    case 'LineString':
      return geometry.coordinates;
    case 'Polygon':
      return geometry.coordinates.flat();
  }
}

/** Bounds covering every feature of every document, or null when there is none. */
export function boundsOfDocuments(documents: readonly MapDocument[]): GeoBounds | null {
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;

  for (const document of documents) {
    for (const feature of document.collection.features) {
      for (const [longitude, latitude] of coordinatesOf(feature.geometry)) {
        west = Math.min(west, longitude);
        east = Math.max(east, longitude);
        south = Math.min(south, latitude);
        north = Math.max(north, latitude);
      }
    }
  }

  if (!Number.isFinite(west) || !Number.isFinite(south)) return null;
  return { west, south, east, north };
}

/** MapLibre's `[[west, south], [east, north]]` form. */
export function toLngLatBounds(bounds: GeoBounds): [[number, number], [number, number]] {
  return [
    [bounds.west, bounds.south],
    [bounds.east, bounds.north],
  ];
}
