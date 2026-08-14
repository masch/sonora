# Tasks: Staging-Only Seed Experiences

## Review Workload Forecast

| Field                   | Value                                   |
| ----------------------- | --------------------------------------- |
| Estimated changed lines | ~700–800 (data matrix + tests dominate) |
| 400-line budget risk    | High                                    |
| Chained PRs recommended | Yes                                     |
| Suggested split         | PR 1 → PR 2 → PR 3 (ops)                |
| Delivery strategy       | ask-on-risk                             |
| Chain strategy          | pending                                 |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal                                                               | Likely PR  | Focused test command                                                                                     | Runtime harness                                                                                     | Rollback boundary                                      |
| ---- | ------------------------------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1    | Base refactor + guard (`seed-data.ts`, `seed.ts`, eslint override) | PR 1       | `cd apps/api && bun run test`                                                                            | `make api-db-seed` (local Postgres, no SEED_ENV)                                                    | Revert 3 files; behavior identical to today            |
| 2    | Staging data + entry + Makefile + both CI workflows                | PR 2       | `cd apps/api && bun run test`                                                                            | `make api-db-seed-staging` (staging Neon)                                                           | Revert staging files/workflows; base CI path unchanged |
| 3    | Upload 16 audio binaries + verify (blocked on user assets)         | PR 3 (ops) | `bunx wrangler r2 object get sonora-staging-private-audio/<KEY> --config wrangler.staging.toml --remote` | `make api-upload-audio-staging FILE=<bin> KEY=experiences/staging/<slug>.mp3` (real staging Worker) | `wrangler r2 object delete` the 16 keys                |

## Phase 1: Foundation — base refactor (TDD)

- [x] 1.1 RED: Write `apps/api/src/db/__tests__/seed-data.test.ts` — `assertSeedEnv` 4 branches (staging: unset/'production' → exit 1; base: 'staging' → exit 1, unset/'production' → OK) with mocked `process.exit`. Verify: `make api-test` (expect fail).
- [x] 1.2 GREEN: Create `apps/api/src/db/seed-data.ts` — move base themes/experiences/waypoints verbatim from `seed.ts`; add `assertSeedEnv(entry, seedEnv)` + `seedExperiences(db, {themes, experiences, waypoints})` (upsert themes→experiences; delete waypoints `inArray` seeded IDs; reinsert). Verify: `make api-test`.
- [x] 1.3 Refactor `apps/api/src/db/seed.ts` — strip data, import base from `seed-data.ts`, `assertSeedEnv('base', process.env.SEED_ENV)` before pool, call `seedExperiences`. Verify: `make api-test && make api-typecheck && make api-db-seed`.
- [x] 1.4 Add `src/db/seed-data.ts` to no-console override in `apps/api/eslint.config.js`. Verify: `make lint`.

## Phase 2: Staging data + entry (TDD)

- [x] 2.1 RED: Extend `seed-data.test.ts` — matrix integrity: 28 rows, unique ids/slugs, `[PRUEBA]` prefix, every format×free/audio/paid×geo×published combo once, `imageKey` ∈ TRACK_IMAGE_KEYS, paid track 150000 / trip 350000 ARS. Verify: `make api-test` (expect fail).
- [x] 2.2 GREEN: Create `apps/api/src/db/seed-staging-data.ts` — export `stagingOnlyExperiences` (28: 12 tracks, 12 trips, 4 feedback) + `stagingOnlyWaypoints` (24, 2 per trip); hardcoded UUIDs/slugs/audio keys per design tables. Verify: 2.1 passes.
- [x] 2.3 RED: Integration — `seedExperiences` with mock db deletes waypoints only for union(base+staging) IDs; others untouched. Verify: `make api-test` (expect fail).
- [x] 2.4 GREEN: Create `apps/api/src/db/seed-staging.ts` — `assertSeedEnv('staging', SEED_ENV)` before pool; seed base ∪ staging arrays. Verify: 2.3 passes.
- [x] 2.5 Add `db:seed:staging` script (`bun src/db/seed-staging.ts`) to `apps/api/package.json`; add `seed-staging.ts` + `seed-staging-data.ts` to eslint override. Verify: `make lint && make api-typecheck`.

## Phase 3: Makefile + CI wiring

- [x] 3.1 `Makefile` — forward `SEED_ENV` in `api-db-seed-ci`/`-staging`/`-production`; `api-db-seed-staging` runs `seed-staging.ts` with `SEED_ENV=staging`; add `api-db-seed-ci-staging`. Verify: `make -n api-db-seed-ci-staging`.
- [x] 3.2 `deploy-api-staging.yml` — seed step → `make api-db-seed-ci-staging` with `env: SEED_ENV: staging` (keep DATABASE_URL). Verify: workflow review.
- [x] 3.3 `deploy-api-production.yml` — seed step adds `env: SEED_ENV: production` on base entry; never invokes staging entry. Verify: workflow review.
- [x] 3.4 E2E guard: subprocess matrix — `SEED_ENV=staging bun src/db/seed.ts` exits non-zero; unset/'production' base runs. Verify: `make api-test`.

## Phase 4: Verification + ops

- [ ] 4.1 Run `make api-db-seed-staging` (staging Neon); SQL count `[PRUEBA]` = 28 in staging, 0 in prod. Verify: `SELECT count(*) FROM sonora.experiences WHERE title LIKE '[PRUEBA]%'`. Code complete — verification pending live staging DB execution (no DB access in apply sandbox).
- [x] 4.2 Ops — RESOLVED as N/A: audio is served from R2, no binary upload needed. Staging audio rows reuse the existing object key `experiences/tracks-pajaros-chiricotes.mp3` (already present in the staging private bucket; the seed stores keys only). No upload/verify step.
- [ ] 4.3 Idempotency: re-run staging seed + `make api-db-migrate-ci` twice → exit 0, no duplicate `[PRUEBA]` rows. Verify: `make api-db-seed-staging` ×2 + SQL count. Underlying idempotency implemented (single-source upsert); verification pending live staging DB execution.
