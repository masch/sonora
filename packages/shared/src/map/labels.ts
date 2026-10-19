import type { MapDocument } from './document';

/** Options handed to the translation layer, e.g. the `index` of `map.point`. */
export type TranslateOptions = Record<string, unknown>;

/** Resolves a translation key to display text. */
export type TranslateKey = (key: string, options?: TranslateOptions) => string;

/**
 * Injects the translated `label` into every feature. MapLibre cannot call the
 * translation layer, so labels are resolved before the document reaches the
 * map. A missing translation falls back to the key itself: a visible failure
 * instead of a silent blank.
 *
 * A feature carrying `labelIndex` passes it as `{ index }`, so numbered keys
 * such as `map.point` (`'Pt {{index}}'`) interpolate instead of printing the
 * placeholder.
 */
export function withResolvedLabels(document: MapDocument, translate: TranslateKey): MapDocument {
  return {
    ...document,
    collection: {
      ...document.collection,
      features: document.collection.features.map((feature) => {
        const { labelKey, labelIndex } = feature.properties;
        return {
          ...feature,
          properties: {
            ...feature.properties,
            label: translate(
              labelKey,
              labelIndex === undefined ? undefined : { index: labelIndex },
            ),
          },
        };
      }),
    },
  };
}
