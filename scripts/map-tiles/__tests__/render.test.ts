/**
 * The render check as a test: the map must draw what the repository promises.
 *
 * `render-check.ts` proves it on demand; this makes it run with everything else, so an area
 * label or a fill that stops being drawn fails in `bun test` instead of on a phone. What the
 * tiles are expected to draw is stated here, in `TILES`, rather than in a data file: the test
 * owns the promise and the renderer that checks it sits beside it. Two things it needs and
 * cannot invent: a **built archive** (a build artefact, never committed) and a **Chromium**
 * (never downloaded by a test). Without either the tiles skip and the reason is printed — a
 * silent pass would be worse than no test. What `TILES` itself says is checked without either.
 *
 * Where `CI` says the render is required, neither is optional: a job that skips these tiles goes
 * green having drawn nothing, so the missing piece becomes a failure that names itself.
 *
 * `MAP_TILES_ARCHIVE` points at another archive; `PLAYWRIGHT_CHROMIUM` at another browser.
 */
import { describe, expect, it } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_CACHE_DIR } from '../build';
import { findChromium, renderCheck } from '../render-check';

const REPO = fileURLToPath(new URL('../../..', import.meta.url));
const REGION = 'calamuchita';
const ARCHIVE =
  process.env.MAP_TILES_ARCHIVE ?? join(DEFAULT_CACHE_DIR, 'out', `${REGION}.pmtiles`);
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? findChromium();
const STYLE = join(REPO, 'assets/map/styles/v1.json');

/** What one tile promises the style draws. */
interface TileExpectation {
  /** `z/x/y`, so a failure names the tile it rendered. */
  tile: string;
  /** Names the style must place on its label layer. */
  labels: string[];
  /** Style layers that must draw at least one feature at this tile. */
  fills: string[];
}

/**
 * The fills the walker compared against OSM: the park itself, and the two areas — `natural=heath`
 * (patch 0005) and `natural=bare_rock` — this map used to leave blank.
 */
const FILLS = ['landuse_park', 'landuse_heath', 'landuse_bare_rock'];

/**
 * What each tile is expected to draw, by zoom, deepest promise last.
 *
 * The expectations live here, next to the renderer that checks them, instead of in a data file:
 * a label that stops being placed — a zoom range, a collision, a filter — fails `bun test` naming
 * the tile that lost it, and a tile nobody measured cannot be added without saying so below.
 */
const TILES: TileExpectation[] = [
  { tile: '13/2622/4870', labels: ['Bosque Umepay'], fills: FILLS },
  { tile: '14/5245/9741', labels: ['Bosque Umepay', 'Huerta Madre'], fills: FILLS },
  { tile: '15/10491/19483', labels: ['Bosque Umepay', 'Huerta Madre'], fills: FILLS },
  { tile: '16/20982/38967', labels: ['Bosque Umepay', 'Huerta Madre'], fills: FILLS },
];

/** The expectation for one tile, so an assertion names the tile it read. */
function expectationFor(tile: string): TileExpectation {
  const found = TILES.find((candidate) => candidate.tile === tile);
  if (found === undefined) throw new Error(`no expectation for tile ${tile}`);
  return found;
}

/**
 * Why the render cannot run here, or `false` when it can.
 *
 * Both reasons are collected in order, and every tile test skips on this single answer: skipping
 * on one while running on the other is how a suite fails for the machine and not the change.
 */
const blocked: false | string = !existsSync(ARCHIVE)
  ? `no archive at ${ARCHIVE} — build one with \`make map-tiles-build\`, or set MAP_TILES_ARCHIVE`
  : CHROMIUM === null
    ? 'no Chromium installed — set PLAYWRIGHT_CHROMIUM or run `bunx playwright install chromium`'
    : false;

/**
 * Whether this run has to render rather than skip.
 *
 * `CI=true` is what a pipeline sets, and a pipeline that skips the four tiles proves nothing about
 * the map while still reporting success. A laptop keeps the skip: the archive needs JDK 21, Maven
 * and ~4 GB of sources, which is not something `bun test` may demand of every commit.
 */
const RENDER_REQUIRED = !['', '0', 'false'].includes((process.env.CI ?? '').toLowerCase());

describe('the published style draws what the archive carries', () => {
  it('says why it cannot render here, when it cannot', () => {
    // Always passes; the point is the line in the output, not an assertion.
    if (blocked !== false) console.log(`render check skipped: ${blocked}`);
    expect(blocked === false || blocked.length > 0).toBe(true);
  });

  it('has what it needs wherever the render is required', () => {
    // In CI the skip above is not allowed to stand in for a render: the job would report success
    // having drawn nothing, and this check is the only thing the map has to prove it still draws.
    if (RENDER_REQUIRED && blocked !== false) {
      throw new Error(`the render check cannot run: ${blocked}`);
    }
    expect(RENDER_REQUIRED === false || blocked === false).toBe(true);
  });

  for (const expectation of TILES) {
    const [z, x, y] = expectation.tile.split('/').map(Number) as [number, number, number];

    it.skipIf(blocked !== false)(
      `${expectation.tile} places ${expectation.labels.join(' and ')} and paints ${expectation.fills.join(', ')}`,
      async () => {
        const result = await renderCheck(
          {
            archive: ARCHIVE,
            style: STYLE,
            tile: { z, x, y },
            expect: expectation.labels,
            expectFills: expectation.fills,
            group: 'green',
          },
          REPO,
        );

        // The message names what is missing, so a failure reads as the gap, not as a boolean.
        // What proves the render is the features it drew: `sourceLoaded` is the renderer's own
        // bookkeeping and reports false for a tile whose labels and fills are already drawn.
        expect(result.message ?? 'ok').toBe('ok');
        expect(result.names).toEqual(expect.arrayContaining(expectation.labels));
        expect(result.fills).toEqual(expect.arrayContaining(expectation.fills));
      },
      60_000,
    );
  }
});

/**
 * The promises above, checked without a browser.
 *
 * Everything here reads the constant, so it runs on every machine: the render above is what says
 * the style still draws these, and this says the expectations themselves cannot drift back into
 * the bug they were measured against — silently, on the machines with no archive.
 */
describe('the tiles this repository promises', () => {
  it('owns only Bosque Umepay at z13, and adds Huerta Madre at z14', () => {
    // The zoom the device could not see: at z13 the style drew Bosque Umepay alone, and Huerta
    // Madre only appeared at z14. A patch that strips the names again loses the second one here,
    // before anybody opens a phone at that zoom.
    expect(expectationFor('13/2622/4870').labels).toEqual(['Bosque Umepay']);
    expect(expectationFor('14/5245/9741').labels).toEqual(['Bosque Umepay', 'Huerta Madre']);
  });

  it('promises the three fills the walker compared against OSM at z15 and z16', () => {
    // `natural=heath` was a profile gap and `natural=bare_rock` a missing fill layer: both are
    // areas OSM drew and this map did not, so the two deepest tiles must promise all three.
    for (const tile of ['15/10491/19483', '16/20982/38967']) {
      expect(expectationFor(tile).fills).toEqual([
        'landuse_park',
        'landuse_heath',
        'landuse_bare_rock',
      ]);
    }
  });

  it('holds exactly the four tiles somebody measured', () => {
    // The list is the promise. A tile added here without being measured would assert whatever
    // its author guessed, and the render would then be checking the guess, not the map.
    expect(TILES.map((each) => each.tile)).toEqual([
      '13/2622/4870',
      '14/5245/9741',
      '15/10491/19483',
      '16/20982/38967',
    ]);
  });
});
