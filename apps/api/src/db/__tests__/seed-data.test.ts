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

describe('stagingOnlyExperiences — staging data contract', () => {
  it('contains exactly 4 explicit experiences and 2 waypoints', () => {
    expect(stagingOnlyExperiences).toHaveLength(4);
    expect(stagingOnlyWaypoints).toHaveLength(2);
  });

  it('is an explicit set: two tracks, one trip, and one general-feedback', () => {
    const formats = stagingOnlyExperiences.map((e) => e.format).sort();
    expect(formats).toEqual(['general-feedback', 'track', 'track', 'trip']);
  });

  it('uses unique ids and unique slugs', () => {
    const ids = stagingOnlyExperiences.map((e) => e.id);
    const slugs = stagingOnlyExperiences.map((e) => e.slug);
    expect(new Set(ids).size).toBe(4);
    expect(new Set(slugs).size).toBe(4);
  });

  it('prefixes every title with [PRUEBA] and does not collide with base slugs', () => {
    const baseSlugs = new Set(baseExperiences.map((e) => e.slug));
    for (const e of stagingOnlyExperiences) {
      expect(e.title.startsWith('[PRUEBA]')).toBe(true);
      expect(baseSlugs.has(e.slug)).toBe(false);
    }
  });

  it('uses a valid TRACK_IMAGE_KEYS value for every row', () => {
    for (const e of stagingOnlyExperiences) {
      expect(TRACK_IMAGE_KEYS as readonly string[]).toContain(e.imageKey);
    }
  });

  it('uses integer minor-unit prices: paid trip 350000 ARS; free rows have no price', () => {
    for (const e of stagingOnlyExperiences) {
      if (e.free) {
        expect(e.price).toBeUndefined();
        continue;
      }
      expect(e.price).toBe(350000);
      expect(e.currency).toBe('ARS');
    }
  });

  it('uses the shared chiricotes R2 audio key for audio rows and null for no-audio rows', () => {
    for (const e of stagingOnlyExperiences) {
      if (e.audioUrl == null) {
        expect(e.free).toBe(true);
        continue;
      }
      expect(e.audioUrl).toBe(STAGING_AUDIO_KEY);
    }
  });

  it('provides exactly 2 waypoints for the single trip id', () => {
    const trips = stagingOnlyExperiences.filter((e) => e.format === 'trip');
    expect(trips).toHaveLength(1);
    const tripIds = trips.map((e) => e.id!);
    const wpByTrip = new Map<string, number>();
    for (const wp of stagingOnlyWaypoints) {
      wpByTrip.set(wp.experienceId, (wpByTrip.get(wp.experienceId) ?? 0) + 1);
    }
    for (const id of tripIds) {
      expect(wpByTrip.get(id)).toBe(2);
    }
    expect(wpByTrip.size).toBe(1);
  });
});

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
