import { TRACK_IMAGE_KEYS } from '@sonora/shared';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertSeedEnv,
  baseExperiences,
  baseWaypoints,
  collectExperienceIds,
  seedExperiences,
} from '../seed-data';
import {
  STAGING_AUDIO_KEY,
  stagingOnlyExperiences,
  stagingOnlyWaypoints,
  stagingShowcaseExperiences,
  stagingShowcaseTripId,
  stagingShowcaseWaypoints,
  stagingTestExperiences,
} from '../seed-staging-data';

/**
 * `assertSeedEnv` calls `process.exit`. It is mocked to throw so the exit code
 * is observable without terminating the test runner.
 */
function mockExit(): void {
  vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`process.exit(${code})`);
  }) as unknown as typeof process.exit);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('assertSeedEnv — environment guard', () => {
  it('staging entry refuses when SEED_ENV is unset', () => {
    mockExit();
    expect(() => assertSeedEnv('staging', undefined)).toThrow(/process\.exit\(1\)/);
  });

  it('staging entry refuses when SEED_ENV is not staging', () => {
    mockExit();
    expect(() => assertSeedEnv('staging', 'production')).toThrow(/process\.exit\(1\)/);
  });

  it('staging entry accepts SEED_ENV=staging', () => {
    mockExit();
    expect(() => assertSeedEnv('staging', 'staging')).not.toThrow();
  });

  it('base entry refuses when SEED_ENV is staging', () => {
    mockExit();
    expect(() => assertSeedEnv('base', 'staging')).toThrow(/process\.exit\(1\)/);
  });

  it('base entry accepts when SEED_ENV is unset (local dev)', () => {
    mockExit();
    expect(() => assertSeedEnv('base', undefined)).not.toThrow();
  });

  it('base entry accepts when SEED_ENV is production', () => {
    mockExit();
    expect(() => assertSeedEnv('base', 'production')).not.toThrow();
  });
});

describe('stagingTestExperiences — staging test-data contract', () => {
  it('contains exactly 6 explicit experiences and 7 waypoints', () => {
    expect(stagingTestExperiences).toHaveLength(6);
    // Four for the two test trips, three for the showcase trip.
    expect(stagingOnlyWaypoints).toHaveLength(7);
  });

  it('is an explicit set: four tracks and two trips', () => {
    const formats = stagingTestExperiences.map((e) => e.format).sort();
    expect(formats).toEqual(['track', 'track', 'track', 'track', 'trip', 'trip']);
  });

  it('uses unique ids and unique slugs', () => {
    const ids = stagingTestExperiences.map((e) => e.id);
    const slugs = stagingTestExperiences.map((e) => e.slug);
    expect(new Set(ids).size).toBe(6);
    expect(new Set(slugs).size).toBe(6);
  });

  it('prefixes every title with [PRUEBA] or [Test and does not collide with base slugs', () => {
    const baseSlugs = new Set(baseExperiences.map((e) => e.slug));
    for (const e of stagingTestExperiences) {
      expect(e.title.startsWith('[PRUEBA]') || e.title.startsWith('[Test')).toBe(true);
      expect(baseSlugs.has(e.slug)).toBe(false);
    }
  });

  it('uses a valid TRACK_IMAGE_KEYS value for every row', () => {
    for (const e of stagingTestExperiences) {
      expect(TRACK_IMAGE_KEYS as readonly string[]).toContain(e.imageKey);
    }
  });

  it('uses integer minor-unit prices: paid trip 350000 ARS; free rows have no price', () => {
    for (const e of stagingTestExperiences) {
      if (e.free) {
        expect(e.price).toBeUndefined();
        continue;
      }
      expect(e.price).toBe(350000);
      expect(e.currency).toBe('ARS');
    }
  });

  it('uses the shared chiricotes R2 audio key for audio rows and null for no-audio rows', () => {
    for (const e of stagingTestExperiences) {
      if (e.audioUrl == null) {
        expect(e.free).toBe(true);
        continue;
      }
      expect(e.audioUrl).toBe(STAGING_AUDIO_KEY);
    }
  });

  it('provides exactly 2 waypoints for each of the test trip ids', () => {
    const trips = stagingTestExperiences.filter((e) => e.format === 'trip');
    expect(trips).toHaveLength(2);
    const tripIds = trips.map((e) => e.id!);
    const wpByTrip = new Map<string, number>();
    for (const wp of stagingOnlyWaypoints) {
      wpByTrip.set(wp.experienceId, (wpByTrip.get(wp.experienceId) ?? 0) + 1);
    }
    for (const id of tripIds) {
      expect(wpByTrip.get(id)).toBe(2);
    }
    // The two test trips plus the showcase trip: nothing else in the seed carries stops.
    expect(wpByTrip.size).toBe(3);
  });
});

