import type { MapDocument } from './document';
import { buildReferenceStyleLayers, REFERENCE_SOURCE_PREFIX, referenceSourceId } from './style';

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
export function applyMapDocuments(map: MapLike, documents: readonly MapDocument[]): void {
  const desired = new Map<string, MapDocument>();
  for (const document of documents) desired.set(referenceSourceId(document.key), document);

  const style = map.getStyle() ?? {};
  const existingLayers = (style.layers ?? []).map((layer) => layer.id);
  const existingSources = Object.keys(style.sources ?? {});

  for (const layerId of existingLayers) {
    if (!layerId.startsWith(REFERENCE_SOURCE_PREFIX)) continue;
    if (!desired.has(sourceIdOfLayer(layerId))) map.removeLayer(layerId);
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

    for (const layer of buildReferenceStyleLayers(sourceId)) {
      if (!existingLayers.includes(layer.id)) map.addLayer(layer);
    }
  }
}
