/**
 * A reference drawn on top of the base map: data that does not come from the
 * basemap tiles (our own GeoJSON documents) and can be adjusted externally
 * without shipping a new app build.
 */

/** Where a document applies: everywhere, or only to the experiences bound to it. */
export type MapDocumentScope = 'global' | 'experience';

/** Supported geometry subset: points, lines and areas. */
export type MapReferenceGeometry =
  | { type: 'Point'; coordinates: [number, number] }
  | { type: 'LineString'; coordinates: [number, number][] }
  | { type: 'Polygon'; coordinates: [number, number][][] };

/** Renderable and interactive data carried by a reference. */
export interface MapReferenceProperties {
  /** Label shown on the map and in the reference card. */
  name: string;
  /** Optional body copy for the card. */
  description?: string;
  /** Key of an image already shipped or served by the app. */
  imageKey?: string;
  /** `#rrggbb` override for the reference colour. */
  color?: string;
  /** Minimum map zoom at which the reference should be drawn. */
  minzoom?: number;
}

export interface MapReferenceFeature {
  type: 'Feature';
  geometry: MapReferenceGeometry;
  properties: MapReferenceProperties;
}

export interface MapReferenceCollection {
  type: 'FeatureCollection';
  features: MapReferenceFeature[];
}

export interface MapDocument {
  /** Stable slug, unique per deployment. Used to build source and layer ids. */
  key: string;
  scope: MapDocumentScope;
  /** Draw order against other documents. Lower draws first. */
  zIndex?: number;
  /** Bumped on every content change; used for cache invalidation. */
  version?: number;
  collection: MapReferenceCollection;
}
