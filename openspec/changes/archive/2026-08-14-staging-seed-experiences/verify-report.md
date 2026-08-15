# Verify Report: Staging-Only Seed Experiences

- **Change**: staging-seed-experiences
- **Verified**: 2026-08-14 (archive-time creation per maintainer close directive; no prior verify-report existed)
- **Status**: PASS (local gates) — live-DB verification DEFERRED to automated staging deploy (maintainer decision)

## What Was Verified

### Code complete

All implementation work is complete and merged into the branch `feat/staging-seed-experiences`:

- `apps/api/src/db/seed-data.ts` — base themes/experiences/waypoints moved verbatim from `seed.ts`; `assertSeedEnv(entry, seedEnv)` fail-closed guard; `seedExperiences(db, ...)` with upsert on `themes.key` / `experiences.id`; waypoint delete+reinsert scoped to seeded IDs.
- `apps/api/src/db/seed.ts` — imports base only; `assertSeedEnv('base', SEED_ENV)` before pool; no `stagingOnly*` reference.
- `apps/api/src/db/seed-staging.ts` — `assertSeedEnv('staging', SEED_ENV)` before pool; seeds base ∪ staging arrays.
- `apps/api/src/db/seed-staging-data.ts` — 3 explicit `[PRUEBA]` experiences (`prueba-track-audio`, `prueba-trip-audio`, `prueba-feedback`) + 2 waypoints; hardcoded UUIDs/slugs; shared staging R2 key `experiences/tracks-pajaros-chiricotes.mp3` (`STAGING_AUDIO_KEY` reuse); `imageKey` from `TRACK_IMAGE_KEYS`; no combinatorial generation.
- `apps/api/src/db/__tests__/seed-data.test.ts` — assertEnv branches, explicit-set coverage, union-scoped waypoint replacement, fail-closed E2E subprocess matrix.
- `Makefile` — `SEED_ENV` forwarding; `api-db-seed-ci-staging` target; `api-db-seed-staging` runs `seed-staging.ts` with `SEED_ENV=staging`.
- `.github/workflows/deploy-api-staging.yml` — seed step runs `make api-db-seed-ci-staging` with `env: SEED_ENV: staging` on every staging deploy.
- `.github/workflows/deploy-api-production.yml` — seed step adds `env: SEED_ENV: production` on base entry; never invokes staging entry.
- `apps/api/eslint.config.js` — seed files use shared `logger`; `no-console` overrides not required (REVISED at apply).

### Local gates — ALL GREEN

| Gate                                                                                                                          | Result           |
| ----------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Unit/integration tests (`make api-test`)                                                                                      | PASS — 487 tests |
| Typecheck (`make api-typecheck`)                                                                                              | PASS             |
| Lint (`make lint`)                                                                                                            | PASS             |
| API validate (`make api-validate`)                                                                                            | PASS             |
| Format check (`make format-check`)                                                                                            | PASS             |
| Guard fail-closed E2E (subprocess matrix: `SEED_ENV=staging bun src/db/seed.ts` exits non-zero; unset/'production' base runs) | PASS             |

### Defects / open issues

None at close. No CRITICAL or non-critical verification issues remain open.

## Live-DB Verification — DEFERRED (intentional, maintainer decision)

Live staging-DB verification was **not** executed: the apply sandbox has no staging DB access. Per the maintainer's explicit close directive ("cerremos el cambio moviendo como el resto"), live verification is deferred to the automated staging deploy: `deploy-api-staging.yml` runs `make api-db-seed-ci-staging` (with `SEED_ENV=staging`) on every staging deploy, which will execute `seed-staging.ts` against the staging Neon DB.

### Post-deploy follow-up commands (run after the next staging deploy)

1. SQL count — expect exactly 3:
   ```sql
   SELECT count(*) FROM experiences WHERE title LIKE '[PRUEBA]%';
   ```
   (run against `DATABASE_URL_STAGING`, e.g. `psql "$DATABASE_URL_STAGING" -c "SELECT count(*) FROM experiences WHERE title LIKE '[PRUEBA]%';"` — expect `3`)
2. Idempotency re-run — re-run the seed, then re-count; counts MUST be unchanged (no duplicate `[PRUEBA]` rows):
   ```bash
   make api-db-seed-ci-staging   # SEED_ENV=staging, or the deploy workflow's seed step
   # re-run the count query — expect still 3
   ```
3. Optional negative check — production must have 0 `[PRUEBA]` rows:
   ```sql
   SELECT count(*) FROM experiences WHERE title LIKE '[PRUEBA]%';
   ```
   (run against production DB — expect `0`)

## Evidence / Traceability

- This report was created at archive time (2026-08-14) per the maintainer's intentional-close directive; it is the first verify-report for this change.
- Implementation evidence: apply-progress (Engram obs #994, `sdd/staging-seed-experiences/apply-progress`) and the persisted tasks artifact (14/16 checked at apply; tasks 4.1 and 4.3 reconciled at archive — see archive-report for the exact reconciliation).
- Live-DB verification results are NOT fabricated; they remain pending the next automated staging deploy.
