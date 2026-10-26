/**
 * The basemap layer groups the selector offers, and what each renderer can do
 * with them.
 *
 * The two hosts read this module and nothing else: `map.layers.groups` travels
 * from `/config` as an open list of ids (S2 — the server turns groups on and off
 * without a build), and both the MapLibre adapter and the control resolve it
 * here, so the vocabulary cannot drift between them.
 *
 * Two rules keep a payload written by a newer server harmless:
 *
 * 1. **Group ids are open.** The schema accepts any string, and this build drops
 *    the ids it does not implement instead of failing: a group announced before
 *    every published build knows it changes nothing for the builds that don't.
 * 2. **A layer belongs to the group whose prefix matches first**, and the
 *    always-on layers are resolved before any group. The published Protomaps
 *    light style names its 71 layers by prefix (`roads_*`, `water_*`, …), so a
 *    group is a prefix table, not a hand-kept list of ids that the next style
 *    release would quietly invalidate.
 */

/**
 * The groups a client may show or hide, in the order the control renders them.
 * This order is the whole vocabulary: resolution sorts by it, so the payload's
 * order never reaches the UI.
 */
export const MAP_LAYER_GROUPS = [
  'roads',
  'water',
  'places',
  'pois',
  'boundaries',
  'green',
  'buildings',
] as const;

export type MapLayerGroupId = (typeof MAP_LAYER_GROUPS)[number];

/**
 * The style-layer prefixes each group owns.
 *
 * Prefixes are matched with `startsWith`, which is why `boundaries` also claims
 * `boundaries_country` and `buildings` also claims `address_label`. `north` is
 * not a prefix any group lists, so an id no group matches is simply unclaimed.
 *
 * `landcover` is deliberately absent from this table: it is one of the always-on
 * layers, and a group that lists a prefix it can never own is an entry a reader
 * has to check twice on every change.
 */
export const LAYER_GROUP_PREFIXES: Record<MapLayerGroupId, readonly string[]> = {
  roads: ['roads'],
  water: ['water'],
  places: ['places'],
  pois: ['pois'],
  boundaries: ['boundaries'],
  green: ['landuse_'],
  buildings: ['buildings', 'address_'],
};

/**
 * Layers every client draws, whatever the payload asks otherwise: the canvas
 * itself. Hiding the background leaves a flat rectangle behind everything the
 * user did ask for, and `earth` is what the whole map is drawn on.
 *
 * `earth` also covers `earth_label_islands`: an island name with no island under
 * it is the same defect one zoom in.
 */
export const ALWAYS_ON_LAYER_PREFIXES: readonly string[] = ['background', 'earth', 'landcover'];

/** The group a style layer belongs to, or `null` for the canvas and the unknown. */
export function groupOfLayer(layerId: string): MapLayerGroupId | null {
  // Always-on first: a layer that has to stay drawn must never be claimed, even
  // by a group whose prefix table lists it.
  if (ALWAYS_ON_LAYER_PREFIXES.some((prefix) => layerId.startsWith(prefix))) return null;

  for (const group of MAP_LAYER_GROUPS) {
    if (LAYER_GROUP_PREFIXES[group].some((prefix) => layerId.startsWith(prefix))) return group;
  }

  return null;
}

/**
 * The concrete style layer ids a group owns, in the order the style draws them,
 * which is the order they have to be handed back to `setLayoutProperty`.
 */
export function layerIdsForGroup(layerIds: Iterable<string>, group: MapLayerGroupId): string[] {
  const owned: string[] = [];
  for (const layerId of layerIds) {
    if (groupOfLayer(layerId) === group) owned.push(layerId);
  }
  return owned;
}

/** One group of `map.layers.groups` as the schema parses it: an id and its default. */
export interface MapLayerGroupConfig {
  id: string;
  defaultVisible: boolean;
}

/** One row of the control: a group this build implements and whether it draws. */
export interface MapLayerSelection {
  id: MapLayerGroupId;
  visible: boolean;
}

/**
 * Which groups the active renderer can actually toggle.
 *
 * Kept as data here rather than asked of the component, so the UI never branches
 * on a renderer name: it asks a capability object, and a third renderer later is
 * one more constant.
 */
export interface MapLayerCapabilities {
  readonly groups: readonly MapLayerGroupId[];
}

/**
 * MapLibre draws each style layer on its own, so every group can be switched off
 * without disturbing the rest.
 */
export const MAPLIBRE_LAYER_CAPABILITIES: MapLayerCapabilities = { groups: MAP_LAYER_GROUPS };

/**
 * Leaflet draws OSM raster tiles with roads, labels and points baked into the
 * same tiles, so it can toggle nothing. Leaflet is frozen (S3): this constant is
 * the whole of its participation in the selector.
 */
export const LEAFLET_LAYER_CAPABILITIES: MapLayerCapabilities = { groups: [] };

/**
 * What the control should draw, from the payload and the active renderer.
 *
 * One entry per group the renderer supports, in `MAP_LAYER_GROUPS` order:
 *
 * - a group the renderer does not support is dropped;
 * - an id this build does not implement (`telemetry`, from a newer server) is
 *   dropped rather than invented or turned into a crash;
 * - a supported group the payload omits falls back to its built-in default,
 *   visible, which reproduces the map every build drew before the selector
 *   existed;
 * - `visible` comes from the payload's `defaultVisible` when it mentions the
 *   group. The first mention wins if the payload repeats one.
 */
export function resolveLayerSelection(
  configGroups: readonly MapLayerGroupConfig[],
  capabilities: MapLayerCapabilities,
): MapLayerSelection[] {
  const declared = new Map<string, boolean>();
  for (const group of configGroups) {
    if (!declared.has(group.id)) declared.set(group.id, group.defaultVisible);
  }

  return MAP_LAYER_GROUPS.filter((id) => capabilities.groups.includes(id)).map((id) => ({
    id,
    visible: declared.get(id) ?? true,
  }));
}

/**
 * Whether the selector button is offered at all.
 *
 * Off when the payload says off **or** when the renderer supports no group: a
 * control with nothing in it is worse than no control, because it promises a
 * choice the renderer cannot honour.
 */
export function showLayerControl(configured: boolean, capabilities: MapLayerCapabilities): boolean {
  return configured && MAP_LAYER_GROUPS.some((id) => capabilities.groups.includes(id));
}
