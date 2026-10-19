import { z } from 'zod';

import type { MapDocument } from './document';

/** Hard limits that keep a document cheap to validate, ship and draw. */
export const MAP_REFERENCE_LIMITS = {
  maxFeatures: 500,
  maxPointsPerGeometry: 5000,
} as const;

/** Reference documents are authored by hand, so keys stay simple and stable. */
export const MAP_DOCUMENT_KEY_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Translation keys for references stay inside the `map.*` namespace.
 *
 * The locales name these keys in camelCase (`map.userLocation`), so the pattern
 * accepts mixed case: the authored documents and the derived itinerary share it.
 */
export const MAP_LABEL_KEY_PATTERN = /^map\.[A-Za-z0-9][A-Za-z0-9.-]*$/;

/** GeoJSON coordinates are [longitude, latitude]. */
const coordinateSchema = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

const pointSchema = z.object({
  type: z.literal('Point'),
  coordinates: coordinateSchema,
});

const lineSchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(coordinateSchema).min(2).max(MAP_REFERENCE_LIMITS.maxPointsPerGeometry),
});

const polygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z
    .array(z.array(coordinateSchema).min(3).max(MAP_REFERENCE_LIMITS.maxPointsPerGeometry))
    .min(1),
});

const httpsUrlSchema = z
  .string()
  .url()
  .refine((value) => value.startsWith('https://'), 'must be an https URL');

const propertiesSchema = z.object({
  labelKey: z.string().regex(MAP_LABEL_KEY_PATTERN),
  descriptionKey: z.string().regex(MAP_LABEL_KEY_PATTERN).optional(),
  /** Any absolute URL: the API only accepts images from its own upload endpoint. */
  imageUrl: z.string().url().optional(),
  /** Card actions leave the app, so they must be https and allowlisted by the API. */
  linkUrl: httpsUrlSchema.optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  minzoom: z.number().int().min(0).max(22).optional(),
  /** 1-based position in a numbered series, e.g. the stops of an itinerary. */
  labelIndex: z.number().int().min(1).optional(),
});

const featureSchema = z.object({
  type: z.literal('Feature'),
  geometry: z.discriminatedUnion('type', [pointSchema, lineSchema, polygonSchema]),
  properties: propertiesSchema,
});

export const mapDocumentSchema = z.object({
  key: z.string().min(1).max(64).regex(MAP_DOCUMENT_KEY_PATTERN),
  scope: z.enum(['global', 'experience']),
  zIndex: z.number().int().min(0).max(1000).optional(),
  version: z.number().int().min(0).optional(),
  collection: z.object({
    type: z.literal('FeatureCollection'),
    features: z.array(featureSchema).max(MAP_REFERENCE_LIMITS.maxFeatures),
  }),
});

/** Parses an untrusted document, throwing a ZodError when it is not drawable. */
export function parseMapDocument(input: unknown): MapDocument {
  return mapDocumentSchema.parse(input) as MapDocument;
}
