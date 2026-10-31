/**
 * The two icons this repository adds, asserted as images.
 *
 * An icon that touches its box edge bleeds into whatever is pasted next to it in the
 * atlas, so the margin is the assertion that matters most here — it is invisible on the
 * machine that generated it and visible on every phone that draws two POIs side by side.
 */
import { describe, expect, it } from 'bun:test';

import { drawIcon, ICON_BOX, OUR_ICON_NAMES } from '../icons';

/** The opaque bounding box of a drawn icon, in pixels. */
function inkBox(
  data: Uint8Array,
  size: number,
): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = size;
  let y0 = size;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (data[(y * size + x) * 4 + 3] === 0) continue;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  return { x0, y0, x1, y1 };
}

describe('every icon we own', () => {
  it('is 19×19 at pixel ratio 1 and 38×38 at ratio 2', () => {
    for (const name of OUR_ICON_NAMES) {
      expect(drawIcon(name, 1).width).toBe(ICON_BOX);
      expect(drawIcon(name, 2).width).toBe(ICON_BOX * 2);
    }
  });

  it('draws ink, and keeps it inside the box with a margin on all four sides', () => {
    for (const name of OUR_ICON_NAMES) {
      for (const ratio of [1, 2]) {
        const raster = drawIcon(name, ratio);
        const box = inkBox(raster.data, raster.width);

        // One pixel of clear space per ratio unit: at @2x that is two sheet pixels,
        // which is what separates two icons pasted next to each other in the atlas.
        expect(box.x1).toBeGreaterThan(box.x0);
        expect(box.x0).toBeGreaterThanOrEqual(ratio);
        expect(box.y0).toBeGreaterThanOrEqual(ratio);
        expect(box.x1).toBeLessThanOrEqual(raster.width - ratio - 1);
        expect(box.y1).toBeLessThanOrEqual(raster.width - ratio - 1);
      }
    }
  });

  it('is a different drawing from every other one', () => {
    const seen = new Set<string>();
    for (const name of OUR_ICON_NAMES) seen.add([...drawIcon(name, 1).data].join(','));

    expect(seen.size).toBe(OUR_ICON_NAMES.length);
  });
});

describe('the icon set', () => {
  it('is the two glyphs the style maps eleven kinds onto', () => {
    expect(OUR_ICON_NAMES).toEqual(['lodging', 'camping']);
  });
});
