/**
 * The style and patch guards the device settled, pinned where `bun test` can see them.
 *
 * The render check proves the outcome, but it needs a browser and an archive, so it cannot run
 * on every commit. These guards cover the regression class it found: someone edits the style or
 * the patch and quietly drops the fix, and the label disappears again — this time on a phone,
 * weeks later. What each tile is expected to draw is not here; it lives with the render, in
 * `render.test.ts`.
 */
import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../..', import.meta.url));
const STYLE = JSON.parse(readFileSync(join(REPO, 'assets/map/styles/v1.json'), 'utf8')) as {
  layers: Array<{
    id: string;
    type: string;
    minzoom?: number;
    layout?: Record<string, unknown>;
    paint?: Record<string, unknown>;
  }>;
};
const PATCH = readFileSync(
  join(REPO, 'scripts/map-tiles/patches/0004-landuse-reaches-z16.patch'),
  'utf8',
);

function layer(id: string) {
  const found = STYLE.layers.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`the style has no layer ${id}`);
  return found;
}

describe('the area label keeps its collision fix', () => {
  it('lets MapLibre try another anchor instead of dropping the second name', () => {
    // Without these two, "Huerta Madre" and "Bosque Umepay" collide and one of them vanishes —
    // measured: the layer as first written placed only the first name.
    const layout = layer('landuse_label').layout ?? {};
    expect(layout['text-variable-anchor']).toEqual(['center', 'top', 'bottom', 'left', 'right']);
    expect(layout['text-radial-offset']).toBeGreaterThan(0);
  });

  it('draws only polygons that have a name', () => {
    const label = layer('landuse_label') as unknown as { filter?: unknown[] };
    expect(JSON.stringify(label.filter)).toContain('"has","name"');
  });
});

describe('the area label reaches the zooms the map opens at', () => {
  it('offers a name from z11, the zoom the subplace labels already draw at', () => {
    // The opening frame fits a box whose span floor is `WORLD_MIN_SPAN_DEGREES` (0.015°),
    // which lands a 400 px card between z11 and z14 depending on how far apart the
    // published experiences are. At z13 that frame sat exactly on the threshold: a payload
    // any wider and the names were gone until the walker zoomed by hand. The data carries
    // them at every zoom (patch 0006), so this number is the whole decision.
    expect(layer('landuse_label').minzoom).toBe(11);
  });

  it('grows to 10 px by z14 and stops there, because 11 px loses a name', () => {
    // Measured on the z14 tile against the published archive: at 10 px "Huerta Madre" and
    // "Bosque Umepay" both place; at 11 px, literal or interpolated, the second is culled —
    // 3 runs of each, the same answer every time. So the curve buys quiet at z11 with 9 px and
    // never crosses the size that tile can hold. A constant 10 px was deaf to the zoom: the
    // size a name was drawn at never answered how far the walker was from it.
    expect(layer('landuse_label').layout?.['text-size']).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      11,
      9,
      14,
      10,
    ]);
  });

  it('draws the name dark enough to read on the green it sits on', () => {
    // #8f8f8f over the park's #a0d9a0 is a 1.99:1 contrast, which is why the names read as
    // texture instead of words; the places labels already use #5c5c5c, 4.12:1 on the same fill.
    // Paint never widens the collision box, so this legibility is free of the size ceiling above.
    expect(layer('landuse_label').paint?.['text-color']).toBe('#5c5c5c');
  });
});

describe('the fills OSM shows are in the style', () => {
  it('draws heath and bare rock, the two areas this map used to leave blank', () => {
    // `natural=heath` is the big yellow area next to Bosque Umepay; `natural=bare_rock` the grey
    // one. Both are in the tiles now; without these layers nothing paints them.
    expect(layer('landuse_heath').type).toBe('fill');
    expect(layer('landuse_bare_rock').type).toBe('fill');
  });

  it('keeps the heath patch in the profile, because the tag is otherwise dropped', () => {
    const patch = readFileSync(
      join(REPO, 'scripts/map-tiles/patches/0005-natural-heath.patch'),
      'utf8',
    );
    expect(patch).toContain('+          heath');
  });
});

describe('the names travel at every zoom', () => {
  it('keeps the patch that stops Area from stripping them', () => {
    // `Area.filterArea` removed name/name:* whenever minArea < 117.19, which is always. With
    // patch 0006 the data carries the names at every zoom and only the style decides when to
    // draw them, so lowering `landuse_label`'s minzoom never needs a rebuild.
    const patch = readFileSync(
      join(REPO, 'scripts/map-tiles/patches/0006-area-keeps-names.patch'),
      'utf8',
    );
    expect(patch).toContain('-        if (minArea < 30000d');
    expect(patch).toContain('item.tags().remove(key)');
  });
});

describe('the landuse patch keeps both halves of the fix', () => {
  it('extends the polygons to z16', () => {
    // One half alone produces polygons at z16 with no name on them: the render check caught it.
    expect(PATCH).toContain('.setZoomRange(2, 16)');
  });

  it('stops the post-process from stripping names above z15', () => {
    // `Area.filterArea` removes name/name:* whenever minArea < 117.19, which it always is. A
    // patch carries both sides of the change, so the assertion is on the pair: `==` goes, `>=`
    // arrives.
    expect(PATCH).toContain('+    if (zoom >= 15)');
    expect(PATCH).toContain('-    if (zoom == 15)');
  });
});