describe('stagingShowcaseExperiences — the two showcase pieces', () => {
  it('carries both titles verbatim', () => {
    expect(stagingShowcaseExperiences.map((e) => e.title)).toEqual(['DERIVA PÒLEN SOMOS', 'Fuego']);
  });

  it('is one trip and one free track staging shows, not test rows', () => {
    expect(stagingShowcaseExperiences.map((e) => e.format)).toEqual(['trip', 'track']);
    for (const e of stagingShowcaseExperiences) {
      expect(e.free).toBe(true);
      expect(e.price).toBeUndefined();
      expect(e.published).toBe(true);
      // These are real pieces, so the staging test-data prefix does not apply.
      expect(e.title.startsWith('[PRUEBA]') || e.title.startsWith('[Test')).toBe(false);
    }
  });

  it('places every piece inside the territory the artwork draws', () => {
    // Umepay, as the home map illustration draws it: the pieces must land inside that frame.
    for (const e of stagingShowcaseExperiences) {
      expect(e.latitude).toBeGreaterThan(-32.215);
      expect(e.latitude).toBeLessThan(-32.185);
      expect(e.longitude).toBeGreaterThan(-64.76);
      expect(e.longitude).toBeLessThan(-64.725);
    }
  });

  it('needs no new binary: R2 audio objects that must already exist, plus a cover per row', () => {
    const deriva = stagingShowcaseExperiences[0]!;
    const fuego = stagingShowcaseExperiences[1]!;
    expect(deriva.audioUrl).toBe(STAGING_AUDIO_KEY);
    expect(deriva.durationSeconds).toBe(180);
    expect(fuego.audioUrl).toBe('experiences/trips-deriva-fuego.mp3');
    expect(fuego.durationSeconds).toBe(303);
    for (const e of stagingShowcaseExperiences) {
      expect(TRACK_IMAGE_KEYS as readonly string[]).toContain(e.imageKey);
    }
  });

  it('keeps ids and slugs unique across base and every staging row', () => {
    const all = [...baseExperiences, ...stagingOnlyExperiences];
    expect(all).toHaveLength(
      baseExperiences.length + stagingTestExperiences.length + stagingShowcaseExperiences.length,
    );
    expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
    expect(new Set(all.map((e) => e.slug)).size).toBe(all.length);
  });
});

describe('waypoints — every seeded trip can be walked', () => {
  it('gives every trip in the seed at least one stop', () => {
    // The gap this closes: a trip was added with no stops and the older check only looked at the
    // test trips, so staging published a route nobody could walk.
    const trips = stagingOnlyExperiences.filter((e) => e.format === 'trip');
    const withStops = new Set(stagingOnlyWaypoints.map((w) => w.experienceId));
    for (const trip of trips) {
      expect(withStops.has(trip.id!)).toBe(true);
    }
    expect(trips.length).toBeGreaterThan(0);
  });

  it('walks about 800 m from the pin through its three stops', () => {
    const trip = stagingShowcaseExperiences.find((row) => row.id === stagingShowcaseTripId);
    expect(trip).toBeDefined();
    const stops = [...stagingShowcaseWaypoints].sort((a, b) => a.order - b.order);
    expect(stops.map((s) => s.order)).toEqual([1, 2, 3]);
    // The walk starts at the pin, so the pin is where the measurement starts.
    const meters = routeMeters([
      { latitude: trip!.latitude, longitude: trip!.longitude },
      ...stops,
    ]);
    expect(meters).toBeGreaterThan(780);
    expect(meters).toBeLessThan(820);
  });

  it('keeps every showcase stop inside the territory the map draws', () => {
    for (const stop of stagingShowcaseWaypoints) {
      expect(stop.latitude).toBeGreaterThan(-32.215);
      expect(stop.latitude).toBeLessThan(-32.185);
      expect(stop.longitude).toBeGreaterThan(-64.76);
      expect(stop.longitude).toBeLessThan(-64.725);
    }
  });
});

