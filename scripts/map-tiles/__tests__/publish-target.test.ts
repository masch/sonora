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

  it('refuses a version that is already in the bucket, before it builds anything', () => {
    const recipe = recipeOf('map-tiles-publish-staging');
    const guard = recipe.indexOf('--assert-free');
    const build = recipe.indexOf('map-tiles-build');

    expect(guard).toBeGreaterThan(-1);
    expect(build).toBeGreaterThan(-1);
    // The guard is what makes a version immutable, so it runs before the five-minute build
    // and not after it: a re-used version must cost nothing.
    expect(guard).toBeLessThan(build);
    expect(recipe).toContain('--version="$$version"');
  });

  it('keeps both low-level upload targets create-only as well', () => {
    // The one command is not the only way to reach the bucket, so the rule lives in the
    // targets that write, not in the wrapper that calls them.
    for (const target of ['api-upload-map-tiles-staging', 'api-upload-map-tiles-production']) {
      const recipe = recipeOf(target);
      const guard = recipe.indexOf('--assert-free');
      const put = recipe.indexOf('wrangler r2 object put');

      expect(guard).toBeGreaterThan(-1);
      expect(guard).toBeLessThan(put);
    }
  });

  it('opens the config PR that makes the version live, after the upload is proven', () => {
    const recipe = recipeOf('map-tiles-publish-staging');
    const verify = recipe.indexOf('verify-published.ts --region=');
    const bump = recipe.indexOf('bump-version.ts');

    // Publishing first and moving the config second is what keeps `/config` from naming an
    // object that does not exist yet.
    expect(bump).toBeGreaterThan(-1);
    expect(bump).toBeGreaterThan(verify);
    // And it is skippable, because a publish that is only meant to land the bytes has no reason
    // to open a pull request.
    expect(recipe).toContain('if [ "$(BUMP)" != "0" ]');
  });

  it('keeps the config PR available as its own target, for both environments', () => {
    const recipe = recipeOf('map-tiles-bump-pr');

    expect(recipe).toContain('bump-version.ts --version="$(VERSION)"');
    expect(recipe).toContain('--environment="$(if $(ENVIRONMENT),$(ENVIRONMENT),staging)"');
    expect(recipe).toContain('--dry-run');
  });

  it('builds the region it publishes, from a fresh extract unless FRESH=0', () => {
    const recipe = recipeOf('map-tiles-publish-staging');

    expect(recipe).toContain('REFRESH_EXTRACT=1');
    expect(recipe).toMatch(/\$\(if \$\(filter-out 0,\$\(FRESH\)\)/);
    expect(recipe).toContain('api-upload-map-tiles-staging REGION="$$region" VERSION="$$version"');
  });
});
