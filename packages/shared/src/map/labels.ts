import type { SupportedLanguage } from '../enums';
import { DEFAULT_LANGUAGE } from '../enums';
import type { MapDocument, MapReferenceText } from './document';

/** Options handed to the translation layer, e.g. the `index` of `map.point`. */
export type TranslateOptions = Record<string, unknown>;

/** Resolves a translation key to display text. */
export type TranslateKey = (key: string, options?: TranslateOptions) => string;

/**
 * The text a self-contained reference carries for one language.
 *
 * The document promises every supported language, but a caller that forgot to pass
 * one — a renderer wired before this existed — must still draw a label, so it falls
 * back to the default language and then to whatever the document has.
 */
function ownText(
  text: MapReferenceText | undefined,
  language: SupportedLanguage | undefined,
): string | undefined {
  if (text === undefined) return undefined;
  const preferred = language === undefined ? undefined : text[language];
  // The schema requires every supported language, so the default one is always there;
  // the fallback exists for a caller that passed a language the document lacks.
  return preferred ?? text[DEFAULT_LANGUAGE];
}

/**
 * Injects the text for the active language into every feature: `labelText` from the
 * document's own `label` or from `labelKey`, and `descriptionText` the same way.
 *
 * MapLibre cannot call the translation layer, so this happens before the document
 * reaches the map. A key with no translation falls back to the key itself: a visible
 * failure instead of a silent blank.
 *
 * A feature carrying `labelIndex` passes it as `{ index }`, so numbered keys such as
 * `map.point` (`'Pt {{index}}'`) interpolate instead of printing the placeholder.
 */
export function withResolvedLabels(
  document: MapDocument,
  translate: TranslateKey,
  language?: SupportedLanguage,
): MapDocument {
  return {
    ...document,
    collection: {
      ...document.collection,
      features: document.collection.features.map((feature) => {
        const { labelKey, labelIndex, descriptionKey, label, description } = feature.properties;

        const labelText =
          ownText(label, language) ??
          (labelKey === undefined
            ? ''
            : translate(labelKey, labelIndex === undefined ? undefined : { index: labelIndex }));
        const descriptionText =
          ownText(description, language) ??
          (descriptionKey === undefined ? undefined : translate(descriptionKey));

        return {
          ...feature,
          properties: {
            ...feature.properties,
            labelText,
            ...(descriptionText === undefined ? {} : { descriptionText }),
          },
        };
      }),
    },
  };
}
