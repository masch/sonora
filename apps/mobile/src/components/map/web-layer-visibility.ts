import {
  MAP_LAYER_GROUPS,
  layerIdsForGroup,
  type MapLayerGroupId,
  type MapLayerSelection,
} from '@sonora/shared';

/** The slice of the MapLibre GL JS map this module drives. */
export interface LayerVisibilityHandle {
  getStyle(): { layers?: { id: string }[] };
  setLayoutProperty(layerId: string, name: string, value: string): void;
}

/**
 * Makes a web map obey the selection by rewriting the layers it already drew.
 *
 * Both renderers must land on the same picture, and they only can if they follow the
 * same rules — the ones `applyLayerGroups` states for the native style, read here as
 * imperative calls:
 *
 * - **silence is not a decision**: only a group the selection *declares* is walked, so
 *   a style that hid a layer on purpose keeps it hidden until someone names the group;
 * - a declared hidden group's layers get `visibility: 'none'`; a declared visible
 *   one gets `'visible'`, which is what the style means by leaving the key out;
 * - the canvas and every layer no group claims — `background`, `earth`, the `refs:*`
 *   layers of our own documents — are never touched, because ownership comes from the
 *   style's own layer ids through `layerIdsForGroup` rather than a hardcoded list.
 *
 * A style reload would answer the same question by re-fetching every tile, so it is
 * the one thing this must not do: `setLayoutProperty` writes the decision onto the
 * drawn map and MapLibre repaints.
 */
export function applyLayerSelection(
  map: LayerVisibilityHandle,
  selection: readonly MapLayerSelection[],
): void {
  const declared = new Map<MapLayerGroupId, boolean>();
  for (const entry of selection) {
    if (entry.declared) declared.set(entry.id, entry.visible);
  }
  if (declared.size === 0) return;

  const styleLayerIds = (map.getStyle().layers ?? []).map((layer) => layer.id);
  for (const group of MAP_LAYER_GROUPS) {
    const visible = declared.get(group);
    if (visible === undefined) continue;
    const visibility = visible ? 'visible' : 'none';
    for (const layerId of layerIdsForGroup(styleLayerIds, group)) {
      map.setLayoutProperty(layerId, 'visibility', visibility);
    }
  }
}
