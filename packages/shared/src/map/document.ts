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

import type { SupportedLanguage } from '../enums';

/**
 * One attribute's text, keyed by language: `{ es: 'Salón', en: 'Hall' }`.
 *
 * Grouping by attribute instead of by language means the attribute name is written
 * once per feature and a translator still sees one language at a time by reading the
 * file column-wise.
 */
export type MapReferenceText = Partial<Record<SupportedLanguage, string>>;

/** Renderable and interactive data carried by a reference. */
export interface MapReferenceProperties {
  /** i18n key for the map label and the card title. Excludes `label`. */
  labelKey?: string;
  /** i18n key for the card body copy. Excludes `description`. */
  descriptionKey?: string;
  /**
   * The reference's own label, one entry per supported language. Self-contained: the
   * document needs no row in the `translations` table, so a copy change is an edit to
   * the document and nothing else.
   */
  label?: MapReferenceText;
  /** The reference's own description, per supported language. Excludes `descriptionKey`. */
  description?: MapReferenceText;
  /** Public https URL of the card image (served from the public bucket). */
  imageUrl?: string;
  /** Public https URL opened by the card action; host is allowlisted. */
  linkUrl?: string;
  /** `#rrggbb` override for the reference colour. */
  color?: string;
  /** Minimum map zoom at which the reference should be drawn. */
  minzoom?: number;
  /** Position inside an auto-numbered series, read by `map.point` as `{{index}}`. */
  labelIndex?: number;
  /**
   * The experience this reference stands for, when it draws one.
   *
   * The world's points are derived from the experiences payload, so the tap has to
   * name the experience it landed on. It cannot come from the label — the label is
   * prose the walker reads — and it must not come from the document key, because
   * every point shares one document. Absent for a reference that is not a place an
   * experience happens at.
   */
  experienceSlug?: string;
  /** Injected at runtime from `label` or `labelKey`, in the active language. */
  labelText?: string;
  /** Injected at runtime from `description` or `descriptionKey`, in that language. */
  descriptionText?: string;
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
