# Apply Progress - tracks-proximity-distance (PR 6: mobile views + cleanup + regression)

> FINAL apply batch (PR 6 - F1-F4 + G1-G2; G3 note for parent-owned review). Prepended at the FRONT of this file; PR 5/PR 4/PR 1 headers retained below - merging, not overwriting. **This batch COMPLETES the change implementation.**

## PR 6 batch (F1-F4, G1-G2) - mobile views + haversine removal + regression

**Batch:** final link of the feature-branch chain on tracker branch `feat/tracks-proximity-distance`. Scope: F1-F4 + G1-G2 (G3 = note for parent-owned PR review).
**Strict TDD:** RED -> GREEN per behavior.

## TDD Cycle Evidence (PR 6)

| Task                                | RED                                                                                                               | GREEN                                                                                                     | Runner                                                               |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| F1 TrackDetailView gates (GEOF.8)   | new `track-detail-view.test.tsx` (real TRACK fixture) - 3 tests RED (view not passing track geo args, not gating) | wired view to `useOfflineGeofence` + gates + GeofenceBlockedBanner + blocked alert + bypass; suite passes | `npx jest --watchAll=false src/__tests__/track-detail-view.test.tsx` |
| F2 TripDetailView override (GEOF.9) | +1 test RED (override undefined) + fixture typecheck (`trip-detail-view.test.tsx:117`)                            | pass `{ format:'trip', geoMode, radiusMeters }` override; suite passes                                    | same + `trip-detail-view.test.tsx`                                   |
| F3 remove duplicate haversine       | design §7                                                                                                         | removed `utils/haversine.ts` + test; messages.tsx -> shared                                               | full mobile jest                                                     |
| F4 misnamed test fix                | spec risk                                                                                                         | `tracks-detail.test.tsx` deleted -> real `track-detail-view.test.tsx`                                     | git status                                                           |
| G1 full-suite regression            | -                                                                                                                 | shared 164 / api 484 / mobile 554 pass                                                                    | vitest + jest                                                        |
| G2 typecheck+lint                   | -                                                                                                                 | `tsc --noEmit` EXIT 0; `expo lint` EXIT 0; react-doctor 100                                               |                                                                      |

## Completed tasks (persisted `[x]`)

F1 (2) + F2 (2) + F3 (1) + F4 (1) + G1 first two (regression + typecheck/lint) marked `[x]` in `openspec/.../tasks.md`. The G1 parent-owned "Start or reuse bounded PR review" checkbox left `[ ]` (parent action, not implementation-owned).

## Files changed (this batch)

- `apps/mobile/src/components/track-detail-view.tsx` - `useOfflineGeofence({track lat/lon}, { format:'track', geoMode, radiusMeters })`; `isNearStart` into `useFeedbackTrigger`; added `isPlaybackBlocked`/`showBypassWarning`/`handlePlay`/`handleDownload` + `GeofenceBlockedBanner` + blocked `BottomModal` + `useConfirm` bypass flow (mirrors TripDetailView, GEOF.8). Any-mode stays un-gated; bypass wins.
- `apps/mobile/src/components/trip-detail-view.tsx` - pass override `{ format:'trip', geoMode, radiusMeters }` (default 'type' preserves 50 m).
- `apps/mobile/src/__tests__/track-detail-view.test.tsx` (NEW - replaces misnamed `tracks-detail.test.tsx`) - real TRACK fixture (has `geoMode`/`radiusMeters`), F1 gating + asserts view passes own geo data.
- `apps/mobile/src/__tests__/trip-detail-view.test.tsx` - fixture got `geoMode:'type'`/`radiusMeters:null` (F2 typecheck); upgraded `useOfflineGeofence` mock to override shape; added GEOF.9 gate-preservation test.
- `apps/mobile/src/__tests__/tracks-detail.test.tsx` - DELETED (F4 misnamed - it mocked a trip).
- `apps/mobile/src/utils/haversine.ts` - DELETED (F3, design 7).
- `apps/mobile/src/utils/__tests__/haversine.test.ts` - DELETED (cases live in shared `geo/haversine.test.ts`).
- `apps/mobile/src/app/(tabs)/messages.tsx` - import + both call sites repointed to shared `haversineDistance`.

## Test commands run + results (PR 6)

- `apps/mobile` FULL `bunx jest --watchAll=false` -> 72 suites / 554 tests PASS.
- `packages/shared` `bunx vitest run` -> 12 files / 164 tests PASS.
- `apps/api` `bun vitest run` -> 43 files / 484 tests PASS (teardown DB logs at end are expected, not failures).
- `apps/mobile` `bunx tsc --noEmit` -> EXIT 0 (both prior fixture errors F2/F4 resolved).
- `apps/mobile` `bunx expo lint` -> EXIT 0.
- `react-doctor --diff` -> Score 100/100, no issues.

