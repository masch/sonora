/**
 * The objects the tiles must carry, asserted on the archive itself.
 *
 * The render check proves what the **style draws**, and it can only do that for text: it runs
 * offline, so a symbol that asks for a sprite icon never places. The tiler's own promises are
 * data — a building's `name`, an unnamed `amenity=toilets` kept as a POI because a walker looks
 * for it — and they are checked here, on the tile that holds them.
 *
 * It needs an archive, which is a build artefact and never committed, so it follows the render
 * check's rule: skip on a laptop with the reason printed, fail in CI where `MAP_TILES_ARCHIVE` is
 * expected. A missing archive in CI must not read as a pass.
 */
import { describe, expect, it } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { DEFAULT_CACHE_DIR } from '../build';
import { type ArchiveFeature, readTile } from '../archive-reader';

const REGION = 'calamuchita';
const ARCHIVE =
  process.env.MAP_TILES_ARCHIVE ?? join(DEFAULT_CACHE_DIR, 'out', `${REGION}.pmtiles`);

/**
 * The tiles the walker compared against OSM. They are neighbours on purpose: the building sits in
 * one and the two `amenity=toilets` mapped as small unnamed buildings fall in the one to its west,
 * because the pair straddles a tile boundary at z16.
 */
const SALON_TILE = { z: 16, x: 20983, y: 38967 };
const TOILETS_TILE = { z: 16, x: 20982, y: 38967 };

const RENDER_REQUIRED = !['', '0', 'false'].includes((process.env.CI ?? '').toLowerCase());
const missing = existsSync(ARCHIVE)
  ? false
  : `no archive at ${ARCHIVE} — build one with \`make map-tiles-build\`, or set MAP_TILES_ARCHIVE`;

describe('the archive carries the objects the walker found in OSM', () => {
  it('has what it needs wherever the archive is required', () => {
    if (RENDER_REQUIRED && missing !== false) {
      throw new Error(`the archive feature check cannot run: ${missing}`);
    }
    expect(RENDER_REQUIRED === false || missing === false).toBe(true);
  });

  it.skipIf(missing !== false)(
    `names the building OSM labels "Salón" (${SALON_TILE.z}/${SALON_TILE.x}/${SALON_TILE.y})`,
    async () => {
      // Patch 0002 put `name` on `buildings`: without it the style has nothing to draw, which is
      // why the label was missing until it was fixed.
      const features = await readTile(ARCHIVE, SALON_TILE);
      const named = features.filter(
        (feature) => feature.layer === 'buildings' && feature.properties.name === 'Salón',
      );

      expect(named.length).toBeGreaterThan(0);
    },
    60_000,
  );

  it.skipIf(missing !== false)(
    `keeps the unnamed toilets as a POI (${TOILETS_TILE.z}/${TOILETS_TILE.x}/${TOILETS_TILE.y})`,
    async () => {
      // Patch 0007. Upstream drops every POI that is neither a point nor a named polygon, and
      // these two are `amenity=toilets` drawn as small buildings with no name: they were in OSM
      // and nowhere in our tiles. Asserting the kind is what says the profile kept them.
      const features = await readTile(ARCHIVE, TOILETS_TILE);
      const toilets = features.filter(
        (feature) => feature.layer === 'pois' && feature.properties.kind === 'toilets',
      );

      expect(toilets.length).toBeGreaterThan(0);
    },
    60_000,
  );
});
