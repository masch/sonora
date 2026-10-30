/**
 * scripts/map-sprites/icons.ts — the icons this repository adds to the published sheet.
 *
 * Why we add any: the sprite is Protomaps' light sheet, 53 icons, and it has no lodging
 * glyph. `icon-image` in the style is `["get","kind"]` with a single exception, so a POI
 * whose kind has no icon is not drawn with a blank box — it is not drawn at all, which
 * is how every hotel and cabin complex in Calamuchita was missing while the data sat in
 * the tiles.
 *
 * Two glyphs rather than one per kind: the style maps the seven lodging kinds to
 * `lodging` and the four camping kinds to `camping` with a `match`, exactly the way it
 * already maps `station` to `train_station`. A bed is a bed for a hotel, a hostel and a
 * chalet, and eleven icons would say eleven different things about one answer.
 *
 * The colours are sampled from the sheet's own `toilets` and `building` icons, which sit
 * in the same slategray family on the same map: a bed drawn in a different palette next
 * to them would read as a different kind of thing.
 */
import { Painter, type Point } from './raster';
import type { Raster } from './png';

/** The box every icon occupies, in the sheet's own units (19 px at pixel ratio 1). */
export const ICON_BOX = 19;

/** Stroke colour, sampled from the sheet's `toilets` icon. */
const STROKE = [135, 128, 171, 255] as const;

/** Fill colour, sampled from the same icons' body. */
const FILL = [220, 235, 250, 255] as const;

/**
 * A bed: headboard, mattress, pillow, two legs.
 *
 * Drawn to read at 19 px: the frame is a filled band rather than a hairline outline,
 * because at this size a 1 px outline of a rectangle reads as a rectangle outline and
 * not as a bed. The pillow is the shape that identifies it, so it gets the light fill
 * and a clear margin.
 */
function lodging(painter: Painter): void {
  // Headboard, then the mattress running away from it.
  painter.roundRect(2.6, 4.4, 2.6, 11, 1.1, STROKE);
  painter.roundRect(5.2, 8.6, 12, 5.4, 1.3, STROKE);
  painter.roundRect(6.1, 9.4, 10.2, 3.8, 1.05, FILL);
  // Pillow, inside the mattress at the head end: the one shape that says "bed".
  painter.roundRect(6.4, 6.1, 4.2, 3.4, 0.9, STROKE);
  painter.roundRect(6.9, 6.7, 3.2, 2.2, 0.55, FILL);
  // Legs, so the frame is not a floating shelf.
  painter.rect(5.4, 13.6, 1.6, 2.1, STROKE);
  painter.rect(15.6, 13.6, 1.6, 2.1, STROKE);
}

/**
 * A tent: an outlined ridge with a door and a ground line.
 *
 * The outline is stroked rather than filled because a filled triangle at 19 px is a
 * grey blob; the door is the inside line that says which way it opens.
 */
function camping(painter: Painter): void {
  const apex: Point = [9.5, 3.4];
  const left: Point = [2.4, 15.6];
  const right: Point = [16.6, 15.6];
  painter.polygon([apex, right, left], FILL);
  painter.stroke([left, apex, right], 1.5, STROKE);
  painter.stroke(
    [
      [2.4, 15.6],
      [16.6, 15.6],
    ],
    1.5,
    STROKE,
  );
  // The opening, painted solid at the base: at 19 px an outlined flap reads as a
  // smaller triangle inside a triangle, which is a warning sign, not a tent.
  painter.polygon(
    [
      [9.5, 10.6],
      [7.9, 15.5],
      [11.1, 15.5],
    ],
    STROKE,
  );
}

/** The icons this repository owns, in the order they are added to the sheet. */
export const OUR_ICONS = {
  lodging,
  camping,
} as const;

export type OurIconName = keyof typeof OUR_ICONS;

/** Every icon name we add, which is also the set the style may name. */
export const OUR_ICON_NAMES = Object.keys(OUR_ICONS) as OurIconName[];

/** Draws one of our icons at the given pixel ratio, ready to paste into the sheet. */
export function drawIcon(name: OurIconName, ratio: number): Raster {
  const painter = new Painter(ICON_BOX, ratio);
  OUR_ICONS[name](painter);
  return painter.finish();
}
