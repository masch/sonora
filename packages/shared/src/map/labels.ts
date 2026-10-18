import type { MapDocument } from './document';

/** Resolves a translation key to display text. */
export type TranslateKey = (key: string) => string;

/**
 * Injects the translated `label` into every feature. MapLibre cannot call the
 * translation layer, so labels are resolved before the document reaches the
 * map. A missing translation falls back to the key itself: a visible failure
 * instead of a silent blank.
 */
export function withResolvedLabels(document: MapDocument, translate: TranslateKey): MapDocument {
  return {
    ...document,
    collection: {
      ...document.collection,
      features: document.collection.features.map((feature) => ({
        ...feature,
        properties: { ...feature.properties, label: translate(feature.properties.labelKey) },
      })),
    },
  };
}
