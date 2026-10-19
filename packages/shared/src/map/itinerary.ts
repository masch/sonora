import type { MapDocument, MapReferenceFeature } from './document';

/** A geographic position in degrees, the shape every experience already carries. */
export interface ItineraryCoordinates {
  latitude: number;
  longitude: number;
}

export interface ItineraryInput {
  origin: ItineraryCoordinates;
  waypoints?: readonly ItineraryCoordinates[];
  /** Where the walker is, when the app knows it. */
  userCoordinates?: ItineraryCoordinates | null;
}

/** Stable key of the derived document, so a re-render reconciles it in place. */
export const ITINERARY_DOCUMENT_KEY = 'itinerary';

/** GeoJSON coordinates are [longitude, latitude]. */
function toPosition({ longitude, latitude }: ItineraryCoordinates): [number, number] {
  return [longitude, latitude];
}

/**
 * Builds the document that draws an experience's own itinerary: the origin, one
 * numbered stop per waypoint, the path that joins them, and the walker position
 * when it is known.
 *
 * It mirrors the drawn set of the Leaflet map (origin `Pt 1`, waypoints from
 * `Pt 2`), so the two renderers show the same thing and the transition flag
 * never changes what a walker sees.
 */
export function itineraryDocument({
  origin,
  waypoints = [],
  userCoordinates,
}: ItineraryInput): MapDocument {
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

  if (userCoordinates) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: toPosition(userCoordinates) },
      properties: { labelKey: 'map.userLocation' },
    });
  }

  return {
    key: ITINERARY_DOCUMENT_KEY,
    scope: 'experience',
    collection: { type: 'FeatureCollection', features },
  };
}
