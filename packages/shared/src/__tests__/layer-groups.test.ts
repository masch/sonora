import { describe, expect, it } from 'vitest';

import {
  ALWAYS_ON_LAYER_PREFIXES,
  LAYER_GROUP_PREFIXES,
  LEAFLET_LAYER_CAPABILITIES,
  MAPLIBRE_LAYER_CAPABILITIES,
  MAP_LAYER_GROUPS,
  applyLayerGroups,
  groupOfLayer,
  layerIdsForGroup,
  resolveLayerSelection,
  showLayerControl,
  type MapLayerGroupId,
  type MapLayerSelection,
} from '../map/layer-groups';

/**
 * The 71 layers of the published Protomaps light style, in the order the style
 * draws them. Written out here rather than fetched: the point of the fixture is
 * that it stays the style this build was proved against, whatever the tile
 * pipeline publishes next.
 */
const PUBLISHED_STYLE_LAYER_IDS: readonly string[] = [
  'background',
  'earth',
  'landcover',
  'landuse_park',
  'landuse_urban_green',
  'landuse_hospital',
  'landuse_industrial',
  'landuse_school',
  'landuse_beach',
  'landuse_zoo',
  'landuse_aerodrome',
  'roads_runway',
  'roads_taxiway',
  'landuse_runway',
  'water',
  'water_stream',
  'water_river',
  'landuse_pedestrian',
  'landuse_pier',
  'roads_tunnels_other_casing',
  'roads_tunnels_minor_casing',
  'roads_tunnels_link_casing',
  'roads_tunnels_major_casing',
  'roads_tunnels_highway_casing',
  'roads_tunnels_other',
  'roads_tunnels_minor',
  'roads_tunnels_link',
  'roads_tunnels_major',
  'roads_tunnels_highway',
  'buildings',
  'roads_pier',
  'roads_minor_service_casing',
  'roads_minor_casing',
  'roads_link_casing',
  'roads_major_casing_late',
  'roads_highway_casing_late',
  'roads_other',
  'roads_link',
  'roads_minor_service',
  'roads_minor',
  'roads_major_casing_early',
  'roads_major',
  'roads_highway_casing_early',
  'roads_highway',
  'roads_rail',
  'boundaries_country',
  'boundaries',
  'roads_bridges_other_casing',
  'roads_bridges_link_casing',
  'roads_bridges_minor_casing',
  'roads_bridges_major_casing',
  'roads_bridges_other',
  'roads_bridges_minor',
  'roads_bridges_link',
  'roads_bridges_major',
  'roads_bridges_highway_casing',
  'roads_bridges_highway',
  'address_label',
  'water_waterway_label',
  'roads_oneway',
  'roads_labels_minor',
  'water_label_ocean',
  'earth_label_islands',
  'water_label_lakes',
  'roads_shields',
  'roads_labels_major',
  'pois',
  'places_subplace',
  'places_region',
  'places_locality',
  'places_country',
];

/** The layers a group could claim by prefix, ignoring the always-on rule. */
function groupsMatching(id: string): MapLayerGroupId[] {
  return MAP_LAYER_GROUPS.filter((group) =>
    LAYER_GROUP_PREFIXES[group].some((prefix) => id.startsWith(prefix)),
  );
}

function isAlwaysOn(id: string): boolean {
  return ALWAYS_ON_LAYER_PREFIXES.some((prefix) => id.startsWith(prefix));
}

describe('group vocabulary', () => {
  it('claims every published layer exactly once, or leaves it always-on', () => {
    expect(PUBLISHED_STYLE_LAYER_IDS).toHaveLength(71);

    for (const id of PUBLISHED_STYLE_LAYER_IDS) {
      const matching = groupsMatching(id);
      expect(matching.length, `${id} matched by ${matching.join(', ')}`).toBeLessThanOrEqual(1);

      const group = groupOfLayer(id);
      if (group === null) {
        // Unclaimed is only allowed for the canvas: everything else would be a
        // layer nobody can hide, drawn although the payload asked otherwise.
        expect(isAlwaysOn(id), `${id} is neither claimed nor always-on`).toBe(true);
      } else {
        expect(matching, `${id} resolved to ${group}`).toEqual([group]);
      }
    }
  });

  it('owns the published ids per group', () => {
    const counts = Object.fromEntries(
      MAP_LAYER_GROUPS.map((group) => [
        group,
        layerIdsForGroup(PUBLISHED_STYLE_LAYER_IDS, group).length,
      ]),
    );

    // `green` owns the eleven `landuse_*` layers; `landcover` is always-on, so the
    // group never hides it whatever its prefix table says.
    expect(counts).toEqual({
      roads: 41,
      water: 6,
      places: 4,
      pois: 1,
      boundaries: 2,
      green: 11,
      buildings: 2,
    });

    for (const group of MAP_LAYER_GROUPS) {
      for (const id of layerIdsForGroup(PUBLISHED_STYLE_LAYER_IDS, group)) {
        expect(isAlwaysOn(id), `${id} must not be owned by ${group}`).toBe(false);
      }
    }
  });

  it('keeps the canvas out of every group', () => {
    // Hiding any of these leaves a flat rectangle behind what the user did ask for.
    for (const id of ['background', 'earth', 'earth_label_islands', 'landcover']) {
      expect(groupOfLayer(id)).toBeNull();
    }
  });

  it('answers null for a layer this build has never heard of', () => {
    expect(groupOfLayer('future-layer-42')).toBeNull();
  });
});

