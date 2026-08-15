# Design: Staging-Only Seed Experiences

## Technical Approach

Composition: `seed-data.ts` holds base data + shared upsert/guard helpers; `seed.ts` (prod entry) imports base only; `seed-staging.ts` (staging entry) imports base + `stagingOnly*` arrays from new `seed-staging-data.ts`. Both entries run the same `seedExperiences()` helper (single-sourced upsert). Fail-closed `SEED_ENV` guards make test data unreachable from the prod path (specs: db-seeding, deployment, ci).

## Architecture Decisions

| Decision              | Options                                       | Tradeoff                                                                                                                   | Choice                                            |
| --------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Module split          | env-gated array in seed.ts vs composition     | composition keeps staging symbols absent from prod entry                                                                   | 4 modules (below)                                 |
| Staging data location | inside entry vs separate module               | separate mirrors `seed-data.ts`, keeps entry thin                                                                          | `seed-staging-data.ts`                            |
| Upsert logic          | duplicated vs shared helper                   | duplication drifts; helper keeps behavior identical                                                                        | `seedExperiences()` in `seed-data.ts`             |
| Guard shape           | inline vs pure function                       | pure fn is unit-testable without subprocesses                                                                              | `assertSeedEnv(entry, seedEnv)` in `seed-data.ts` |
| CI staging seed       | env trick vs new target                       | explicit target is verifiable, spec-compliant                                                                              | new `api-db-seed-ci-staging`                      |
| Audio upload          | new script vs `make api-upload-audio-staging` | staging audio rows reuse the shared chiricotes key already in `sonora-staging-private-audio`; zero uploads, zero new infra | no upload — shared R2 key                         |
| Price values          | uniform vs varied                             | minimal set: one paid row (trip 350000); track/feedback free                                                               | trip 350000 (ARS minor)                           |

## Guard Implementation

```ts
// seed-data.ts — pure, unit-testable
export function assertSeedEnv(entry: 'base' | 'staging', seedEnv: string | undefined): void {
  if (entry === 'staging' && seedEnv !== 'staging') {
    console.error(
      `seed-staging.ts requires SEED_ENV=staging (got ${seedEnv ?? 'unset'}). Refusing to seed.`,
    );
    process.exit(1);
  }
  if (entry === 'base' && seedEnv !== undefined && seedEnv !== 'production') {
    console.error(`seed.ts refuses SEED_ENV=${seedEnv} (expected 'production' or unset).`);
    process.exit(1);
  }
}
```

Both entries call `assertSeedEnv(...)` before creating the pool — zero writes on failure. Local `make api-db-seed` (no `SEED_ENV`) still runs base. Staging data is never imported by `seed.ts` (static guarantee).

## Data Flow

```
seed.ts ──(imports base only)──► seed-data.ts ──► createDbClient(pg) ──► DATABASE_URL
seed-staging.ts ──► seed-data.ts (helper+base) + seed-staging-data.ts ──► SEED_ENV=staging guard ──► write
CI staging ──► make api-db-seed-ci-staging ──► bun src/db/seed-staging.ts (SEED_ENV=staging)
CI prod    ──► make api-db-seed-ci ──► bun src/db/seed.ts (SEED_ENV=production)
```

## Staging Data Contract (3 explicit experiences)

Three explicit experiences written by hand in the same literal style as the prod base data — no combinatorial generation, no builders, no loops. All rows: lat `-32.211913`, lng `-64.73809012343702`, `geofenceBypassable: false`, `published: true`. Audio rows reuse the shared staging R2 key `experiences/tracks-pajaros-chiricotes.mp3` (already in `sonora-staging-private-audio`). `imageKey` values are members of `TRACK_IMAGE_KEYS`.

### Track — `[PRUEBA] Track de prueba` (free, audio)

| Field           | Value                                  |
| --------------- | -------------------------------------- |
| Slug            | `prueba-track-audio`                   |
| UUID            | `d4a1e6b2-8c3f-5a7e-9b0c-1d2e3f4a5b6c` |
| format          | `track`                                |
| themeKey        | `community`                            |
| audioUrl        | shared R2 key                          |
| durationSeconds | 180                                    |
| price           | none (free)                            |
| imageKey        | `TRACK_IMAGE_KEYS[1]`                  |

### Trip — `[PRUEBA] Recorrido de prueba` (paid, audio, 2 waypoints)

| Field           | Value                                                 |
| --------------- | ----------------------------------------------------- |
| Slug            | `prueba-trip-audio`                                   |
| UUID            | `e5b2f7c3-9d40-5b8f-ac1d-2e3f4a5b6c7d`                |
| format          | `trip`                                                |
| themeKey        | `landscapes`                                          |
| audioUrl        | shared R2 key                                         |
| durationSeconds | 1800                                                  |
| price           | `350000` ARS (minor units)                            |
| imageKey        | `TRACK_IMAGE_KEYS[0]`                                 |
| waypoints       | standard 2-waypoint set (base trip coords, radius 50) |

