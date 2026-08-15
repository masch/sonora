# Proposal: Staging-Only Seed Experiences

## Intent

Today one seed file (`apps/api/src/db/seed.ts`) runs against both staging and production DBs — any data added to it reaches production. Split seeding into separate, environment-guarded entries so test experiences exist ONLY in staging, never in production.

## Scope

### In Scope

- `seed-data.ts` — base themes/experiences/waypoints moved verbatim from `seed.ts`
- `seed.ts` (prod) — base only; refuses when `SEED_ENV` is set and `≠ production`
- `seed-staging.ts` — base + staging-only experiences; refuses unless `SEED_ENV = staging`
- `SEED_ENV` guard plumbed through Makefile targets + both CI workflows
- Staging test data: stable UUIDs/slugs, literal `[PRUEBA]` title prefix, real asset keys from staging R2 buckets
- ESLint `no-console` override for new seed files

### Out of Scope

- Schema migration, schema flags, client/admin UX changes
- Dynamic/rotating test data (stable fixed set; changes via PR)
- Uploading asset binaries to staging R2 (follow-up — see Dependencies)

## Capabilities

### New Capabilities

- `db-seeding`: environment-isolated seed entries, fail-closed `SEED_ENV` guard, staging-only test data contract (variant matrix, `[PRUEBA]` titles, stable IDs, composition).

### Modified Capabilities

- `deployment`: Makefile seed targets pass `SEED_ENV`; staging target runs `seed-staging.ts`; production target passes `SEED_ENV=production` and runs base entry only.
- `ci`: seed steps pass `SEED_ENV`; staging workflow runs staging entry, production workflow runs base entry only.

## Approach

Composition: `seed.ts` imports base from `seed-data.ts`; `seed-staging.ts` imports base + `stagingOnly*` arrays; waypoint delete scope = union of all seeded IDs (base + staging). Fail-closed guards: staging entry exits unless `SEED_ENV = staging`; base entry exits if `SEED_ENV` present and `≠ production`. Staging CI/Makefile runs only `seed-staging.ts` (composition covers base). Production path and data unchanged.

Variant matrix (minimum set covering schema): track / trip / general-feedback × free-with-audio / free-no-audio / paid (ARS minor units) × `geofenceBypassable` true/false × `published` true/false. The no-audio general-feedback pattern covers the asset-free variant safely.

## Affected Areas

| Area                                 | Impact   | Description                            |
| ------------------------------------ | -------- | -------------------------------------- |
| `apps/api/src/db/seed.ts`            | Modified | Base-only; guard added; data moved out |
| `apps/api/src/db/seed-data.ts`       | New      | Base data (verbatim move)              |
| `apps/api/src/db/seed-staging.ts`    | New      | Staging-only entries + guard           |
| `apps/api/package.json`              | Modified | `db:seed:staging` script               |
| `Makefile`                           | Modified | `SEED_ENV` in seed targets             |
| `.github/workflows/deploy-api-*.yml` | Modified | `SEED_ENV` + staging entry             |
| `apps/api/eslint.config.js`          | Modified | no-console override                    |

## Risks

| Risk                          | Likelihood | Mitigation                                                                      |
| ----------------------------- | ---------- | ------------------------------------------------------------------------------- |
| Test data seeds prod          | Med        | Fail-closed guard; separate file; prod workflow never invokes staging entry     |
| Guard blocks CI (var missing) | Low        | Same PR updates both workflows + Make targets                                   |
| Staging media 404s            | Med        | Real keys from staging buckets; no-audio variant safe; upload follow-up flagged |
| Lint failure                  | Low        | Add new files to override                                                       |

## Rollback Plan

Revert PR and re-run prod seed (upserts only, no deletions). If test data ever reached prod: delete rows by stable staging IDs (FK cascade removes waypoints). Guards make this path near-impossible via CI.

## Dependencies

- Staging R2 buckets (`sonora-staging-*-audio`) with the referenced keys
- Follow-up: upload asset binaries to staging buckets before media verification

## Success Criteria

- [ ] Staging DB = base + `[PRUEBA]` experiences; prod DB = base only (verified by query)
- [ ] `seed-staging.ts` without `SEED_ENV=staging` exits non-zero
- [ ] Staging CI seeds test data; production CI does not
- [ ] Re-running any seed is idempotent (exit 0, no duplicates)