describe('resolveLayerSelection', () => {
  it('drops a group id this build does not implement and keeps the rest', () => {
    const selection = resolveLayerSelection(
      [
        { id: 'telemetry', defaultVisible: false },
        { id: 'water', defaultVisible: false },
      ],
      MAPLIBRE_LAYER_CAPABILITIES,
    );

    expect(selection.map((entry) => entry.id)).toEqual([...MAP_LAYER_GROUPS]);
    expect(selection.find((entry) => entry.id === 'water')?.visible).toBe(false);
  });

  it("keeps the payload's defaultVisible", () => {
    const selection = resolveLayerSelection(
      [{ id: 'water', defaultVisible: false }],
      MAPLIBRE_LAYER_CAPABILITIES,
    );

    expect(selection.filter((entry) => entry.visible)).toHaveLength(MAP_LAYER_GROUPS.length - 1);
  });

  it('falls back to visible for a supported group the payload omits', () => {
    const selection = resolveLayerSelection([], MAPLIBRE_LAYER_CAPABILITIES);

    expect(selection).toEqual(
      MAP_LAYER_GROUPS.map((id) => ({ id, visible: true, declared: false })),
    );
  });

  it('yields nothing for a renderer that cannot toggle a layer', () => {
    // Leaflet draws OSM raster tiles with the labels baked in: there is no layer
    // to switch off, so it supports no group at all.
    expect(
      resolveLayerSelection([{ id: 'roads', defaultVisible: false }], LEAFLET_LAYER_CAPABILITIES),
    ).toEqual([]);
  });

  it('orders the selection the same way whatever the payload lists first', () => {
    const forward = resolveLayerSelection(
      [
        { id: 'roads', defaultVisible: false },
        { id: 'water', defaultVisible: false },
        { id: 'pois', defaultVisible: false },
      ],
      MAPLIBRE_LAYER_CAPABILITIES,
    );
    const reversed = resolveLayerSelection(
      [
        { id: 'pois', defaultVisible: false },
        { id: 'water', defaultVisible: false },
        { id: 'roads', defaultVisible: false },
      ],
      MAPLIBRE_LAYER_CAPABILITIES,
    );

    expect(reversed).toEqual(forward);
    expect(forward.map((entry) => entry.id)).toEqual([...MAP_LAYER_GROUPS]);
  });
});

/** A style layer as the document carries it: an id and no layout it did not author. */
interface FixtureLayer {
  id: string;
  type: string;
  layout?: Record<string, unknown>;
}

function styleLayers(ids: readonly string[] = PUBLISHED_STYLE_LAYER_IDS): FixtureLayer[] {
  return ids.map((id) => ({ id, type: 'background' }));
}

/** Every group this build implements, all named by the payload and drawn. */
const ALL_VISIBLE: readonly MapLayerSelection[] = MAP_LAYER_GROUPS.map((id) => ({
  id,
  visible: true,
  declared: true,
}));

/** The same selection with `hidden` named and switched off, everything else named and drawn. */
function hiding(hidden: readonly MapLayerGroupId[]): MapLayerSelection[] {
  return MAP_LAYER_GROUPS.map((id) => ({ id, visible: !hidden.includes(id), declared: true }));
}

function layoutOf(
  layers: readonly FixtureLayer[],
  id: string,
): Record<string, unknown> | undefined {
  return layers.find((layer) => layer.id === id)?.layout;
}

