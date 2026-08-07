import { describe, it, expect } from 'vitest';
import { defaultExperiences } from '../db/seed';
import { type GeoMode } from '@sonora/shared';

/**
 * Seed data integrity (GEOF.5).
 *
 * The API test environment has no live DATABASE_URL, so these assertions run against the
 * deterministic seed data definition rather than a seeded DB.
 *
 * NOTE on coverage: every official seed experience uses the geofence of ITS TYPE: the default
 * listening mode for each format is 'type' (uses geofence[format].radiusMeters). Per-entity
 * overrides (geoMode='entity') remain POSSIBLE via the schema but are NOT used in the seed.
 * The full precedence matrix (bypass > entity > type > any, fail-closed, inclusive boundary,
 * defaultMode fallback, no-fix) is covered in the shared proximity unit tests with test-only
 * data. This suite only asserts integrity of the REAL seed rows.
 */
const walkable = defaultExperiences.filter((e) => e.format === 'trip' || e.format === 'track');

// Widen the const-literal seed rows to a comparable shape (avoids `as const` literal narrowing).
interface SeedExperience {
  slug: string;
  format: string;
  geoMode: GeoMode;
  radiusMeters: number | null;
}
const rows: SeedExperience[] = walkable.map((e) => ({
  slug: e.slug,
  format: e.format,
  geoMode: e.geoMode,
  radiusMeters: e.radiusMeters ?? null,
}));

describe('seed geo integrity (GEOF.5)', () => {
  it('every walkable (trip/track) experience uses the geofence of its own type (geoMode=type)', () => {
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.geoMode, `trip/track seed ${row.slug} should use its type geofence (type)`).toBe(
        'type',
      );
    }
  });

  it('every walkable experience carries a null radius_meters (no entity-specific radius in seed)', () => {
    for (const row of rows) {
      expect(row.radiusMeters, `entity radius on ${row.slug}`).toBeNull();
    }
  });
});