## Deviations / notes (PR 6)

- **F4 resolution:** `tracks-detail.test.tsx` was misnamed (mocked a trip). Renamed to a real `track-detail-view.test.tsx` that renders `poetics/[id]` with a TRACK fixture (adds `geoMode`/`radiusMeters`) covering F1 gating (any un-gated; entity/type far -> banner + blocked alert; bypass wins) plus prior screen not-found/empty coverage.
- Track `isNearStart: true` hardcoded is replaced with `geofence.isNearStart` from the real hook.
- `explore.tsx` still calls `useOfflineGeofence({coords})` (default override format 'trip'/'type') - out of scope, unchanged.
- **G3 (bounded review readiness - for parent):** sensitive spots: migration SQL `0014_puzzling_moondragon.sql` (additive enum+column+backfill UPDATEs, waypoints untouched), precedence resolver `packages/shared/src/geo/proximity.ts` (fail-closed entity invalid-radius), endpoint auth `apps/api/src/routes/experiences.ts` (POST /:id/proximity - jwtGuard removal is documented decision D), view gating (isPlaybackBlocked = !isNearStart && !isBypassable && !bypassGeofence).
- NO commit performed (orchestrator-owned). No `git --no-verify`. Bun minReleaseAge untouched.

## Remaining tasks (deferred)

- Layer 7 G3 parent-owned bounded PR review of the slabs - still `- [ ]`, not implementation-owned; deferred to parent/orchestrator.
- All implementation-owned checkboxes in tasks.md are now `[x]` - implementation complete.

---

# Apply Progress - tracks-proximity-distance (PR 5: mobile hook + config consumers)

> CONTINUATION batch (PR 5 - mobile hook E1 + config consumers E2). Appended at the FRONT of this file; PR 4 and PR 1 headers retained below - merging, not overwriting.

## PR 5 batch (E1, E2) - mobile hook refactor + remote-config consumers

**Batch:** continuation batch on tracker branch `feat/tracks-proximity-distance`. Scope: E1 + E2 (GEOF.7 / GEOF.1, GEOF.9).
**Strict TDD:** RED -> GREEN per behavior.

## TDD Cycle Evidence (PR 5)

| Task                      | RED                                                                                                                                                                                         | GREEN                                                                                             | Runner                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| E1 hook refactor (GEOF.7) | `use-offline-geofence.test.ts` rewritten for NEW signature `useOfflineGeofence(targetCoords, override?, options?{proximityClient,experienceId})` + per-format config - 15 failed / 2 passed | refactored hook to shared `resolveProximity`, online seam fail-open - 17/17                       | `apps/mobile: npx jest --watchAll=false src/hooks/__tests__/use-offline-geofence.test.ts` |
| E2 config consumers       | app-config.test.ts RED (`APP_CONFIG.geofence.trip`/`track` absent -> TS2322), store/app-config tests failing on flat shape                                                                  | app-config per-format + store @sonora/shared per-format; 3 listed tests + use-remote-config green | `npx jest --watchAll=false` (config/store/storage/hook tests)                             |

## Completed tasks (persisted `[x]`)

Layer 5 E1 (2 checkboxes) + E2 (1 checkbox) marked `[x]` in `openspec/.../tasks.md`. No other layers touched (views F1/F2, haversine F3, regression G untouched).

## Files changed (this batch)

- `apps/mobile/src/hooks/use-offline-geofence.ts` - refactored to call shared `resolveProximity` (NO local haversine/precedence), read per-format `config.geofence` + optional `override` (`{geoMode, radiusMeters?, format}`, default `{format:'trip', geoMode:'type'}`); public `GeofenceState` shape UNCHANGED; optional online seam behind injected `proximityClient` (default absent -> offline-only) that fails open to the offline/local result. `ProximityClient`/`ProximityClientResult`/`GeofenceOverride` exported.
- `apps/mobile/src/hooks/__tests__/use-offline-geofence.test.ts` - updated to per-format config shape; 17 tests covering precedence (any/entity/type/bypass), fail-closed entity missing radius, inclusive boundary, no-fix, and online-seam fail-open + authoritative.
- `apps/mobile/src/config/app-config.ts` - `APP_CONFIG.geofence` now per-format (`trip`/`track` radiusMeters via `DEFAULT_REMOTE_CONFIG.geofence`, `bypassGeofence` env override unchanged).
- `apps/mobile/src/config/__tests__/app-config.test.ts` - assert `trip`/`track` radiusMeters > 0 + bypass default false.
- `apps/mobile/src/store/remote-config-store.ts` - NO production change required (already per-format: `INITIAL_REMOTE_CONFIG` spreads `DEFAULT_REMOTE_CONFIG.geofence` (per-format) + overrides `bypassGeofence` from `APP_CONFIG`; `mergeRemoteConfig` validates whole `geofence` field against shared per-format schema). Store's tests updated instead.
- `apps/mobile/src/store/__tests__/remote-config-store.test.ts` - per-format fixtures; whole-field zod validation preserved (partial geofence -> defaults; cached partial deep-merge preserved).
- `apps/mobile/src/storage/__tests__/config-cache.test.ts` - per-format fixtures (`as const` defaultMode).
- `apps/mobile/src/hooks/__tests__/use-remote-config.test.tsx` - config-consumer fixture updated to per-format (kept suite green; additive to listed E2 tests).

