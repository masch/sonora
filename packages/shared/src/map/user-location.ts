import type { MapStyleLayer } from './style';

/**
 * Where the walker is standing, drawn apart from the experiences.
 *
 * Written once here and read by both renderers, for the reason every map decision
 * lives in this package: the same dot has to be the same dot on a phone and on the
 * web build, and a second opinion per platform is how the two drift.
 *
 * Deliberately not a reference document. A reference is a place the payload
 * published — something a tap opens, with a name under it — while this is a fact
 * about the device that moves every few metres. Encoding it as a document would
 * hand it to the layers that answer taps and place labels, and on the declarative
 * renderer it would rebuild the whole map style on every GPS fix.
 */

/** Stable id of the source that carries the walker's point. */
export const USER_LOCATION_SOURCE_ID = 'user-location';

/** The soft disc under the dot, drawn first so the dot sits on top of it. */
export const USER_LOCATION_HALO_LAYER_ID = `${USER_LOCATION_SOURCE_ID}:halo`;

/** The dot itself: the only thing the eye has to read. */
export const USER_LOCATION_DOT_LAYER_ID = `${USER_LOCATION_SOURCE_ID}:dot`;

/**
 * The walker's own name for where they are, drawn under the dot.
 *
 * The Leaflet maps that came before this one put a permanent tooltip on the walker's
 * marker (`map.userLocation`), and this is the same promise on the MapLibre pair: a
 * label the walker does not have to hover to read. It is a layer of its own and not
 * part of the dot so a caller that turns the labels off takes this one with them.
 */
export const USER_LOCATION_LABEL_LAYER_ID = `${USER_LOCATION_SOURCE_ID}:label`;

/**
 * The face the walker's label is drawn in.
 *
 * The same one `style.ts` gives every reference, because it is the only face the
 * glyphs stations publish: a label in anything else would need tiles nobody serves.
 */
const LABEL_FONT = ['Noto Sans Regular'];

/**
 * The one colour in the app that is not a format's.
 *
 * Every experience is drawn in the colour of its format, so the walker's own
 * position cannot borrow one of those or it would read as an experience. A blue
 * nobody publishes is the only honest choice, and the same blue both platforms.
 */
export const USER_LOCATION_COLOR = '#1d4ed8';

/** The smallest thing this module needs to know: degrees, as the app carries them. */
export interface UserLocationCoordinates {
  latitude: number;
  longitude: number;
}

/** What a renderer hands its map: one point, or nothing to draw. */
export interface UserLocationGeoJson {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: { labelText?: string };
  }[];
}

/**
 * The point as the map reads it, or an empty collection when no fix has arrived.
 *
 * GeoJSON positions are `[longitude, latitude]` and the app's coordinates are the
 * other way round, which is the one thing this conversion exists for. Empty rather
 * than absent so a source already on the map can be cleared without being removed.
 *
 * `labelText` arrives already translated: MapLibre cannot call the translation
 * layer, so the caller resolves `map.userLocation` before handing it over.
 */
export function userLocationGeoJson(
  coordinates: UserLocationCoordinates | null | undefined,
  labelText?: string,
): UserLocationGeoJson {
  if (!coordinates) return { type: 'FeatureCollection', features: [] };
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [coordinates.longitude, coordinates.latitude],
        },
        properties: labelText ? { labelText } : {},
      },
    ],
  };
}

export interface UserLocationLayerOptions {
  sourceId?: string;
  /**
   * Draw the label under the dot, as the walker's own name for the place.
   *
   * Asked for by the caller that knows the style can serve glyphs and that labels are
   * on: a symbol layer over a style without a `glyphs` source is a layer that draws
   * nothing and reports it. Absent draws the two circles exactly.
   */
  includeLabel?: boolean;
}

/**
 * The circles that draw the walker, and its label when the caller wants one.
 *
 * The pair is what tells it apart from an experience at a glance, on both a pale
 * and a dark basemap: an experience is a small solid circle in its format's colour,
 * while this is the only thing on the frame with a soft disc behind it. And no tap
 * target, because there is nothing here to open.
 *
 * Paint is the style spec's own, so the same object is a `Layer` on the device and
 * an `addLayer` payload on the web.
 */
export function userLocationStyleLayers(options: UserLocationLayerOptions = {}): MapStyleLayer[] {
  const sourceId = options.sourceId ?? USER_LOCATION_SOURCE_ID;

  const layers: MapStyleLayer[] = [
    {
      id: USER_LOCATION_HALO_LAYER_ID,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-color': USER_LOCATION_COLOR,
        'circle-radius': 26,
        'circle-opacity': 0.16,
      },
    },
    {
      id: USER_LOCATION_DOT_LAYER_ID,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-color': USER_LOCATION_COLOR,
        'circle-radius': 7,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 3,
      },
    },
  ];

  if (options.includeLabel) {
    layers.push({
      id: USER_LOCATION_LABEL_LAYER_ID,
      type: 'symbol',
      source: sourceId,
      layout: {
        'text-field': ['get', 'labelText'],
        'text-font': LABEL_FONT,
        // `top` hangs the text under its point, which is where the references put a
        // name too: below a dot is the one side a card's own clipping never reaches.
        'text-anchor': 'top',
        // Clear of the white ring: one em is the label's own size, so the offset is
        // the room the halo and the ring already take.
        'text-offset': [0, 1.4],
        'text-size': 12,
        // The walker's own name is the one label that must never be culled: a frame
        // crowded with experiences would otherwise drop the only point that is theirs.
        'text-allow-overlap': true,
      },
      paint: {
        // In the dot's colour, so the label and the mark it names read as one thing.
        'text-color': USER_LOCATION_COLOR,
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.4,
      },
    });
  }

  return layers;
}
