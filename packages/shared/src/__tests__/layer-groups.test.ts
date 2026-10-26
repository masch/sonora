import { describe, expect, it } from 'vitest';

import {
  ALWAYS_ON_LAYER_PREFIXES,
  LAYER_GROUP_PREFIXES,
  LEAFLET_LAYER_CAPABILITIES,
  MAPLIBRE_LAYER_CAPABILITIES,
  MAP_LAYER_GROUPS,
  groupOfLayer,
  layerIdsForGroup,
  resolveLayerSelection,
  showLayerControl,
  type MapLayerGroupId,
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

    expect(selection).toEqual(MAP_LAYER_GROUPS.map((id) => ({ id, visible: true })));
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

describe('showLayerControl', () => {
  it('offers the control only when the payload and the renderer both allow it', () => {
    expect(showLayerControl(true, MAPLIBRE_LAYER_CAPABILITIES)).toBe(true);
    expect(showLayerControl(false, MAPLIBRE_LAYER_CAPABILITIES)).toBe(false);
    expect(showLayerControl(true, LEAFLET_LAYER_CAPABILITIES)).toBe(false);
    expect(showLayerControl(false, LEAFLET_LAYER_CAPABILITIES)).toBe(false);
  });
});
