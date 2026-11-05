/** Prefix shared by every source and layer this module owns. */
export const REFERENCE_SOURCE_PREFIX = 'refs:';

const DEFAULT_COLOR = '#065f46';
const LABEL_FONT = ['Noto Sans Regular'];
/** The heavier face the hub's own labels use, so they read as things to open. */
const BOLD_LABEL_FONT = ['Noto Sans Medium'];

/**
 * The weight the world hub gives the experiences' own markers.
 *
 * The hub keeps every name the basemap publishes — a barrio is named where the document
 * names it — so the experiences cannot be told apart by the absence of anything
 * underneath them. They carry their own weight instead. Written once, in the module both
 * renderers build their reference layers from, so a label that is 13 px on the web build
 * is 13 px on a device, and deliberately above the basemap's own names: the walker has to
 * be able to tell at a glance which names on that frame are things they can open.
 */
const BOLD_LABEL_SIZE = ['interpolate', ['linear'], ['zoom'], 13, 11, 15, 12];
/**
 * The column the bold label wraps into: wide enough that a hub title stays on one line.
 *
 * The three experiences at the north of the world sit 137 and 204 metres apart, which is
 * 19 and 28 pixels on a phone card, and a two-line label is about 32 pixels tall. Three
 * stacked two-line labels need roughly 96 pixels of the 47 available, so MapLibre culls
 * one of them: that is why the northernmost experience had no name at all. One line per
 * label is 16 pixels, and three of those do fit the band.
 *
 * Twenty em at 13 px is 260 px, wider than any hub title and far narrower than the card,
 * so this buys the single line without turning a long name into a wall of text.
 */
const BOLD_TEXT_MAX_WIDTH = 20;
const BOLD_HALO_WIDTH = 3;

/**
 * The property a point carries when its name must grow leftwards, and the share of the
 * frame that makes it so.
 *
 * MapLibre reads an anchor order per layer, never per feature, so the side has to be a
 * datum the style filters on: one label layer grows names east, a second grows them west.
 * Only a point against the eastern edge needs the second, because a name growing east from
 * there is drawn past the card and cut.
 */
export const LABEL_WEST_SIDE = 'west';
export const LABEL_WEST_FROM_FRAME_SHARE = 0.8;
/**
 * The dot, one size for every caller.
 *
 * It used to grow with the bold half, and the walker asked for it back down: on a phone
 * the bigger dot crowded the neighbours long before the label did, and the emphasis is
 * carried by the face and the halo anyway. One constant, so the hub's dot and the detail
 * map's dot cannot drift apart.
 */
const DOT_RADIUS = 6;
const DOT_STROKE_WIDTH = 2;

/**
 * The tap target, which is not the dot the walker sees.
 *
 * A thumb covers about ten millimetres and the drawn dot covers five: a target the size
 * of the marker is a target the walker misses. The circle below is drawn at a radius the
 * thumb can find and at an opacity just above zero, because a layer at zero is not drawn
 * and a layer that is not drawn is not hit. It draws nothing the eye can see and answers
 * a press the dot alone would have lost.
 */
const BOLD_HIT_RADIUS = 16;
const BOLD_HIT_OPACITY = 0.01;

export interface MapStyleLayer {
  id: string;
  type: 'fill' | 'line' | 'circle' | 'symbol';
  source: string;
  filter?: unknown[];
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  minzoom?: number;
}

export function referenceSourceId(key: string): string {
  return `${REFERENCE_SOURCE_PREFIX}${key}`;
}

/**
 * The four layers a reference document needs: areas, lines, points and labels.
 * Styling reads feature properties, so the layers do not depend on document content.
 */
export interface ReferenceLayerOptions {
  /** Labels need a glyphs source in the style; omit them when there is none. */
  includeLabels?: boolean;
  /**
   * Which side of the point the label sits on. Two documents that describe the same
   * place — a reference and the itinerary stop that lands on it — read as one
   * corrupted word when both anchor the same way, so they are given opposite sides.
   */
  labelAnchor?: 'top' | 'bottom';
  /**
   * Whether a label may try all four sides of its point instead of the one side above.
   *
   * A crowded document — three places inside a hamlet — gives its labels one shared
   * position and MapLibre drops every label it cannot place. A movable label is offered
   * `top`, `bottom`, `left` and `right` in turn and keeps the first side that is free, so
   * it moves instead of disappearing. It is not permission to overlap: a label with no
   * free side is still culled, which is what stops two of them reading as one word.
   */
  movableLabels?: boolean;
  /**
   * Whether the references draw with their own weight, above the basemap's names.
   *
   * Asked for by the world hub, the one frame where an openable experience and the barrio
   * it sits in are drawn together: a larger label, a heavier halo, a bigger dot and a tap
   * target wider than the dot. Read here and nowhere else, so both renderers take the
   * numbers from one place; absent or false builds today's layers exactly, which is what
   * every other map draws.
   */
  bold?: boolean;
}