## Test commands run + results (PR 5)

- `apps/mobile` hook+config tests -> 91 / 91 PASS (8 suites).
- `apps/mobile` FULL suite -> 73 suites / 556 tests PASS.
- `apps/mobile` typecheck `bunx tsc --noEmit` -> EXIT 2, exactly 2 errors, BOTH pre-existing deferred PR 6 view-test fixtures (`tracks-detail.test.tsx:8`, `trip-detail-view.test.tsx:117`) missing `geoMode`/`radiusMeters` (added by C1/PR1). NOT introduced in this batch; out of scope (F1/F2/F4 in PR 6).
- `apps/mobile` eslint (7 changed files) -> EXIT 0.
- `react-doctor --scope changed` -> Score 100/100, no issues.

## Deviations / notes (PR 5)

- Hook signature kept 2-param `useOfflineGeofence(targetCoords, override?)` per spec; online seam passed as OPTIONAL 3rd `options` param `{ proximityClient?, experienceId? }` - additive, does not change the required signature verified by views together in F1/F2.
- Online seam is offline-only by default (no injected client -> no network call); only when a `proximityClient` is injected does the hook attempt the best-effort online check, and it fails open (`.catch`/`ok:false` -> offline/local decision).
- `remote-config-store.ts` production code unchanged - per-format compatibility already inherited from shared `DEFAULT_REMOTE_CONFIG` (PR 1 C1/B1); only its tests required updating.
- NO commit performed (orchestrator-owned). No `git --no-verify`. Bun minReleaseAge policy untouched.

## Remaining tasks (deferred)

- Layer 6 (F1-F4) - mobile views (TrackDetailView/TripDetailView override) + haversine removal (PR 6).
- Layer 7 (G1-G3) - regression/typecheck/lint cleanup (fix the 2 PR6 view-test fixtures) + parent-owned PR review (G3).
- Mobile `apps/mobile/src/utils/haversine.ts` duplicate remains (F3).
- `apps/mobile/src/__tests__/tracks-detail.test.tsx:8` + `trip-detail-view.test.tsx:117` fixtures need `geoMode`/`radiusMeters` added when F1/F2 land (typecheck blockers carried from PR1).

---

# Apply Progress — tracks-proximity-distance (PR 1: shared foundation)

> PR 1 header retained below. CONTINUATION BATCH (PR 4 — API route: D1, D2) appended at the front of this file, see “## PR 4 batch (D1, D2) — API endpoint”. — merging, not overwriting.

## PR 4 batch (D1, D2) — API endpoint (this batch)

**Batch:** continuation batch on tracker branch `feat/tracks-proximity-distance`. Scope: D1 + D2 (GEOF.6).
**Strict TDD:** RED → GREEN per behavior.

## TDD Cycle Evidence (PR 4)

| Task                                 | RED                                                                                  | GREEN                                   | Runner                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------ | --------------------------------------- | ------------------------------------------------------------ |
| D1 POST /experiences/:id/proximity   | 5 tests in `experiences.test.ts` RED (route missing → 404/JSON-broken)               | route + schema + budget → 5 tests green | `apps/api: npx vitest run src/__tests__/experiences.test.ts` |
| D2 GET surfaces geoMode/radiusMeters | new GET test RED (columns absent from mocked strict `...exp` pass-through assertion) | field surface test green                | same                                                         |

## Completed tasks (persisted `[x]`)

D1 (3 checkboxes) + D2 (2 checkboxes) marked `[x]` in `openspec/.../tasks.md`. No other layers touched.

## Files changed (this batch)

