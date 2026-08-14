# Exploration: Staging-Only Seed Experiences

## Current State

### Seeding architecture

- **Stack**: Drizzle ORM (`drizzle-orm` 0.45.2) + `pg` Pool for seeds. Drizzle Kit handles migrations (`drizzle-kit generate/migrate/studio`). DB target is Postgres (local Docker via `docker-compose.yml`; Neon HTTP in cloud).
- **Seed entry**: `apps/api/src/db/seed.ts` — a standalone Bun script run via `"db:seed": "bun src/db/seed.ts"` (`apps/api/package.json`). It reads `process.env.DATABASE_URL` (required, exits otherwise — `seed.ts:7-12`), creates a `pg` Pool with `max: 1`, and wraps it with `createDbClient('pg', pool)` from `src/db/index.ts:24-40`.
- **Seed content** (`seed.ts`): 4 themes upserted on `themes.key` (`seed.ts:144-146`); 4 experiences upserted on `experiences.id` via `onConflictDoUpdate` (`seed.ts:151-157`); waypoints deleted + reinserted only for the seeded experience IDs (`seed.ts:160-166`, scoped by `inArray(waypoints.experienceId, seededExperienceIds)`). Idempotent. Data lives inline as `as const` TS arrays (`seed.ts:41-95` trips/tracks, `97-111` general feedback) — no JSON fixtures, no factories. Money in integer minor units (`price: 1000000` = ARS 10.000, per AGENTS.md).
- **No seed tests exist** (`apps/api/src/db/` has no `__tests__`).

### Experiences data model

- `apps/api/src/db/schema.ts:45-65` — `experiences` table: `id` (uuid, defaultRandom, PK), `slug` (unique), `title`, `description`, `format` (enum track/trip/general-feedback), `themeKey` (FK → themes), `audioUrl`, `durationSeconds`, `latitude`/`longitude`, `recordedAt`, `free`, `price` (integer minor units), `currency` (default ARS), `imageKey`, `geofenceBypassable`, `published` (boolean).
- `apps/api/src/db/schema.ts:67-77` — `waypoints` (FK cascade to experiences, `order`, lat/long, `audioUrl`, `radiusMeters`).
- Shared types/constants in `packages/shared/src/experiences.ts` — `EXPERIENCE_FORMATS` (`:4-5`), `GENERAL_FEEDBACK_EXPERIENCE_ID` (`:9-10`), `TRACK_IMAGE_KEYS` (`:14-19`).
- The client list route filters `published = true` (`apps/api/src/routes/experiences.ts:25`); unpublished experiences are hidden from purchases (`payments.ts:96,489`) and audio streaming (`audio.ts:223-229`).

### Environment detection

- **Worker**: `ENVIRONMENT` var in wrangler configs — `wrangler.toml:27` = `"production"`, `wrangler.staging.toml:27` = `"staging"`. Read at runtime via `c.env?.ENVIRONMENT` in `src/middleware/env-guard.ts:9` (falls back to `'unknown'`, sets `c.var.environment`) and `src/middleware/payments-guard.ts:19` (falls back to `'production'`). Exposed via `/health` (`src/routes/health.ts`).
- **Local API dev**: `apps/api/.env.staging` carries `ENVIRONMENT=staging`; `src/server.local.ts:17` passes `process.env` straight into `app.fetch`.
- **Mobile**: `APP_ENV` (`apps/mobile/app.config.ts:5`, `isProduction = process.env.APP_ENV === 'production'`); android workflows pass `APP_ENV: staging|production`.
- **CRITICAL**: the seed script runs OUTSIDE the Worker. It only reads `process.env.DATABASE_URL` and has **no access to wrangler vars and no `ENVIRONMENT` awareness**. Today the "environment" for seeding is decided purely by which DATABASE_URL is passed.

### Seed execution flow

- Makefile targets (`Makefile`):
  - `api-db-seed` (`:607-608`) — local Postgres
  - `api-db-seed-ci` (`:631-632`) — `DATABASE_URL` from env (CI)
  - `api-db-seed-staging` (`:635-636`) — `DATABASE_URL_STAGING_CLEAN` (from `api/.env`)
  - `api-db-seed-production` (`:639-640`) — `DATABASE_URL_PRODUCTION_CLEAN`
  - `api-deploy-staging-full` / `api-deploy-production-full` (`:643-648`) — deploy + seed
  - `api-dev-full` (`:805`) — db-up + migrate + seed + local dev
- **CI**: `.github/workflows/deploy-api-staging.yml:47-50` AND `.github/workflows/deploy-api-production.yml:35-38` BOTH run `make api-db-seed-ci` with only `secrets.DATABASE_URL` (GitHub environment-scoped: staging job → staging DB, prod job → prod DB). **The identical seed file runs against both databases; there is no guard preventing any data in the seed from reaching production.**
- Seeds are NOT run by Wrangler or by Drizzle migrate — only via the explicit CI steps / Make targets above.

### Existing environment-specific data / precedent

- **None for seeds.** The archived `2026-06-15-cloud-staging-deployment` change seeded identical data to both environments.
- `published: false` exists (`seed.ts:93`, `pajaros-chiricotes`) but hides content from ALL environments — not a staging-only mechanism.
- One precedent for env-conditional Worker behavior: `MP_BYPASS_SIGNATURE` differs between wrangler configs (`wrangler.staging.toml:32` = true, `wrangler.toml:38` = false) — but this applies inside the Worker only, not to seeds.