export function buildReferenceStyleLayers(
  sourceId: string,
  options: ReferenceLayerOptions = {},
): MapStyleLayer[] {
  const color = ['coalesce', ['get', 'color'], DEFAULT_COLOR];
  // A feature may declare the zoom it appears at; MapLibre cannot read a
  // per-feature minzoom on the layer, so it becomes a zoom comparison.
  const fromZoom = ['>=', ['zoom'], ['coalesce', ['get', 'minzoom'], 0]];
  const forGeometry = (kind: string) => ['all', ['==', ['geometry-type'], kind], fromZoom];
  const bold = options.bold === true;

  const layers: MapStyleLayer[] = [
    {
      id: `${sourceId}:fill`,
      type: 'fill',
      source: sourceId,
      filter: forGeometry('Polygon'),
      paint: { 'fill-color': color, 'fill-opacity': 0.25, 'fill-outline-color': color },
    },
    {
      id: `${sourceId}:line`,
      type: 'line',
      source: sourceId,
      filter: forGeometry('LineString'),
      paint: { 'line-color': color, 'line-width': 3, 'line-opacity': 0.9 },
    },
  ];

  if (bold) {
    // Added before the dot, because MapLibre draws in array order: the target sits under
    // the marker and the marker is what the eye reads. Its id still names the document
    // (`refs:<key>:circle-hit`), which is what makes the press path work untouched on
    // both renderers: they answer a tap by asking which reference layer was touched, and
    // the key is read out of whichever one it was.
    layers.push({
      id: `${sourceId}:circle-hit`,
      type: 'circle',
      source: sourceId,
      filter: forGeometry('Point'),
      paint: {
        'circle-color': color,
        'circle-radius': BOLD_HIT_RADIUS,
        'circle-opacity': BOLD_HIT_OPACITY,
      },
    });
  }

  layers.push({
    id: `${sourceId}:circle`,
    type: 'circle',
    source: sourceId,
    filter: forGeometry('Point'),
    paint: {
      'circle-color': color,
      'circle-radius': DOT_RADIUS,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': DOT_STROKE_WIDTH,
    },
  });

  if (options.includeLabels !== false) {
    const anchor = options.labelAnchor ?? 'top';
    const movable = options.movableLabels === true;
    const placement = movable
      ? {
          // Four candidate sides, and the order is the difference between a label that
          // fits and one the card never shows. This branch draws the world hub: its points
          // sit close together on a tall card, so the label stacks above or below its dot
          // first and only moves sideways when both vertical sides are taken. Horizontal
          // first was the old order and it clipped the leftmost experience off the card,
          // because the style cannot know where the viewport ends. The classic order below
          // stays horizontal-first on purpose: the detail map's crowds run along a road, so
          // a label beside its point is unambiguous there.
          'text-variable-anchor': bold
            ? ['left', 'top', 'bottom', 'right']
            : ['left', 'right', 'top', 'bottom'],
          'text-radial-offset': 0.25,
          // A title's width is the one extent the fit cannot know, so the label wraps at a
          // fixed width instead of extending sideways for as long as its words are. The bold
          // face wraps narrower (see BOLD_TEXT_MAX_WIDTH) so its bigger glyphs do not outrun
          // the same frame.
          'text-max-width': bold ? BOLD_TEXT_MAX_WIDTH : 8,
          // A crowd is a size problem before it is a placement problem: at the wide frame
          // the world opens on, a smaller label fits where a full one would have to move.
          'text-size': bold
            ? BOLD_LABEL_SIZE
            : ['interpolate', ['linear'], ['zoom'], 13, 10, 15, 12],
          // Whatever the walker came for is placed first, so it keeps its label when the
          // last free side is taken.
          'symbol-sort-key': ['coalesce', ['get', 'sortKey'], 0],
        }
      : {
          'text-anchor': anchor,
          'text-offset': anchor === 'bottom' ? [0, -0.8] : [0, 0.8],
          'text-size': bold ? BOLD_LABEL_SIZE : 12,
        };
    const labelLayout = (anchorOrder: readonly string[]) => ({
      'text-field': ['get', 'labelText'],
      'text-font': bold ? BOLD_LABEL_FONT : LABEL_FONT,
      ...(movable
        ? {
            ...placement,
            'text-variable-anchor': anchorOrder,
          }
        : placement),
      // Culling is the point, not a limitation: with overlap allowed, two labels that land
      // on the same pixel draw on top of each other and read as a corrupted word. A
      // crowded map is expected to drop the loser.
      //
      // It has to stay on. Turning it off stopped MapLibre advancing past the first
      // anchor, so every name sat above its dot and the sides were never tried at all.
      'text-allow-overlap': false,
    });

    const labelPaint = {
      // A reference drawn in a surface colour can still name itself legibly: the label
      // asks for its own colour first, then the reference's, then the default.
      'text-color': ['coalesce', ['get', 'labelColor'], color],
      'text-halo-color': '#ffffff',
      'text-halo-width': bold ? BOLD_HALO_WIDTH : 1.4,
    };

    // Only the hub splits its names by side; every other caller keeps one label layer and
    // the filter it always had.
    const splitSides = bold && movable;

    /** One label layer, with the anchor order its side of the frame needs. */
    const labelLayer = (id: string, anchorOrder: readonly string[], side: 'east' | 'west') => ({
      id,
      type: 'symbol' as const,
      source: sourceId,
      filter: splitSides
        ? [
            ...forGeometry('Point'),
            side === 'west'
              ? ['==', ['get', 'labelSide'], LABEL_WEST_SIDE]
              : ['!', ['has', 'labelSide']],
          ]
        : forGeometry('Point'),
      layout: labelLayout(anchorOrder),
      paint: labelPaint,
    });

    const eastAnchors = bold
      ? ['left', 'top', 'bottom', 'right']
      : ['left', 'right', 'top', 'bottom'];
    layers.push(labelLayer(`${sourceId}:label`, eastAnchors, 'east'));

    // The eastern edge gets its own layer, growing names westwards. Only the world hub asks
    // for it: the detail map has no eastern convention to respect.
    if (splitSides) {
      layers.push(labelLayer(`${sourceId}:label-west`, ['right', 'top', 'bottom', 'left'], 'west'));
    }
  }

  return layers;
}
