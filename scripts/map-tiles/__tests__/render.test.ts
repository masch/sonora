/**
 * The render check as a test: the map must draw what the repository promises.
 *
 * `render-check.ts` proves it on demand; this makes it run with everything else, so an area
 * label or a fill that stops being drawn fails in `bun test` instead of on a phone. Two things
 * it needs and cannot invent: a **built archive** (a build artefact, never committed) and a
 * **Chromium** (never downloaded by a test). Without either the tiles skip and the reason is
 * printed — a silent pass would be worse than no test.
 *
 * `MAP_TILES_ARCHIVE` points at another archive; `PLAYWRIGHT_CHROMIUM` at another browser.
 */
import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_CACHE_DIR } from '../build';
import { type RenderExpectations, findChromium, renderCheck } from '../render-check';

const REPO = fileURLToPath(new URL('../../..', import.meta.url));
const REGION = 'calamuchita';
const ARCHIVE =
  process.env.MAP_TILES_ARCHIVE ?? join(DEFAULT_CACHE_DIR, 'out', `${REGION}.pmtiles`);
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? findChromium();
const STYLE = join(REPO, 'assets/map/styles/v1.json');

const EXPECTATIONS = JSON.parse(
  readFileSync(join(REPO, 'scripts/map-tiles/render-expectations.json'), 'utf8'),
) as RenderExpectations;

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

describe('the published style draws what the archive carries', () => {
  it('says why it cannot render here, when it cannot', () => {
    // Always passes; the point is the line in the output, not an assertion.
    if (blocked !== false) console.log(`render check skipped: ${blocked}`);
    expect(blocked === false || blocked.length > 0).toBe(true);
  });

  for (const [tile, expectation] of Object.entries(EXPECTATIONS[REGION] ?? {})) {
    const [z, x, y] = tile.split('/').map(Number) as [number, number, number];

    it.skipIf(blocked !== false)(
      `${tile} places ${(expectation.labels ?? []).join(' and ')} and paints ${(expectation.fills ?? []).join(', ')}`,
      async () => {
        const result = await renderCheck(
          {
            archive: ARCHIVE,
            style: STYLE,
            tile: { z, x, y },
            expect: expectation.labels ?? [],
            expectFills: expectation.fills ?? [],
            group: 'green',
          },
          REPO,
        );

        // The message names what is missing, so a failure reads as the gap, not as a boolean.
        expect(result.message ?? 'ok').toBe('ok');
        expect(result.sourceLoaded).toBe(true);
        expect(result.names).toEqual(expect.arrayContaining(expectation.labels ?? []));
        expect(result.fills).toEqual(expect.arrayContaining(expectation.fills ?? []));
      },
      60_000,
    );
  }
});
