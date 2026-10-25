import type { MapDocument } from './document';
import { labelAnchorForDocument } from './itinerary';
import {
  buildReferenceStyleLayers,
  REFERENCE_SOURCE_PREFIX,
  referenceSourceId,
  type ReferenceLayerOptions,
} from './style';

/** The slice of the MapLibre map this module needs. Kept small so it is testable. */
export interface MapLike {
  getStyle(): {
    layers?: { id: string; source?: string }[];
    sources?: Record<string, unknown>;
  };
  addSource(id: string, source: unknown): void;
  removeSource(id: string): void;
  addLayer(layer: unknown): void;
  removeLayer(id: string): void;
  getSource(id: string): { setData?: (data: unknown) => void } | undefined;
}

function sourceIdOfLayer(layerId: string): string {
  return layerId.slice(0, layerId.lastIndexOf(':'));
}

/**
 * Idempotently reconciles the map with the given documents: adds what is
 * missing, pushes new data into existing sources, and removes references that
 * are no longer present. Web only; native MapLibre is declarative.
 */
export function applyMapDocuments(
  map: MapLike,
  documents: readonly MapDocument[],
  options: ReferenceLayerOptions = {},
): void {
  // Layer add order is draw order, so the documents are reconciled in the
  // order the schema already documents: lower zIndex first, then key.
  const ordered = [...documents].sort(
    (left, right) => (left.zIndex ?? 0) - (right.zIndex ?? 0) || left.key.localeCompare(right.key),
  );

  const desired = new Map<string, MapDocument>();
  for (const document of ordered) desired.set(referenceSourceId(document.key), document);

  const style = map.getStyle() ?? {};
  const existingLayers = (style.layers ?? []).map((layer) => layer.id);
  const existingSources = Object.keys(style.sources ?? {});

  for (const layerId of existingLayers) {
    if (!layerId.startsWith(REFERENCE_SOURCE_PREFIX)) continue;
    const sourceId = sourceIdOfLayer(layerId);
    // A desired source can still carry a stale label layer when labels are off.
    if (desired.has(sourceId) && !(options.includeLabels === false && layerId.endsWith(':label'))) {
      continue;
    }
    map.removeLayer(layerId);
  }
  for (const sourceId of existingSources) {
    if (!sourceId.startsWith(REFERENCE_SOURCE_PREFIX)) continue;
    if (!desired.has(sourceId)) map.removeSource(sourceId);
  }

  for (const [sourceId, document] of desired) {
    const existing = map.getSource(sourceId);
    if (existing?.setData) {
      existing.setData(document.collection);
    } else if (!existing) {
      map.addSource(sourceId, { type: 'geojson', data: document.collection });
    }

    for (const layer of buildReferenceStyleLayers(sourceId, {
      ...options,
      labelAnchor: labelAnchorForDocument(document.key),
    })) {
      if (!existingLayers.includes(layer.id)) map.addLayer(layer);
    }
  }
}