- `packages/shared/src/schemas/proximity.ts` (NEW) — `ProximityBodySchema` + `ProximityBody` (lat/lon bounded via zodiac).
- `packages/shared/src/index.ts` — added `export * from './schemas/proximity';`
- `apps/api/src/routes/experiences.ts` — added `POST /:id/proximity` with dbGuard/deviceIdGuard/jwtGuard/rateLimit(PROXIMITY_CHECK)+zValidator(json,ProximityBodySchema,validationHook); reads published experience; builds GeoFenceConfig from `DEFAULT_REMOTE_CONFIG.geofence`; calls shared `resolveProximity`; returns `{ canListen, distanceMeters, effectiveRadiusMeters }`.
- `apps/api/src/middleware/rate-limit-guard.ts` — added `PROXIMITY_CHECK` (limit 30/60s, prefix `experiences:proximity`), mirroring EXPERIENCES_LIST.
- `apps/api/src/__tests__/experiences.test.ts` — 5 DIVIDED RED→GREEN tests for the proximity endpoint (shape via shared resolver, out-of-range lat/lon → 422, unknown id → 404 NOT_FOUND, unpublished → 404) + 1 geo-metadata surface test for GET /experiences.

## Test commands run + results (PR 4)

- `apps/api` `npx vitest run src/__tests__/experiences.test.ts` → 13 tests PASS.
- `apps/api` `npx vitest run` → 43 files / 484 tests PASS.
- `apps/api` `bunx tsc --noEmit` → EXIT 0.
- `apps/api` `npx eslint` on changed files → clean.
- `packages/shared` `bunx vitest run` → 12 files / 164 tests PASS.
- GET /config per-format `geofence` assertion already present from PR 1 (config.test.ts) — confirmed green; no change needed.

## Deviations / notes (PR 4)

- **Schema location:** `ProximityBodySchema` defined in `@sonora/shared` (`schemas/proximity.ts`) instead of inline in the route, because `apps/api` has no direct `zod` dependency (zod lives in `@sonora/shared`). Matches the existing `FeedbackPostBodySchema` pattern; design §2.1 shows the body inline but the task explicitly allows “shared schemas or route module”.
- **PROXIMITY_CHECK budget:** mirrored `EXPERIENCES_LIST` (30 req / 60 s) with a distinct `keyPrefix` (`experiences:proximity`) — closed the design §10 open decision.
- **Config note:** inherit from PR 1 user decision C — `track.defaultMode='type'` (both formats default to `type`), applying to proximity resolution identically back/front via the shared resolver. GEOF.1's `track.defaultMode='entity'` remains a spec deviation agreed by the user in PR 1; endpoint uses whatever `DEFAULT_REMOTE_CONFIG.geofence` holds (no divergence).
- NO commit performed (orchestrator-owned). No `git --no-verify`. Bun minReleaseAge policy untouched.

## Remaining tasks (deferred)

- Layer 5 (E1, E2) — mobile hook refactor + remote-config consumers (PR 5).
- Layer 6 (F1–F4) — mobile views + haversine removal (PR 6).
- Layer 7 (G1–G3) — regression/typecheck/lint + parent-owned PR review (G3 parent-owned).
- Mobile `haversine.ts` duplicate remains (PR 5/6).

---

# Apply Progress — tracks-proximity-distance (PR 1: shared foundation)

**Change:** `tracks-proximity-distance`
**Batch:** FIRST apply batch (foundation). Scope: A1, A2, A3, B1, C1, C2, C3, C4.
**Branch:** feat/tracks-proximity-distance (tracker branch — worked directly, no divergence).
**Strict TDD:** Enabled.

## TDD Cycle Evidence

| Task                                          | RED                                                                            | GREEN                                             | Runner                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------- | ------------------------------------------ |
| A1 resolveListenRadius precedence             | proximity.test.ts written, module missing (`Cannot find module './proximity'`) | implemented proximity.ts; 17 tests green          | `packages/shared: bunx vitest run src/geo` |
| A2 resolveProximity (boundary, no-fix, nulls) | same RED file (module absent)                                                  | green with A1                                     | above                                      |
| A3 haversine migration                        | haversine.test.ts redundancy/missing module                                    | green                                             | above                                      |
| B1 per-format config schema + defaults        | config.test.ts RED: 13 TS shape errors, flat vs per-format                     | updated schemas/config.ts → 164 shared tests pass | `packages/shared: bunx vitest run`         |
| C1 GeoMode + BaseExperience fields            | experiences.ts lacks fields (typecheck)                                        | green                                             | tsc                                        |
| C2 DB enum + columns                          | schema.ts lacked columns                                                       | green                                             | tsc                                        |
| C3 migration + backfill + regression          | migration SQL missing backfill                                                 | appended backfill; 10 test pass                   | `apps/api: vitest run proximity-migration` |
| C4 seed coverage                              | seed lacked mode×format coverage                                               | added rows; 10.014 test pass                      | `apps/api: vitest run seed.test.ts`        |