/** Great-circle length of the polyline through the stops, in metres. */
function routeMeters(points: readonly { latitude: number; longitude: number }[]): number {
  const earthRadius = 6_371_008.8;
  const radians = (value: number) => (value * Math.PI) / 180;
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!;
    const to = points[index]!;
    const deltaLat = radians(to.latitude - from.latitude);
    const deltaLon = radians(to.longitude - from.longitude);
    const haversine =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(radians(from.latitude)) *
        Math.cos(radians(to.latitude)) *
        Math.sin(deltaLon / 2) ** 2;
    total += 2 * earthRadius * Math.asin(Math.sqrt(haversine));
  }
  return total;
}

describe('collectExperienceIds — waypoint delete scope', () => {
  it('returns the union of base + staging ids when both are seeded', () => {
    const union = collectExperienceIds([...baseExperiences, ...stagingOnlyExperiences]);
    const baseIds = baseExperiences.map((e) => e.id!);
    const stagingIds = stagingOnlyExperiences.map((e) => e.id!);
    expect(new Set(union)).toEqual(new Set([...baseIds, ...stagingIds]));
    expect(union).toHaveLength(baseIds.length + stagingIds.length);
  });

  it('returns only base ids (no staging leak) when only base is seeded', () => {
    const baseIds = baseExperiences.map((e) => e.id!);
    const scope = collectExperienceIds([...baseExperiences]);
    expect(new Set(scope)).toEqual(new Set(baseIds));
    for (const staging of stagingOnlyExperiences) {
      expect(scope).not.toContain(staging.id);
    }
  });
});

describe('seedExperiences — upsert + union-scoped waypoint replacement', () => {
  interface MockDb {
    insert: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  }

  function createMockDb(): MockDb {
    const insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      }),
    });
    const del = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    return { insert, delete: del } as unknown as MockDb;
  }

  it('upserts every theme, experience, and waypoint exactly once (base + staging)', async () => {
    const db = createMockDb();
    const themes = [{ key: 'birds' }, { key: 'community' }] as never[];
    const experiences = [...baseExperiences, ...stagingOnlyExperiences] as never[];
    const waypoints = [...baseWaypoints, ...stagingOnlyWaypoints] as never[];

    await seedExperiences(db as never, { themes, experiences, waypoints });

    const expectedInserts = themes.length + experiences.length + waypoints.length;
    expect(db.insert).toHaveBeenCalledTimes(expectedInserts);
    // Waypoints are replaced in a single scoped delete.
    expect(db.delete).toHaveBeenCalledTimes(1);
    expect(db.delete.mock.results[0].value.where).toHaveBeenCalledTimes(1);
  });

  it('deletes waypoints exactly once even when no waypoints are provided', async () => {
    const db = createMockDb();
    await seedExperiences(db as never, {
      themes: [],
      experiences: [...baseExperiences] as never[],
      waypoints: [],
    });
    expect(db.delete).toHaveBeenCalledTimes(1);
    expect(db.insert).toHaveBeenCalledTimes(baseExperiences.length);
  });
});

describe('seed entry guards — subprocess fail-closed (E2E)', () => {
  function runSeed(script: 'seed.ts' | 'seed-staging.ts', seedEnv: string | undefined): number {
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      DATABASE_URL: 'postgres://user:pass@localhost:5432/none',
    };
    if (seedEnv === undefined) {
      delete env.SEED_ENV;
    } else {
      env.SEED_ENV = seedEnv;
    }
    const result = spawnSync(process.execPath, [path.join('src/db', script)], {
      cwd: process.cwd(),
      env,
      encoding: 'utf8',
    });
    return result.status ?? 1;
  }

  it('base entry exits non-zero when SEED_ENV is staging (must never seed prod path)', () => {
    expect(runSeed('seed.ts', 'staging')).not.toBe(0);
  });

  it('staging entry exits non-zero when SEED_ENV is production', () => {
    expect(runSeed('seed-staging.ts', 'production')).not.toBe(0);
  });

  it('staging entry exits non-zero when SEED_ENV is unset (missing var fails closed)', () => {
    expect(runSeed('seed-staging.ts', undefined)).not.toBe(0);
  });
});
