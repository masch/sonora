# Verify Report — tracks-proximity-distance

**Change:** `tracks-proximity-distance`
**Status:** **PASS** (implementation complete, verified against shipped behavior incl. user decisions A–D)
**Branch:** `feat/tracks-proximity-distance` (feature-branch chain; PR 1 + PR 4 + PR 5 + PR 6 cumulative)
**Artifact store:** hybrid
**Verification date:** (this session)

## Scope verified

All 6 PR links applied cumulatively on `feat/tracks-proximity-distance`. Implementation complete per
apply-progress (Engram obs 984 + `apply-progress.md`). Verified against **SHIPPED BEHAVIOR**, honoring user
decisions A/B/C/D which override spec text where they conflict.

## User decisions honored (override spec text)

- **A:** `experiences.geo_mode` NOT NULL with NO default (migration temp DEFAULT for ALTER → backfill → DROP DEFAULT). Schema confirms `experienceGeoModeEnum('geo_mode').notNull()` (no `.default('any')`). Migration 0014 confirms ADD with DEFAULT → backfill → `ALTER COLUMN geo_mode DROP DEFAULT`. ✓
- **B:** NO synthetic seed rows. Seed holds ONLY real experiences, all walkable with `geoMode:'type'`/`radiusMeters:null`; precedence matrix lives in shared `proximity.test.ts` with test data; `seed.test.ts` asserts integrity invariants. ✓
- **C:** `DEFAULT_REMOTE_CONFIG.geofence = { trip:{50,'type'}, track:{50,'type'}, bypassGeofence:false }`. `track.defaultMode='type'` (NOT spec's `entity` — accepted deviation). Confirmed in `schemas/config.ts` + `config.test.ts`. ✓
- **D:** `POST /:id/proximity` has NO `jwtGuard` — only `dbGuard()` + `deviceIdGuard()` + `rateLimit(PROXIMITY_CHECK)` + `zValidator`. Confirmed in `routes/experiences.ts`. ✓

## Per-criterion verification (GEOF.1–GEOF.9) + non-goals

| Criterion                                                       | Verdict                   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GEOF.1** per-format remote config + validation                | **PASS**                  | `packages/shared/src/schemas/config.ts`: `geofence` = `{trip:{radiusMeters,defaultMode}, track:{...}, bypassGeofence}`; `radiusMeters` = `z.number().positive()`. `config.test.ts` asserts defaults (trip 50/type, track present & positive, bypass false), rejects non-positive (`0`,`-10`,`-1`), invalid `defaultMode` (`'off'`), non-number, non-boolean. `track.defaultMode='type'` (decision C). 164 shared tests pass.                                                                                                                                                        |
| **GEOF.2** shared GeoMode + experience fields                   | **PASS**                  | `GeoMode='any'                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 'type' | 'entity'`+`GEO_MODES`in`geo/proximity.ts`.`BaseExperience.geoMode: GeoMode`+`radiusMeters: number | null`in`experiences.ts`;`TrackExperience`/`TripExperience`inherit.`Waypoint.radiusMeters: number` untouched (non-goal preserved). |
| **GEOF.3** DB columns                                           | **PASS**                  | `apps/api/src/db/schema.ts`: `experienceGeoModeEnum('geo_mode', [...GEO_MODES])`; `geoMode: experienceGeoModeEnum('geo_mode').notNull()` (NO default, decision A); `radiusMeters: integer('radius_meters')` nullable. `waypoints` table unchanged (`radius_meters` stays `default(50).notNull()`, no `geoMode`).                                                                                                                                                                                                                                                                    |
| **GEOF.4** additive migration + backfill                        | **PASS**                  | `apps/api/migrations/0014_puzzling_moondragon.sql`: CREATE ENUM; `ADD COLUMN "geo_mode" ... DEFAULT 'any' NOT NULL`; `ADD COLUMN "radius_meters" integer`; `UPDATE ... SET geo_mode='type' WHERE format='trip'`; `UPDATE ... SET geo_mode='any' WHERE format='track'`; `ALTER COLUMN "geo_mode" DROP DEFAULT`. `proximity-migration.test.ts` (DB-free) asserts enum/columns/backfill/DEFAULT-drop/waypoints untouched. PASS.                                                                                                                                                        |
| **GEOF.5** seed integrity                                       | **PASS** (per decision B) | `apps/api/src/db/seed.ts` real rows all `geoMode:'type'`/`radiusMeters:null` (instructions/trips/tracks); `deriva bosque` public trip stays `'type'`. `seed.test.ts` asserts every walkable trip/track = `geoMode:'type'` + `radiusMeters:null`. Precedence matrix (bypass>entity>type>any, fail-closed, inclusive, no-fix, default fallback) covered in shared `geo/proximity.test.ts`. (Spec's "all 3 modes × formats seeded" superseded by decision B.)                                                                                                                          |
| **GEOF.6** API POST `/experiences/:id/proximity` + metadata     | **PASS**                  | `apps/api/src/routes/experiences.ts`: POST route with `dbGuard, deviceIdGuard, rateLimit(PROXIMITY_CHECK), zValidator(json, ProximityBodySchema)`, **no jwtGuard** (decision D); reads published exp, builds GeoFenceConfig from `DEFAULT_REMOTE_CONFIG.geofence`, calls shared `resolveProximity`, returns `{canListen, distanceMeters, effectiveRadiusMeters}`. `cases/experiences.test.ts` PASS: shape via shared resolver, 422 out-of-range lat/lon, 404 unknown id, 404 unpublished, GET surfaces `geoMode`/`radiusMeters`. `PROXIMITY_CHECK` budget in `rate-limit-guard.ts`. |
| **GEOF.7** mobile precedence + fail-closed + inclusive + no-fix | **PASS**                  | `use-offline-geofence.ts` resolves via shared `resolveProximity` (NO local haversine/precedence), reads per-format `config.geofence` + override `{geoMode,radiusMeters,format}` (default `{format:'trip',geoMode:'type'}`), online seam fail-open. `geo/proximity.ts` precedence: bypass > entity (fail-closed invalid/null) > type (per-format fallback) > any; inclusive `distance <= radius`; `user=null → no-fix` blocked. Shared `proximity.test.ts` + mobile hook test cover all.                                                                                             |
| **GEOF.8** TrackDetailView gates only on entity/type            | **PASS**                  | `apps/mobile/src/components/track-detail-view.tsx`: `useOfflineGeofence({track latlon}, {format:'track',geoMode,radiusMeters})`; `isNearStart` wired into `useFeedbackTrigger` (replaces hardcoded true); `isPlaybackBlocked = !isNearStart && !isBypassable && !bypassGeofence`; `GeofenceBlockedBanner` + blocked BottomModal alert + useConfirm bypass; any-mode stays un-gated; bypass wins. `track-detail-view.test.tsx` covers gating (any un-gated, entity/type far → blocked, bypass wins).                                                                                 |
| **GEOF.9** TripDetailView 50 m preserved                        | **PASS**                  | `apps/mobile/src/components/experience-detail-view... trip-detail-view.tsx`: passes `{format:'trip', geoMode, radiusMeters}` (default `'type'` → `geofence.trip.radiusMeters`=50 preserves today). Tests `trip-detail-view.test.tsx` GEOF.9 gate-preservation.                                                                                                                                                                                                                                                                                                                      |
| **Non-goals**                                                   | **PASS**                  | Waypoints untouched (`GEOF.3/C2`). No admin UI (seed is authoring mechanism). Entity override still POSSIBLE via schema (enum + nullable radius remain; precedence covers entity).                                                                                                                                                                                                                                                                                                                                                                                                  |

## Task completion

All implementation-owned checkboxes `[x]` in `tasks.md`. **One (`- [ ]`) unchecked line remains — parent-owned, NOT implementation**:

```text
- [ ] Start or reuse bounded PR review of the slabs (shared module, schema, route, hook, views)  <!-- sdd-owner: parent -->
```

This is a parent/orchestrator action (G3), not an implementation task; per the task-owner marker it does NOT block implementation verification. Archive readiness for implementation = YES; G3 parent-owned review remains the single open care item.

## Strict TDD compliance

Active. Strict-TDD guide loaded. `apply-progress` contains TDD Cycle Evidence tables for all batches (PR1 A1–C4, PR4 D1/D2, PR6 F1–F4/G1/G2). RED→GREEN evidenced per behavior; test files cross-referenced to the codebase (proximity.test.ts, config.test.ts, proximity-migration.test.ts, experiences.test.ts, use-offline-geofence.test.ts, track-detail-view.test.tsx, trip-detail-view.test.tsx). GREEN verified true by full matrix run.

### Assertion quality audit

- No tautologies/ghost loops found; type-only assertions present but backed by behavior tests.
- `seed.test.ts` and `proximity-migration.test.ts` are DB-free content/artifact assertions — this is a documented deviation because the API test env has no live `DATABASE_URL`. They assert the migration SQL contract and schema shape directly (row-count SQL cannot run here). **Noted as a residual risk** (real DB backfill not integration-tested), not a blocker — the concern is recorded for the parent-owned PR review (G3).

## Review Workload / PR boundary

Feature-branch chain (`feat/tracks-proximity-distance`). PR boundaries respected; all 6 links cumulative on the tracker branch. Estimated changed lines ~1100–1300, `400-line-budget risk: High`, `Chained PRs recommended: Yes` — chain was adopted per tasks forecast. No scope creep detected beyond the assigned tasks/A/B/C/D decisions. Note: implementation is UNCOMMITTED in the working tree (orchestrator-owned commit/PR lifecycle pending) — this verify covers the working-tree state, not PR receipts.

## Test / validation commands (all run)

| Command (cwd)                                        | Result                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `cd packages/shared && bunx vitest run`              | **12 files / 164 tests PASS**                                                              |
| `cd apps/api && bun vitest run`                      | **43 files / 484 tests PASS** (teardown DB connection log at end is expected, not failure) |
| `cd apps/mobile && npx jest --watchAll=false`        | **72 suites / 554 tests PASS**                                                             |
| `cd apps/mobile && ./node_modules/.bin/tsc --noEmit` | **EXIT 0**                                                                                 |
| `cd apps/mobile && npx expo lint`                    | **EXIT 0** (no errors in changed files)                                                    |

Note: mobile `npx jest` (not `bunx jest`) used as instructed; `tsc` used `./node_modules/.bin/tsc --noEmit` per command list.

## Blocker

None. Only a single parent-owned open care (G3 bounded PR review) marked that is not an implementation blocker.

## Deviation notes (accepted by user)

- Track default `'type'` (decision C) vs spec's `'entity'`; DB `geo_mode` NOT NULL no default (decision A) vs spec `default 'any'`; seed has no synthetic rows (decision B) unlike spec's "all mode×format combos in DB"; POST `/experiences/:id/proximity` intentionally omits `jwtGuard` (decision D).