## Affected Areas

- `apps/api/src/db/seed.ts` — the single current seed entry; either split data out or add a sibling staging entry.
- `apps/api/src/db/seed-data.ts` (new, if composition chosen) — shared base experiences/themes/waypoints module imported by both seeds.
- `apps/api/src/db/seed-staging.ts` (new) — staging-only additions (or env-gated array inside seed.ts if single-entry chosen).
- `apps/api/package.json` — add `db:seed:staging` script.
- `Makefile` — `api-db-seed-staging` / `api-db-seed-production` / `api-db-seed-ci` need to pass an env guard var (e.g. `SEED_ENV`); possibly new target `api-db-seed-staging-only`.
- `.github/workflows/deploy-api-staging.yml` + `deploy-api-production.yml` — pass `SEED_ENV` (or call the staging-only target) in the seed steps; production step must never invoke staging additions.
- `apps/api/eslint.config.js:48` — `no-console` override list currently names `src/db/seed.ts` explicitly; any new seed/data file must be added there.
- `apps/api/src/db/index.ts` — reused as-is by any new seed (no change expected).
- `packages/shared/src/experiences.ts` — add staging experience ID constants / image keys if TRACK_IMAGE_KEYS or instruction constants are needed.

## Approaches

1. **Separate entry file + shared base module (composition)** — split current data into `seed-data.ts` (base: themes + prod experiences + waypoints) and `seed-staging.ts` that imports base + staging-only arrays, with its own `SEED_ENV`-based fail-closed guard.
   - Pros: matches the user's ask ("separate seed files"); prod path untouched; staging additions physically absent from the prod entry; base data written once (no duplication); "staging = prod + additions" falls out naturally by import composition.
   - Cons: two entries to maintain; guard must still be proven (an env guard inside seed-staging.ts must reject non-staging or the file can still be run by hand against prod).
   - Effort: Low/Medium

2. **Single entry, env-gated staging array** — keep `seed.ts`, add `STAGING_ONLY_EXPERIENCES` and skip it unless `SEED_ENV === 'staging'`.
   - Pros: smallest diff; no new files; single lint/test surface.
   - Cons: mixes prod/staging concerns in one file; risk of accidentally flipping the guard or the data leaking if the guard is removed; doesn't answer "separate files" cleanly.
   - Effort: Low

3. **Data-level environment column (schema change)** — add `environment` column to experiences and filter by it in the API; seed everything everywhere.
   - Pros: runtime-enforced separation, works even if data lands in the wrong DB.
   - Cons: schema migration, API route changes, client impact; much heavier than the problem requires; still doesn't prevent the seed from inserting into prod.
   - Effort: High (rejected as over-engineering for this ask)

## Recommendation

**Approach 1** (separate `seed-staging.ts` importing a shared base `seed-data.ts`), combined with a **fail-closed env guard** in both entries:

- `seed-data.ts`: exports `defaultThemes`, `baseExperiences`, `baseWaypoints` (moved verbatim from today's `seed.ts`).
- `seed.ts` (prod): imports base, seeds base only. Guard: if `SEED_ENV` is provided and `!== 'production'`, refuse.
- `seed-staging.ts`: imports base + `stagingOnlyExperiences`/`stagingOnlyWaypoints`; refuses to run unless `SEED_ENV === 'staging'`. Waypoint delete scope = base + staging IDs (union), preserving the existing "only touch seeded experiences" behavior.
- CI: staging workflow passes `SEED_ENV: staging` and runs the staging entry; production workflow passes `SEED_ENV: production` and runs only the base entry. Make targets pass the same var.
- Guard default = refuse staging data whenever the env var is absent or not `staging` (fail-closed), so an accidental `bun src/db/seed-staging.ts` against a prod DATABASE_URL fails loudly.

## Risks

- **Accidental production seeding of test data**: mitigated by fail-closed guard + separate entry + production workflow never invoking the staging file. The guard is the only hard boundary — manual runs are possible but loud.
- **CI var plumbing**: `ENVIRONMENT` is not currently available to seed steps (workflows pass only `DATABASE_URL`); the new `SEED_ENV` must be added to both workflows and Make targets, or the guard will block everything (fail-closed, but confusing).
- **Staging test experiences need real assets**: `audioUrl`/`imageKey` point to R2 keys; staging buckets are separate (`sonora-staging-*-audio`). Test experiences with `published: true` must reference assets that exist in the staging bucket or rendering/playback breaks. The general-feedback experience has no audio (audioUrl omitted) — a safe pattern for free test entries.
- **Waypoint staleness**: delete+reinsert is scoped to seeded IDs; if a staging-only experience's waypoint set changes between runs, stale waypoints can linger (same behavior as today for base data — pre-existing, not introduced by this change).
- **Lint**: new seed files must be added to the `no-console` override at `apps/api/eslint.config.js:48` or CI lint fails.

## Ready for Proposal

Yes. Key decisions for the proposal phase: (1) guard var name (`SEED_ENV` vs reusing `ENVIRONMENT`) and its plumbing through workflows + Makefile; (2) fail-closed default (recommended); (3) asset strategy for staging test experiences (which audio/image keys, free-only or also paid/geofenced variants); (4) stable UUIDs for staging-only experiences; (5) whether admin/staging app needs any UX to distinguish test content.
