# Design: Staging-Only Seed Experiences

## Technical Approach

Composition: `seed-data.ts` holds base data + shared upsert/guard helpers; `seed.ts` (prod entry) imports base only; `seed-staging.ts` (staging entry) imports base + `stagingOnly*` arrays from new `seed-staging-data.ts`. Both entries run the same `seedExperiences()` helper (single-sourced upsert). Fail-closed `SEED_ENV` guards make test data unreachable from the prod path (specs: db-seeding, deployment, ci).

## Architecture Decisions

| Decision              | Options                                       | Tradeoff                                                                                          | Choice                                            |
| --------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Module split          | env-gated array in seed.ts vs composition     | composition keeps staging symbols absent from prod entry                                          | 4 modules (below)                                 |
| Staging data location | inside entry vs separate module               | separate mirrors `seed-data.ts`, keeps entry thin                                                 | `seed-staging-data.ts`                            |
| Upsert logic          | duplicated vs shared helper                   | duplication drifts; helper keeps behavior identical                                               | `seedExperiences()` in `seed-data.ts`             |
| Guard shape           | inline vs pure function                       | pure fn is unit-testable without subprocesses                                                     | `assertSeedEnv(entry, seedEnv)` in `seed-data.ts` |
| CI staging seed       | env trick vs new target                       | explicit target is verifiable, spec-compliant                                                     | new `api-db-seed-ci-staging`                      |
| Audio upload          | new script vs `make api-upload-audio-staging` | existing target POSTs to staging `/audio/upload` → `sonora-staging-private-audio`; zero new infra | reuse existing target, per-key                    |
| Price values          | uniform vs varied                             | minimal set: one price per format                                                                 | track 150000, trip 350000 (ARS minor)             |

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

## Staging Data Contract (28 rows)

Paid price: track `150000`, trip `350000`. All rows: `themeKey` community (track/feedback) or landscapes (trip), `durationSeconds` 180 (track) / 1800 (trip) / 0 (feedback), lat `-32.211913`, lng `-64.73809012343702`, `currency` ARS, `imageKey` cycles `TRACK_IMAGE_KEYS[0..3]`. Audio keys = R2 object keys in `sonora-staging-private-audio`. Waypoints: each trip gets the standard 2-waypoint set (base trip coords, radius 50) — 24 rows from the 12 trip IDs.

### Tracks — `[PRUEBA] Track …` (12)

| Slug                           | UUID                                 | Audio key / price                                  | geo   | pub   |
| ------------------------------ | ------------------------------------ | -------------------------------------------------- | ----- | ----- |
| prueba-track-libre-audio-1     | 91aec4ed-1728-556b-a7c5-a6d1ec16d8fa | experiences/staging/prueba-track-libre-audio-1.mp3 | false | true  |
| prueba-track-libre-audio-2     | 85332989-b435-5ae5-ab19-fa4992dc1e83 | …-libre-audio-2.mp3                                | false | false |
| prueba-track-libre-audio-3     | e235a48f-0ed4-563d-9d31-84c02f9a8690 | …-libre-audio-3.mp3                                | true  | true  |
| prueba-track-libre-audio-4     | cd9688ff-797a-50e6-87b9-a18d85543483 | …-libre-audio-4.mp3                                | true  | false |
| prueba-track-libre-sin-audio-1 | 5ddfd7c4-2166-5f6a-a600-2da284d26e0b | free, audio null                                   | false | true  |
| prueba-track-libre-sin-audio-2 | f2901e1d-1612-5c69-bdc9-20d3c0a028b0 | free, audio null                                   | false | false |
| prueba-track-libre-sin-audio-3 | 70f33e7c-de86-53d3-aa7f-6fd0935bdd83 | free, audio null                                   | true  | true  |
| prueba-track-libre-sin-audio-4 | 274a41ef-ca88-52fd-95ca-ca263d7409f2 | free, audio null                                   | true  | false |
| prueba-track-pago-1            | 90c6ba34-efa7-5e24-8366-6d4d2a4ab01d | experiences/staging/prueba-track-pago-1.mp3        | false | true  |
| prueba-track-pago-2            | 3e151bd3-6b7c-5ae9-a3d6-1c1446f8cea9 | …-pago-2.mp3                                       | false | false |
| prueba-track-pago-3            | 171c05f8-de2d-548b-9165-4df82e6fb74d | …-pago-3.mp3                                       | true  | true  |
| prueba-track-pago-4            | c8837737-b768-5ba9-a7c1-1dd505ad2de7 | …-pago-4.mp3                                       | true  | false |

### Trips — `[PRUEBA] Recorrido …` (12) — identical geo/pub pattern, all with 2 waypoints