## Completed tasks (persisted `[x]` in tasks.md)

A1 onward: all 16 implementation tasks for layers A1(ref2+), A2(2), A3(2), B1(4), C1, C2, C3(2), C4(2) marked `[x]`.

## Files changed (this batch)

- `packages/shared/src/geo/proximity.ts` (NEW) — GEO_MODES, GeoMode, GeoFormatConfig, GeoFenceConfig, GeoPoint, ListenRadiusInput, RadiusResolution, ProximityDecisionInput, ProximityDecision, resolveListenRadius, resolveProximity, haversineDistance.
- `packages/shared/src/geo/proximity.test.ts` (NEW) — resolveListenRadius precedence + resolveProximity.
- `packages/shared/src/geo/haversine.test.ts` (NEW) — migrated mobile cases.
- `packages/shared/src/experiences.ts` — added `geoMode`/`radiusMeters` to BaseExperience (imports GeoMode type from geo/proximity).
- `packages/shared/src/schemas/config.ts` — per-format `geofence` (`trip`/`track` radiusMeters+cdefaultMode, bypassGeofence) in schema + DEFAULT_REMOTE_CONFIG.
- `packages/shared/src/__tests__/config.test.ts` — per-format shape/defaults/type assertions.
- `packages/shared/src/index.ts` — `export * from './geo/proximity';`
- `apps/api/src/db/schema.ts` — `experienceGeoModeEnum` + `geoMode`/`radiusMeters` columns on experiences.
- `apps/api/migrations/0014_puzzling_moondragon.sql` (NEW) — enum + columns + backfill UPDATEs.
- `apps/api/src/__tests__/proximity-migration.test.ts` (NEW) — migration regression (DB-free).
- `apps/api/src/db/seed.ts` — geoMode/radiusMeters on rows + representative mode×format rows; exported defaultExperiences; guarded side effects via import.meta.main.
- `apps/api/src/__tests__/seed.test.ts` (NEW) — seed coverage assertions (DB-free).
- `apps/api/src/__tests__/proximity-migration.test.ts`

## Test commands run + results

- `packages/shared` `bunx vitest run` → 12 files / 164 tests PASS.
- `apps/api` `bun vitest run` → 43 files / 480 tests PASS.
- `apps/api` `bunx tsc --noEmit` → EXIT 0.
- Not run this batch: mobile (jest) — config consumers NOT touched yet (E2/PR 5), expected mid-chain breakage.

## Deviations from design / notes

- **Implementation-owned** `geoMode`/`GEO_MODES` defined once in `geo/proximity.ts`; `experiences.ts` imports the `GeoMode` type for the new fields instead of re-exporting (index already star-exports `./geo/proximity`, avoids duplicate export collisions). Shared package exposes GeoMode/GEO_MODES centrally.
- **C3 migration regression** is written as DB-free content/artifact assertions (additive ALTERS, NOT NULL, backfill UPDATEs, waypoints untouched) because the API test env has no live DATABASE_URL (DB mocked throughout). Row-count `SELECT` regression cannot run here; covered by the DELETE NOT NULL constraint + backfill statements.
- **C4 seed regression** is a DB-free data-shape assertion over the exported seed definitions (all mode×format combos, entity radii positive, deriva bosque=type) for the same reason.
- Tasks B1 mentioned `trip.defaultMode:'trip'` typo — spec GEOF.1 and design §5 authoritative say `type`. Used `type`.

## Workload / PR boundary

- Feature Branch Chain; this PR = link #1 (foundation). Estimated changed lines: well under 400. No commit performed (orchestrator ownership), no `git --no-verify` used.

## Remaining tasks (deferred to later PRs — not in this batch)

- Layer 4 (D1, D2) — API POST /proximity endpoint + surface metadata (PR 4).
- Layer 5 (E1, E2) — mobile hook refactor + config consumers (PR 5) [E2 will update the mobile flat-geofence consumers broken by B1].
- Layer 6 (F1–F4) — mobile views + haversine removal (PR 6).
- Layer 7 (G1–G3) — regression/typecheck/lint + parent-owned PR review (G3 parent).
- Mobile: `apps/mobile/src/utils/haversine.ts` duplicate NOT removed this batch (that is E2/PR5-F3); shared impl is the source of truth.