describe('applyLayerGroups', () => {
  it('returns the very same array when every group is visible', () => {
    // No churn: a new array would be a new style object, and on native a new style
    // makes MapLibre re-apply it and re-fetch its tiles.
    const layers = styleLayers();

    expect(applyLayerGroups(layers, ALL_VISIBLE)).toBe(layers);
  });

  it("hides every layer the payload's group owns, and only that group's", () => {
    const layers = styleLayers();
    const applied = applyLayerGroups(layers, hiding(['water']));
    const water = layerIdsForGroup(PUBLISHED_STYLE_LAYER_IDS, 'water');
    const roads = layerIdsForGroup(PUBLISHED_STYLE_LAYER_IDS, 'roads');

    expect(water.length).toBeGreaterThan(0);
    for (const id of water) expect(layoutOf(applied, id), id).toEqual({ visibility: 'none' });

    expect(roads.length).toBeGreaterThan(0);
    for (const id of roads) expect(layoutOf(applied, id), id).toBeUndefined();
  });

  it('shows a hidden layer again by dropping the key, never by writing "visible"', () => {
    const hidden = applyLayerGroups(styleLayers(), hiding(['water']));
    const shown = applyLayerGroups(hidden, ALL_VISIBLE);

    for (const id of layerIdsForGroup(PUBLISHED_STYLE_LAYER_IDS, 'water')) {
      const layout = layoutOf(shown, id) ?? {};
      // A style layer without the key is visible; pinning `visible` would freeze a
      // decision the style never made.
      expect(layout, id).not.toHaveProperty('visibility');
    }
    expect(shown.some((layer) => layer.layout?.visibility === 'visible')).toBe(false);
  });

  it('never touches the canvas or a layer no group claims', () => {
    // Even with every group off: the canvas is the map itself, and `refs:*` belongs
    // to a document of ours, not to a basemap group.
    const untouched = ['background', 'earth', 'earth_label_islands', 'landcover'];
    const layers = styleLayers([
      ...untouched,
      ...PUBLISHED_STYLE_LAYER_IDS,
      'refs:itinerary:fill',
      'refs:itinerary:circle',
      'north',
    ]);

    const applied = applyLayerGroups(layers, hiding([...MAP_LAYER_GROUPS]));

    for (const id of untouched) expect(layoutOf(applied, id), id).toBeUndefined();
    for (const id of ['refs:itinerary:fill', 'refs:itinerary:circle', 'north']) {
      expect(layoutOf(applied, id), id).toBeUndefined();
    }
    // And the groups really were applied to the rest, so the loop above is not
    // passing because nothing happened at all.
    expect(layoutOf(applied, 'water')).toEqual({ visibility: 'none' });
    expect(layoutOf(applied, 'roads_minor')).toEqual({ visibility: 'none' });
  });

  it('leaves the layers it was handed untouched and copies the ones it changes', () => {
    const layers = styleLayers();
    const before = layers.map((layer) => ({ ...layer }));

    const applied = applyLayerGroups(layers, hiding(['water']));

    expect(layers).toEqual(before);
    expect(layers.every((layer) => layer.layout === undefined)).toBe(true);
    // The changed layers are new objects: nothing in place was mutated, and the
    // input array is still the one the style document holds.
    expect(layoutOf(applied, 'water')).toEqual({ visibility: 'none' });
    expect(applied.find((layer) => layer.id === 'water')).not.toBe(
      layers.find((layer) => layer.id === 'water'),
    );
  });

  it('leaves a layer the style hid on purpose hidden when the payload says nothing', () => {
    // The style authors `visibility: none` on some layers. A payload that names no
    // group is silence, not a decision, so nothing may be un-hidden: the refuter was
    // right that the previous behaviour turned an authored decision into its reverse.
    const layers = [{ id: 'water', layout: { visibility: 'none' } }, { id: 'roads_minor' }];
    const selection = resolveLayerSelection([], MAPLIBRE_LAYER_CAPABILITIES);

    expect(applyLayerGroups(layers, selection)).toBe(layers);
    expect(applyLayerGroups(layers, selection)[0].layout?.visibility).toBe('none');
  });

  it('un-hides an authored layer only when the payload names that group as visible', () => {
    const layers = [{ id: 'water', layout: { visibility: 'none' } }];
    const named = resolveLayerSelection(
      [{ id: 'water', defaultVisible: true }],
      MAPLIBRE_LAYER_CAPABILITIES,
    );

    expect(applyLayerGroups(layers, named)[0].layout?.visibility).toBeUndefined();
    // The source layer is still the style's own: the transform copied it.
    expect(layers[0].layout).toEqual({ visibility: 'none' });
  });

  it('ignores a group this build does not implement', () => {
    // An id from a newer server changes nothing, exactly as `resolveLayerSelection`
    // drops it from the payload.
    const layers = styleLayers();
    const selection: MapLayerSelection[] = [
      ...ALL_VISIBLE,
      { id: 'telemetry' as unknown as MapLayerGroupId, visible: false, declared: true },
    ];

    expect(applyLayerGroups(layers, selection)).toBe(layers);
  });
});

describe('showLayerControl', () => {
  it('offers the control only when the payload and the renderer both allow it', () => {
    expect(showLayerControl(true, MAPLIBRE_LAYER_CAPABILITIES)).toBe(true);
    expect(showLayerControl(false, MAPLIBRE_LAYER_CAPABILITIES)).toBe(false);
    expect(showLayerControl(true, LEAFLET_LAYER_CAPABILITIES)).toBe(false);
    expect(showLayerControl(false, LEAFLET_LAYER_CAPABILITIES)).toBe(false);
  });
});