| Slug                          | UUID                                 | Audio key / price                                 |
| ----------------------------- | ------------------------------------ | ------------------------------------------------- |
| prueba-trip-libre-audio-1     | 936fa355-6f1e-536a-8225-d046d6e02564 | experiences/staging/prueba-trip-libre-audio-1.mp3 |
| prueba-trip-libre-audio-2     | b51cfa97-fc6c-5d13-81f5-d3cae539cbb2 | …-libre-audio-2.mp3                               |
| prueba-trip-libre-audio-3     | 8303ea64-cc76-5f3f-8054-993ede57dfef | …-libre-audio-3.mp3                               |
| prueba-trip-libre-audio-4     | d968e51a-cce3-52b0-9409-1626418676af | …-libre-audio-4.mp3                               |
| prueba-trip-libre-sin-audio-1 | bc62c51e-6e08-518d-87f3-1c24d5df6223 | free, audio null                                  |
| prueba-trip-libre-sin-audio-2 | a90a813e-8962-5a21-afe3-1cc7b54589f8 | free, audio null                                  |
| prueba-trip-libre-sin-audio-3 | 2754f7e2-1ca1-5178-a0d4-678967af6805 | free, audio null                                  |
| prueba-trip-libre-sin-audio-4 | c7b0e40b-d6e2-52ec-b403-3aeb04c755b2 | free, audio null                                  |
| prueba-trip-pago-1            | 227e1e6d-bea4-5415-8e25-ce8d7b41f187 | experiences/staging/prueba-trip-pago-1.mp3        |
| prueba-trip-pago-2            | 55571f67-d288-5eae-8015-fa5e4df8cace | …-pago-2.mp3                                      |
| prueba-trip-pago-3            | 32d4ba14-66d4-565d-94ae-cebb70978465 | …-pago-3.mp3                                      |
| prueba-trip-pago-4            | ec47f4b8-b51f-5b3a-a4a6-4c3ed8af1ae8 | …-pago-4.mp3                                      |

### General feedback — `[PRUEBA] Feedback …` (4) — free, no audio, `imageKey` cycles valid `TRACK_IMAGE_KEYS`

| Slug              | UUID                                 | geo   | pub   |
| ----------------- | ------------------------------------ | ----- | ----- |
| prueba-feedback-1 | 40c8af46-4ee7-5434-925a-9e4fa9efc731 | false | true  |
| prueba-feedback-2 | 711d5393-5dbd-576b-a212-7b64783e60f8 | false | false |
| prueba-feedback-3 | 4eb9fcc5-15fd-5f6d-9797-81881b8fb618 | true  | true  |
| prueba-feedback-4 | b8cb5d2c-4d41-5886-9621-50ad446163be | true  | false |

Titles: `[PRUEBA] Track libre con audio 1` … `[PRUEBA] Recorrido pago 4`, `[PRUEBA] Feedback 1` … `[PRUEBA] Feedback 4` (numbered per group).

## Audio Upload

Reuse `make api-upload-audio-staging FILE=<binary> KEY=experiences/staging/<slug>.mp3` (POST `/audio/upload` with `ADMIN_API_KEY` → staging Worker → `sonora-staging-private-audio`). 16 keys to upload (audio-bearing rows above). Source binaries: user-provided real files (not in repo). Verify each: `bunx wrangler r2 object get sonora-staging-private-audio/<KEY> --config wrangler.staging.toml --remote` (exit 0) + size match.

## File Changes

| File                                          | Action | Description                                                                                        |
| --------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| `apps/api/src/db/seed-data.ts`                | Create | Base themes/experiences/waypoints (moved verbatim) + `assertSeedEnv` + `seedExperiences`           |
| `apps/api/src/db/seed.ts`                     | Modify | Strip data; import base; add base guard                                                            |
| `apps/api/src/db/seed-staging.ts`             | Create | Staging entry: guard + base ∪ staging arrays                                                       |
| `apps/api/src/db/seed-staging-data.ts`        | Create | 28-row matrix (tables above)                                                                       |
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
export const stagingOnlyExperiences: NewExperience[]; // 28 rows
export const stagingOnlyWaypoints: NewWaypoint[]; // 24 rows
```

## Testing Strategy

| Layer        | What to Test                                                                                            | Approach                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Unit         | `assertSeedEnv` all 4 branches (staging/base × env present/absent)                                      | Vitest on pure function, expect exit via mocked `process.exit` |
| Unit         | Matrix integrity: 28 rows, unique ids/slugs, `[PRUEBA]` prefix, every schema combo covered exactly once | Vitest on `stagingOnlyExperiences`                             |
| Integration  | Waypoint scope = union of base+staging IDs only                                                         | Vitest on `seedExperiences` with mock db                       |
| Script/E2E   | Wrong-env run exits non-zero; correct-env run idempotent                                                | Subprocess `bun` runs with env matrix                          |
| Verification | Staging DB has 28 `[PRUEBA]` rows; prod has 0                                                           | SQL count query + CI assertion                                 |

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

- None blocking. Note: 16 real audio binaries must be supplied by the user (paths/TTL of test assets not yet chosen).
