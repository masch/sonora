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
  layers: Array<{ id: string; type: string; layout?: Record<string, unknown> }>;
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