### General feedback — `[PRUEBA] Feedback de prueba` (free, no audio)

| Field           | Value                                  |
| --------------- | -------------------------------------- |
| Slug            | `prueba-feedback`                      |
| UUID            | `f6c308d4-ae51-5c90-bd2e-3f4a5b6c7d8e` |
| format          | `general-feedback`                     |
| themeKey        | `community`                            |
| audioUrl        | `null`                                 |
| durationSeconds | 0                                      |
| price           | none (free)                            |
| imageKey        | `TRACK_IMAGE_KEYS[2]`                  |

## Audio

No upload step. Staging audio rows store the shared R2 object key `experiences/tracks-pajaros-chiricotes.mp3` — the same object the base `pajaros-chiricotes` experience already uses, present in `sonora-staging-private-audio`. Seeding stores keys only; binaries are never touched by this change.

## File Changes

| File                                          | Action | Description                                                                                        |
| --------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| `apps/api/src/db/seed-data.ts`                | Create | Base themes/experiences/waypoints (moved verbatim) + `assertSeedEnv` + `seedExperiences`           |
| `apps/api/src/db/seed.ts`                     | Modify | Strip data; import base; add base guard                                                            |
| `apps/api/src/db/seed-staging.ts`             | Create | Staging entry: guard + base ∪ staging arrays                                                       |
| `apps/api/src/db/seed-staging-data.ts`        | Create | 3 explicit experiences + 2 waypoints (tables above)                                                |
| `apps/api/package.json`                       | Modify | Add `db:seed:staging` script                                                                       |
| `Makefile`                                    | Modify | `api-db-seed-ci`/`-staging`/`-staging`/`-production` pass `SEED_ENV`; add `api-db-seed-ci-staging` |
| `.github/workflows/deploy-api-staging.yml`    | Modify | Seed step → `make api-db-seed-ci-staging` with `SEED_ENV: staging`                                 |
| `.github/workflows/deploy-api-production.yml` | Modify | Seed step → `SEED_ENV: production` (base entry)                                                    |
| `apps/api/eslint.config.js`                   | Modify | Add `seed-data.ts`, `seed-staging.ts`, `seed-staging-data.ts` to no-console override               |

## Interfaces / Contracts

```ts
// seed-data.ts
export function assertSeedEnv(entry: 'base' | 'staging', seedEnv: string | undefined): void;
export async function seedExperiences(
  db: DbClient,
  data: { themes: NewTheme[]; experiences: NewExperience[]; waypoints: NewWaypoint[] },
): Promise<void>; // upsert themes→experiences; delete waypoints inArray(experienceId, data.experiences ids); reinsert
export const defaultThemes: Theme[];
export const baseExperiences: NewExperience[];
export const baseWaypoints: NewWaypoint[];
// seed-staging-data.ts
export const stagingOnlyExperiences: NewExperience[]; // 3 explicit rows
export const stagingOnlyWaypoints: NewWaypoint[]; // 2 rows (trip only)
```

## Testing Strategy

| Layer        | What to Test                                                                                                  | Approach                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Unit         | `assertSeedEnv` all 4 branches (staging/base × env present/absent)                                            | Vitest on pure function, expect exit via mocked `process.exit` |
| Unit         | Explicit set: 3 rows (track + trip + feedback), unique ids/slugs, `[PRUEBA]` prefix, 2 waypoints for the trip | Vitest on `stagingOnlyExperiences`                             |
| Integration  | Waypoint scope = union of base+staging IDs only                                                               | Vitest on `seedExperiences` with mock db                       |
| Script/E2E   | Wrong-env run exits non-zero; correct-env run idempotent                                                      | Subprocess `bun` runs with env matrix                          |
| Verification | Staging DB has 3 `[PRUEBA]` rows; prod has 0                                                                  | SQL count query + CI assertion                                 |

## Threat Matrix

N/A — no routing, VCS/PR automation, executable-file classification, or git-state boundary. Closest is the seed subprocess env-forwarding (Makefile → bun); covered by the guard tests above, not by git-matrix rows.

| Boundary                 | Applicability                                   |
| ------------------------ | ----------------------------------------------- |
| Documentation-like paths | N/A — no executable markdown/scripts introduced |
| Git repository selection | N/A — no `git -C`/path selectors added          |
| Commit state             | N/A — no commit/index manipulation              |
| Push state               | N/A — no push logic added                       |
| PR commands              | N/A — no PR command composition                 |

## Migration / Rollout

No schema migration. Seed upserts are idempotent (re-run = no duplicates). Rollback: revert PR; delete staging rows by the stable UUIDs above (FK cascade removes waypoints). Guard makes accidental prod seeding fail loudly.

## Open Questions

- None blocking. No audio binaries required — audio rows reuse the shared chiricotes R2 key already in the staging bucket.
