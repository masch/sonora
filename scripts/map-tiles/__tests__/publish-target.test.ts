/**
 * The one-command publish, pinned where it can fail silently.
 *
 * `map-tiles-publish-staging` computes the archive path it will render, upload and verify
 * from one shell variable at the top of the recipe. If the recursive `map-tiles-build`
 * call does not receive that same cache directory, the build writes to build.ts's own
 * default while every later step reads the path the recipe assumed — and the run either
 * fails on a missing file or, worse, uploads the archive a previous run left there. The
 * two derivations have to be the same variable, and this is the test that says so.
 */
import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../..', import.meta.url));
const MAKEFILE = readFileSync(join(REPO, 'Makefile'), 'utf8');

/** The recipe lines of one target, without the target line itself. */
function recipeOf(target: string): string {
  const lines = MAKEFILE.split('\n');
  const start = lines.findIndex((line) => line.startsWith(`${target}:`));
  if (start === -1) throw new Error(`the Makefile has no ${target} target`);

  const recipe: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith('\t')) break;
    recipe.push(line);
  }
  return recipe.join('\n');
}

describe('the publish target', () => {
  it('derives the archive path and the build cache from the same variable', () => {
    const recipe = recipeOf('map-tiles-publish-staging');

    // The path every later step reads: render-check, upload and verify.
    expect(recipe).toContain('archive="$$cache/out/$$region.pmtiles"');
    // The build has to write there, so it is given that cache and not its own default.
    expect(recipe).toContain('map-tiles-build REGION="$$region" CACHE="$$cache"');
  });

  it('builds the region it publishes, from a fresh extract unless FRESH=0', () => {
    const recipe = recipeOf('map-tiles-publish-staging');

    expect(recipe).toContain('REFRESH_EXTRACT=1');
    expect(recipe).toMatch(/\$\(if \$\(filter-out 0,\$\(FRESH\)\)/);
    expect(recipe).toContain('api-upload-map-tiles-staging REGION="$$region" VERSION="$$version"');
  });
});
