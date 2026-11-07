import {
  USER_LOCATION_SOURCE_ID,
  userLocationGeoJson,
  userLocationStyleLayers,
  type UserLocationCoordinates,
} from '@sonora/shared';

import type { MapHandle } from './use-web-map-instance';

/** The walker's label, already translated, and whether it should be drawn at all. */
export interface UserLocationOptions {
  label?: string;
  includeLabel?: boolean;
}

/** Every layer id this module owns, drawn or not. */
function ownedLayerIds(): string[] {
  return userLocationStyleLayers({ includeLabel: true }).map((layer) => layer.id);
}

/**
 * Draws the walker's own position on the web map, or clears it when the device has
 * no fix.
 *
 * Imperative by necessity: the web renderer reconciles everything against a live
 * map, and this has to move with the device without touching the style — a rebuilt
 * style re-fetches every tile the archive is already serving. A source that is
 * already there only gets new data, which is a repaint.
 *
 * The label comes and goes with the caller's setting, so the drawn set is reconciled
 * against the wanted one instead of assumed: the walker's name is the one layer on
 * this map that a walker can switch off.
 */
export function applyUserLocation(
  map: MapHandle,
  coordinates: UserLocationCoordinates | null | undefined,
  options: UserLocationOptions = {},
): void {
  const wanted = userLocationStyleLayers({ includeLabel: options.includeLabel === true });
  const wantedIds = new Set(wanted.map((layer) => layer.id));
  const drawn = new Set((map.getStyle()?.layers ?? []).map((layer) => layer.id));
  const source = map.getSource(USER_LOCATION_SOURCE_ID);

  if (!coordinates) {
    // Nothing to draw, and no half state left behind: the layers go before the source
    // they read from, which is the only order MapLibre accepts.
    for (const layerId of ownedLayerIds()) {
      if (drawn.has(layerId)) map.removeLayer(layerId);
    }
    if (source) map.removeSource(USER_LOCATION_SOURCE_ID);
    return;
  }

  const data = userLocationGeoJson(coordinates, options.label);
  if (source?.setData) {
    source.setData(data);
  } else {
    map.addSource(USER_LOCATION_SOURCE_ID, { type: 'geojson', data });
  }

  // Added with no anchor, so the pair sits above every document already drawn: the
  // walker's own position is never hidden behind a place.
  for (const layer of wanted) {
    if (!drawn.has(layer.id)) map.addLayer(layer);
  }
  for (const layerId of drawn) {
    if (!layerId.startsWith(`${USER_LOCATION_SOURCE_ID}:`)) continue;
    if (wantedIds.has(layerId)) continue;
    map.removeLayer(layerId);
  }
}
