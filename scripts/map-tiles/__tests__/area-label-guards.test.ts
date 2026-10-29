/**
 * The two decisions the device settled, pinned where `bun test` can see them.
 *
 * The render check proves the outcome, but it needs a browser and an archive, so it cannot run
 * on every commit. These guards cover the regression class it found: someone edits the style or
 * the patch and quietly drops the fix, and the label disappears again — this time on a phone,
 * weeks later.
 */
import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { type RenderExpectations, expectedNames } from '../render-check';

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

describe('the render expectations', () => {
  const expectations = JSON.parse(
    readFileSync(join(REPO, 'scripts/map-tiles/render-expectations.json'), 'utf8'),
  ) as RenderExpectations;

  it('promise the area names at the zooms the device checked', () => {
    expect(expectedNames(expectations, 'calamuchita', '15/10491/19483')).toEqual([
      'Bosque Umepay',
      'Huerta Madre',
    ]);
    expect(expectedNames(expectations, 'calamuchita', '16/20982/38967')).toEqual([
      'Bosque Umepay',
      'Huerta Madre',
    ]);
  });

  it('say nothing for a tile nobody measured, instead of inventing a promise', () => {
    expect(expectedNames(expectations, 'calamuchita', '0/0/0')).toEqual([]);
    expect(expectedNames(expectations, 'patagonia', '15/10491/19483')).toEqual([]);
  });
});
