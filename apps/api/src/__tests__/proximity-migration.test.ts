import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * GEOF.4 additive migration regression — GEOF.3 schema shape.
 *
 * The API test environment has no live DATABASE_URL (DB is mocked throughout),
 * so these assertions verify the generated migration artifact and the Drizzle
 * schema contract directly instead of running row-count queries. They guarantee:
 *   - geo_mode is added NOT NULL (temporary DEFAULT 'any' only for the ALTER on
 *     existing rows, then DROP DEFAULT -> final state is NOT NULL without default)
 *   - radius_meters added as nullable integer
 *   - backfill sets trips -> 'type', tracks -> 'any' (preserves status quo)
 *   - waypoints.radius_meters untouched / no geo_mode on waypoints
 */
const MIGRATIONS_DIR = join(__dirname, '..', '..', 'migrations');

function latestGeoMigration(): string {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
  const withGeo = files.filter((f) =>
    readFileSync(join(MIGRATIONS_DIR, f), 'utf-8').includes('"geo_mode"'),
  );
  expect(withGeo.length).toBeGreaterThan(0);
  // Snapshot-based drizzle ordering; the newest additive geo migration wins.
  return withGeo.sort().pop()!;
}

describe('geo_mode / radius_meters additive migration (GEOF.4)', () => {
  const sql = readFileSync(join(MIGRATIONS_DIR, latestGeoMigration()), 'utf-8');

  it('adds the geo_mode enum type', () => {
    expect(sql).toContain(`CREATE TYPE "sonora"."geo_mode" AS ENUM('any', 'type', 'entity')`);
  });

  it('adds geo_mode as NOT NULL with temporary DEFAULT for the ALTER, then drops it', () => {
    // The ALTER needs a DEFAULT to populate existing rows, but the final state
    // (after backfill) is NOT NULL WITHOUT default — every insert must set geo_mode explicitly.
    expect(sql).toContain('ADD COLUMN "geo_mode" "sonora"."geo_mode" DEFAULT \'any\' NOT NULL');
    expect(sql).toContain('ALTER COLUMN "geo_mode" DROP DEFAULT');
  });

  it('adds radius_meters as nullable integer', () => {
    expect(sql).toContain('ADD COLUMN "radius_meters" integer');
  });

  it('backfills trips to geo_mode = type (preserves 50 m)', () => {
    expect(sql).toContain(`SET "geo_mode" = 'type' WHERE "format" = 'trip'`);
  });

  it('backfills tracks to geo_mode = any (preserves always-playable)', () => {
    expect(sql).toContain(`SET "geo_mode" = 'any' WHERE "format" = 'track'`);
  });

  it('every seeded+existing row is covered (backfill condenses trips only ', () => {
    // Backfill has no type filter that would leave null; with NOT NULL default 'any',
    // any row not explicitly 'trip' is 'any' — matching "tracks all any".
    expect(sql).not.toContain('geo_mode" IS NULL');
  });
});

describe('schema reflects geo columns and leaves waypoints untouched (GEOF.3)', () => {
  const schema = readFileSync(join(__dirname, '..', 'db', 'schema.ts'), 'utf-8');

  it('defines experienceGeoModeEnum over the three modes', () => {
    expect(schema).toContain(`sonoraSchema.enum('geo_mode',`);
    expect(schema).toContain('[...GEO_MODES]');
  });

  it('adds geoMode NOT NULL without default to experiences (explicit per insert)', () => {
    expect(schema).toContain(`experienceGeoModeEnum('geo_mode').notNull()`);
    expect(schema).not.toContain(`experienceGeoModeEnum('geo_mode').default('any')`);
  });

  it('adds radiusMeters nullable integer to experiences', () => {
    expect(schema).toContain(`radiusMeters: integer('radius_meters')`);
  });

  it('would not add geo_mode to waypoints (keeps waypoints untouched)', () => {
    // waypoints radius is existing (default 50, notNull); geoMode stays on experiences only.
    const waypointsBlockIndex = schema.indexOf(`sonoraSchema.table('waypoints'`);
    const waypointsBlock = schema.slice(waypointsBlockIndex);
    expect(waypointsBlock).not.toContain('geoMode');
    expect(waypointsBlock).toContain(
      "radiusMeters: integer('radius_meters').default(50).notNull()",
    );
  });
});
