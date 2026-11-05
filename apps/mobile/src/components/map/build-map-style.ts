import type {
  StyleSpecification,
  VectorSourceSpecification,
} from '@maplibre/maplibre-react-native';

import {
  applyLayerGroups,
  buildReferenceStyleLayers,
  labelAnchorForDocument,
  movableLabelsForDocument,
  referenceSourceId,
  withResolvedLabels,
  type MapDocument,
  type MapLayerSelection,
  type MapStyleLayer,
  type SupportedLanguage,
  type TranslateKey,
} from '@sonora/shared';

import { attributionWithVersion } from '@/utils/map-attribution';

/**
 * The style the native renderer hands to MapLibre, built from values only.
 *
 * Kept out of the component because none of it reads component state: the base
 * document, the archive on disk and the documents are all inputs, and the same
 * shared builder produces the reference layers the web renderer reconciles.
 */

/**
 * The style drawn when the experience belongs to no published region: no basemap at
 * all, so the reference plane is the whole map. Deliberately not the remote style —
 * its `basemap` points at an archive this device never downloaded, and a canvas that
 * fails to fetch tiles looks broken instead of saying the truth.
 */
export function referencePlaneStyle(): StyleSpecification {
  return { version: 8, sources: {}, layers: [] };
}

/**
 * The style drawn when neither the caller nor the remote config provides one: the
 * archive on disk with no base layers, so the reference documents are still drawn.
 */
export function fallbackStyle(
  archiveUri: string,
  attribution: string | undefined,
): StyleSpecification {
  return {
    version: 8,
    sources: {
      basemap: {
        type: 'vector',
        url: archiveUri,
        ...(attribution ? { attribution } : {}),
      },
    },
    layers: [],
  };
}

/**
 * Draw order and uniqueness, matching what `applyMapDocuments` reconciles on the web.
 */
function orderedDocuments(documents: readonly MapDocument[]): MapDocument[] {
  const ordered = [...documents].sort(
    (left, right) => (left.zIndex ?? 0) - (right.zIndex ?? 0) || left.key.localeCompare(right.key),
  );
  const unique = new Map<string, MapDocument>();
  for (const document of ordered) unique.set(document.key, document);
  return [...unique.values()];
}

/**
 * The reference documents as style sources and layers, over the base style.
 *
 * Both renderers build this from the same shared module: the archive on disk is
 * the basemap's source, every document is a GeoJSON source drawn by
 * `buildReferenceStyleLayers`, and labels are resolved before drawing because
 * MapLibre cannot call the translation layer.
 */
export function buildMapStyle(
  base: StyleSpecification,
  options: {
    /** Absent when the point belongs to no region: there is no basemap to draw. */
    archiveUri?: string;
    /**
     * The version of the archive this style draws, so the credit MapLibre shows can say
     * which artifact it is (`© OpenStreetMap contributors (v7)`).
     *
     * Read here, where the document and the resolved version are both inputs of one
     * style build, and composed here rather than in the document: the document is the
     * publisher's and is kept in a page cache under its url, so a suffix written into it
     * would outlive the archive it named.
     */
    archiveVersion?: string | null;
    documents: readonly MapDocument[];
    /** Which basemap groups draw, resolved once by the view. */
    selection: readonly MapLayerSelection[];
    /**
     * Whether the references draw above the basemap's names, as the caller asked.
     *
     * Handed down to the shared builder, so the numbers are the builder's and a label
     * that is 13 px here is 13 px on the web build. The basemap's own layers are not
     * part of this: they are drawn exactly as the document published them.
     */
    boldReferences: boolean;
    showLabels: boolean;
    translate: TranslateKey;
    /** The active language: a self-contained reference draws its own text for it. */
    language: SupportedLanguage;
  },
): StyleSpecification {
  const {
    archiveUri,
    archiveVersion,
    documents,
    selection,
    boldReferences,
    showLabels,
    translate,
    language,
  } = options;
  // A label layer is a symbol layer: without a glyphs source MapLibre fails to
  // draw it, so labels only exist when the base style can serve them.
  const includeLabels = showLabels && Boolean(base.glyphs);
  const basemap = base.sources?.basemap as VectorSourceSpecification | undefined;
  // The credit is the document's own, extended with the version of the archive this
  // device draws: the notice is never invented, and a style that publishes none (or an
  // archive no version could be read from) keeps exactly what it wrote.
  const attribution = attributionWithVersion(basemap?.attribution, archiveVersion);

  const sources: Record<string, unknown> = {
    ...base.sources,
    // The archive is a file on the device: its transport url replaces the remote
    // one the style was authored with, exactly as the web renderer swaps in its
    // in-memory one. Without an archive there is no basemap at all.
    ...(archiveUri
      ? {
          basemap: {
            ...basemap,
            type: 'vector',
            url: archiveUri,
            ...(attribution === undefined ? {} : { attribution }),
          },
        }
      : {}),
  };

  // The groups are applied to the basemap's own layers, before any document layer
  // is appended: our references are not a basemap group and no group may blank them.
  // The transform is pure, so this stays a declarative rebuild of the style.
  const layers: MapStyleLayer[] = applyLayerGroups(
    [...(base.layers ?? [])] as unknown as MapStyleLayer[],
    selection,
  );

  for (const document of orderedDocuments(documents)) {
    const sourceId = referenceSourceId(document.key);
    sources[sourceId] = {
      type: 'geojson',
      data: withResolvedLabels(document, translate, language).collection,
    };
    layers.push(
      ...buildReferenceStyleLayers(sourceId, {
        includeLabels,
        labelAnchor: labelAnchorForDocument(document.key),
        movableLabels: movableLabelsForDocument(document.key),
        bold: boldReferences,
      }),
    );
  }

  // The shared builder types `filter` as `unknown[]` because it has no dependency
  // on the style spec; this cast is where the two declarations meet.
  return { ...base, sources, layers } as StyleSpecification;
}
