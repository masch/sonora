import type { MapDocument, MapReferenceFeature } from './document';

/**
 * Which side of a point a document's labels belong on.
 *
 * The itinerary and a reference can describe the same place — the first stop of a
 * walk next to the wooded area it enters — and a map that anchors both above the
 * point draws two labels into the same pixels. Whichever document is not the
 * itinerary keeps the side every reference always had.
 */
export function labelAnchorForDocument(documentKey: string): 'top' | 'bottom' {
  return documentKey === ITINERARY_DOCUMENT_KEY ? 'bottom' : 'top';
}

/** A geographic position in degrees, the shape every experience already carries. */
export interface ItineraryCoordinates {
  latitude: number;
  longitude: number;
}

export interface ItineraryInput {
  origin: ItineraryCoordinates;
  waypoints?: readonly ItineraryCoordinates[];
}

/** Stable key of the derived document, so a re-render reconciles it in place. */
export const ITINERARY_DOCUMENT_KEY = 'itinerary';

/** GeoJSON coordinates are [longitude, latitude]. */
function toPosition({ longitude, latitude }: ItineraryCoordinates): [number, number] {
  return [longitude, latitude];
}

/**
 * Builds the document that draws an experience's own itinerary: the origin, one
 * numbered stop per waypoint, and the path that joins them.
 *
 * The walker is deliberately not part of it. Where they are standing is a fact
 * about the device that moves, not a place the experience published, and it is
 * drawn by the renderer as its own point: encoding it here as well drew the same
 * position twice, once as a stop of the walk and once as the walker.
 *
 * It mirrors the drawn set of the Leaflet map (origin `Pt 1`, waypoints from
 * `Pt 2`), so the two renderers show the same thing and the transition flag
 * never changes what a walker sees.
 */
export function itineraryDocument({ origin, waypoints = [] }: ItineraryInput): MapDocument {
  const features: MapReferenceFeature[] = [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: toPosition(origin) },
      properties: { labelKey: 'map.point', labelIndex: 1 },
    },
    ...waypoints.map((waypoint, index): MapReferenceFeature => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: toPosition(waypoint) },
      properties: { labelKey: 'map.point', labelIndex: index + 2 },
    })),
  ];

  // A line needs two positions: a bare origin has no path to draw.
  if (waypoints.length > 0) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [toPosition(origin), ...waypoints.map(toPosition)],
      },
      properties: { labelKey: 'map.point' },
    });
  }

  return {
    key: ITINERARY_DOCUMENT_KEY,
    scope: 'experience',
    collection: { type: 'FeatureCollection', features },
  };
}
