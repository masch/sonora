# Archive Report: Staging-Only Seed Experiences

- **Change**: staging-seed-experiences
- **Archived**: 2026-08-14 → `openspec/changes/archive/2026-08-14-staging-seed-experiences/`
- **Archive type**: **INTENTIONAL-WITH-WARNINGS** — intentional partial/early archive per the maintainer's explicit close directive ("cerremos el cambio moviendo como el resto" — close the change now, moving it to archive like every other change in this repo). Recorded reasons below.
- **Artifact store**: hybrid (OpenSpec filesystem + Engram)

## Final State (at close, per Final-State Authority)

This report is the terminal record of the cycle. Facts below describe the state AT CLOSE; intermediate snapshots (`apply-progress` Engram #994) are history, not current state.

### Code complete

| Artifact                                      | State                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/db/seed-data.ts`                | ✅ Base themes/experiences/waypoints moved verbatim from `seed.ts`; `assertSeedEnv(entry, seedEnv)`; `seedExperiences(db, ...)` upsert on `themes.key` / `experiences.id`; waypoint delete+reinsert scoped to seeded IDs                                                                                    |
| `apps/api/src/db/seed.ts`                     | ✅ Imports base only; `assertSeedEnv('base', SEED_ENV)` before pool; no `stagingOnly*` reference                                                                                                                                                                                                            |
| `apps/api/src/db/seed-staging.ts`             | ✅ `assertSeedEnv('staging', SEED_ENV)` before pool; seeds base ∪ staging                                                                                                                                                                                                                                   |
| `apps/api/src/db/seed-staging-data.ts`        | ✅ 3 explicit `[PRUEBA]` experiences — `prueba-track-audio` (track, free, audio), `prueba-trip-audio` (trip, paid 350000 ARS, audio), `prueba-feedback` (general-feedback, free, no audio); 2 waypoints (trip only); hardcoded UUIDs/slugs; `imageKey` from `TRACK_IMAGE_KEYS`; no combinatorial generation |
| `apps/api/src/db/__tests__/seed-data.test.ts` | ✅ assertEnv 4-branch matrix, explicit-set coverage, union-scoped waypoint replacement, fail-closed E2E subprocess matrix                                                                                                                                                                                   |
| `Makefile`                                    | ✅ `SEED_ENV` forwarding (`api-db-seed-ci`/`-staging`/`-production`); `api-db-seed-ci-staging` target; `api-db-seed-staging` runs `seed-staging.ts` with `SEED_ENV=staging`                                                                                                                                 |
| `.github/workflows/deploy-api-staging.yml`    | ✅ Seed step → `make api-db-seed-ci-staging` with `env: SEED_ENV: staging` on every staging deploy                                                                                                                                                                                                          |
| `.github/workflows/deploy-api-production.yml` | ✅ Seed step adds `env: SEED_ENV: production` on base entry; never invokes staging entry                                                                                                                                                                                                                    |
| `apps/api/eslint.config.js`                   | ✅ Seed files use shared `logger` from `@sonora/shared`; `no-console` overrides not required (apply REVISED)                                                                                                                                                                                                |

### STAGING_AUDIO_KEY reuse

Staging experiences with non-null `audioUrl` reference the shared staging R2 key `experiences/tracks-pajaros-chiricotes.mp3` — an object already present in the staging private bucket (`sonora-staging-private-audio`). No new audio upload was required (apply task 4.2 RESOLVED N/A). `prueba-feedback` has `audioUrl` null.

### Guard semantics

- `seed-staging.ts` exits non-zero (before any write) unless `SEED_ENV === 'staging'` — fail-closed.
- `seed.ts` exits non-zero when `SEED_ENV` is present and `!== 'production'`; absent `SEED_ENV` (local/dev) permitted for base entry.
- Fail-closed E2E verified: subprocess matrix — `SEED_ENV=staging bun src/db/seed.ts` exits non-zero; unset/'production' base runs. PASS.

### Verification at close

| Gate                                                   | Result              |
| ------------------------------------------------------ | ------------------- |
| Local gates — unit/integration tests (`make api-test`) | ✅ PASS — 487 tests |
| Typecheck (`make api-typecheck`)                       | ✅ PASS             |
| Lint (`make lint`)                                     | ✅ PASS             |
| API validate (`make api-validate`)                     | ✅ PASS             |
| Format check (`make format-check`)                     | ✅ PASS             |
| CRITICAL verification issues                           | None                |

**Live-DB verification DEFERRED (intentional, maintainer decision)**: SQL `[PRUEBA]` count and idempotency re-run against live staging Neon were NOT executed — the apply sandbox has no staging DB access. Deferred to the automated staging deploy: `deploy-api-staging.yml` runs `make api-db-seed-ci-staging` (`SEED_ENV=staging`) on every staging deploy. Post-deploy follow-up commands are recorded in `verify-report.md` (this archive): `SELECT count(*) FROM experiences WHERE title LIKE '[PRUEBA]%'` expect 3; re-run seed → counts unchanged. Live results are NOT fabricated.

### Task reconciliation (exceptional, authorized)

Tasks 4.1 and 4.3 remained unchecked at archive time because they were planned as live-DB verification. Per the maintainer's explicit close directive, they were re-scoped to their final deliverable state and checked `[x]`:

- **4.1** → "Staging seed wired into CI deploy workflow (runs on every staging deploy); live `[PRUEBA]` count verification deferred to post-deploy (follow-up commands in verify-report)".
- **4.3** → "Seed idempotency implemented (upsert on themes.key / experiences.id, waypoint replace scoped to seeded ids); live re-run verification deferred to post-deploy".

Proof of completion for the underlying work: `apply-progress` (Engram #994) + unit/integration tests + guard E2E matrix. Final tasks: **16/16 complete**.

### Review gate

`reviewGate` structurally absent — no review was ever discovered or started for this candidate (receipt-driven development kill switch on, verify passed locally, no review artifact exists). Per the Native Review Receipt Gate, absence is not a defect: archive proceeded under ordinary repository policy.

## Intentional Archive Warnings (maintainer-approved)

1. **verify-report.md created at archive time** — no prior verify-report existed (verification phase skipped live-DB work by design). It records: code complete, all local gates green (487 tests), guard E2E verified, live-DB verification deferred to automated staging deploy with exact follow-up commands. Created 2026-08-14 per directive.
2. **Tasks 4.1/4.3 reconciled at archive** — re-scoped to final deliverable state and checked, per maintainer directive, backed by apply-progress proof. Not fabricated live results.
3. **Live-DB verification pending** — SQL count + idempotency re-run deferred to next automated staging deploy; follow-up commands in verify-report.md.

## Traceability — Engram observation IDs read

| Artifact                                      | Obs ID           |
| --------------------------------------------- | ---------------- |
| `sdd/staging-seed-experiences/explore`        | 79b835d270df3d49 |
| `sdd/staging-seed-experiences/propose`        | 990              |
| `sdd/staging-seed-experiences/spec`           | 991              |
| `sdd/staging-seed-experiences/design`         | 992              |
| `sdd/staging-seed-experiences/tasks`          | 993              |
| `sdd/staging-seed-experiences/apply-progress` | 994              |

Filesystem artifacts read: `proposal.md`, `specs/{db-seeding,deployment,ci}/spec.md`, `design.md`, `tasks.md` (pre-reconciliation), `exploration.md`. No review topics exist to read (`reviewGate` absent).

## Specs Synced (source of truth updated)

| Domain     | Action                  | Details                                                                                                                                 |
| ---------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| db-seeding | Created (new full spec) | `openspec/specs/db-seeding/spec.md` — mechanical copy, byte-identical                                                                   |
| deployment | Updated (2 MODIFIED)    | `Makefile Automation` (SEED_ENV forwarding + staging entry + 2 scenarios), `Idempotent Staging Steps` (both seed entries + 3 scenarios) |
| ci         | Updated (2 ADDED)       | `Environment-Scoped Seeding in Deploy Workflows` (3 scenarios), `CI Seed Idempotency` (1 scenario)                                      |

## SDD Cycle

Closed intentionally at archive per maintainer directive. Ready for the next change.
