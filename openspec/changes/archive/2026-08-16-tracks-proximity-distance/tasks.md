# Tasks — Tracks & proximity listening (centralized shared proximity)

**Change:** `tracks-proximity-distance`
**Status:** Tasks
**Artifact store:** hybrid (Engram `sdd/tracks-proximity-distance/tasks` + this file)
**Inputs:** proposal.md, spec.md (GEOF.1–GEOF.9), design.md (§1–§7 authoritative, §8 test strategy)

Implementation follows strict TDD (RED → GREEN per behavior). Every behavior lands with its test in the
same batch. Apply MAY use per-batch checkboxes when it re-runs a batch after partial completion.

## Review Workload Forecast

| Field                   | Value                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Estimated changed lines | **~1,100–1,300** (rough)                                                                                                                          |
| 400-line budget risk    | High                                                                                                                                              |
| Chained PRs recommended | Yes                                                                                                                                               |
| Suggested split         | PR 1 (shared foundation) → PR 2 (shared config) → PR 3 (DB+seed) → PR 4 (API route) → PR 5 (mobile hook) → PR 6 (mobile views+cleanup+regression) |
| Delivery strategy       | ask-on-risk                                                                                                                                       |
| Chain strategy          | pending (user must choose stacked-to-main vs feature-branch-chain)                                                                                |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High
```

> The implementation is well over 400 changed lines and spans 6 autonomous work units. Each PR below has
> its own start/finish/verification/rollback boundary and is a candidate chained PR. **A delivery decision
> (chain strategy + whether to chain) must be collected before `sdd-apply` runs.**

---

## Layer A — Shared foundation (PR 1)

### A1. New pure proximity module

- [x] Write RED tests in `packages/shared/src/geo/proximity.test.ts` for `resolveListenRadius` precedence:
      `bypassGeofence:true` → unrestricted/bypass (wins over a presumably-invalid entity radius);
      `geo_mode='entity'` → gated by entity `radiusMeters`; `geo_mode='type'` → gated by
      `geofence[format].radiusMeters` (trip vs track separately); `geo_mode='any'` → unrestricted/any;
      missing `geoMode` falls back to `geofence[format].defaultMode`. <!-- sdd-owner: implementation -->
- [x] Implement `packages/shared/src/geo/proximity.ts` exporting `GEO_MODES`, `GeoMode`,
      `GeoFormatGeoFence`, `GeoFenceConfig`, `GeoPoint`, `ListenRadiusInput`, `RadiusResolution`,
      `ProximityDecisionInput`, `ProximityDecision`, `resolveListenRadius`, `resolveProximity`,
      `haversineDistance` per design §1.2, with `resolveListenRadius` semantics exactly as §1.3
      (fail-closed `blocked` when entity has no positive radius; `any` fallback), and export from
      `packages/shared/src/index.ts` (`export * from './geo/proximity';`). <!-- sdd-owner: implementation -->

### A2. Proximity decision + inclusive boundary (TDD, GEOF.7)

- [x] Extend `packages/shared/src/geo/proximity.test.ts`: `resolveProximity` with
      `user={lat,lon}` computes `distanceMeters`, `effectiveRadiusMeters` and inclusive boundary
      `distance <= radius` → `allowed`, else `blocked`; `user=null` → `no-fix` gated/blocked;
      unrestricted → `distanceMeters`/`effectiveRadiusMeters` null. <!-- sdd-owner: implementation -->
- [x] Implement `resolveProximity` in `packages/shared/src/geo/proximity.ts` per design §1.3. <!-- sdd-owner: implementation -->

### A3. Migrate haversine to shared (GEOF.7 inclusive math)

- [x] Create `packages/shared/src/geo/haversine.test.ts` carrying over the cases from
      `apps/mobile/src/utils/__tests__/haversine.test.ts` (now named `getHaversineDistance` → shared
      `haversineDistance`; keep identical numeric expectations). Keep shared distance function
      implemented once in `proximity.ts`. <!-- sdd-owner: implementation -->
- [x] Implement `haversineDistance(lat1,lon1,lat2,lon2)` in `packages/shared/src/geo/proximity.ts`
      (identical R=6371e3 formula) and re-import from `./haversine.test.ts`. <!-- sdd-owner: implementation -->

---

## Layer 2: Shared remote-config schema (PR 2)

### B1. Per-format geofence config schema + defaults (GEOF.1)

- [x] Extend `packages/shared/src/__tests__/config.test.ts` (existing file, tests schema at
      `packages/shared/src/schemas/config.ts`) RED-style: per-format `geofence` shape with
      `trip.defaultMode='type'`, `track.defaultMode='entity'`, `trip.radiusMeters` defaulting to 50,
      `track.radiusMeters` present & positive, and `bypassGeofence` boolean present. <!-- sdd-owner: implementation -->
- [x] Update `packages/shared/src/schemas/config.ts` `RemoteConfigPayloadSchema.geofence` to
      `{ trip: { radiusMeters, defaultMode }, track: { radiusMeters, defaultMode }, bypassGeofence }`
      (both formats identical shape; `radiusMeters` via `z.number().positive()`) and update
      `DEFAULT_REMOTE_CONFIG` to `{ trip:{radiusMeters:50, defaultMode:'trip'}, track:{radiusMeters:50, defaultMode:'entity'}, bypassGeofence:false }`.
      Update any `RemoteConfigPayload` usage (mobile `remote-config-store.ts`, `app-config.ts`,
      `apps/api/src/routes/config.ts` spread). <!-- sdd-owner: implementation -->
- [x] In `packages/shared/src/__tests__/config.test.ts`: add RED for `geofence.trip.radiusMeters <= 0`
      and `geofence.track.radiusMeters <= 0` → validation fails (GEOF.1). <!-- sdd-owner: implementation -->
- [x] Assert in `config.test.ts` that `DEFAULT_REMOTE_CONFIG.geofence` satisfies the typed shape
      (update existing `fullPayload`/TypeScript type assertions). <!-- sdd-owner: implementation -->

---

## Layer 3: DB schema + migration + seed (PR 3)

### C1. GeoMode shared type + experience fields (GEOF.2)

- [x] Add `export type GeoMode = 'any'|'type'|'entity'` + `GEO_MODES` to
      `packages/shared/src/experiences.ts` (or re-export from a shared `geo` source) and add
      `geoMode: GeoMode` + `radiusMeters: number | null` to `BaseExperience`. Verify
      `TrackExperience`/`TripExperience` inherit them. `Waypoint.radiusMeters` stays untouched (non-goal). <!-- sdd-owner: implementation -->

### C2. DB columns + enum (GEOF.3)

- [x] In `apps/api/src/db/schema.ts`: add `experienceGeoModeEnum = sonoraSchema.enum('geo_mode', [...GEO_MODES])`
      and add `geoMode: experienceGeoModeEnum('geo_mode').default('any').notNull()` and
      `radiusMeters: integer('radius_meters')` (nullable) to the `experiences` table. `waypoints` table
      unchanged. <!-- sdd-owner: implementation -->

### C3. Additive migration + backfill (GEOF.4)

- [x] Generate the additive Drizzle migration via `drizzle-kit generate`; confirm SQL adds
      `geo_mode` (NOT NULL, DEFAULT `'any'`) + `radius_meters` (nullable) and backfills:
      `UPDATE experiences SET geo_mode='type' WHERE format='trip';` and
      `UPDATE experiences SET geo_mode='any' WHERE format='track';`. <!-- sdd-owner: implementation -->
- [x] Add migration regression tests (in `apps/api/src/app/migrations` test or via schema test) asserting
      row counts: count trips = count trips with `geo_mode='type'`; tracks all `geo_mode='any'`; no NULL
      `geo_mode`. <!-- sdd-owner: implementation -->

### C4. Seed covers all modes × formats (GEOF.5)

- [x] Extend `apps/api/src/db/seed.ts`: add `geoMode`/`radiusMeters` to existing rows (trips→`type`,
      tracks→`any`) and add representative rows so both `track` and `trip` have solutions for each of
      `any`/`type`/`entity`, with every `entity` row carrying a positive `radius_meters`. Keep the
      `deriva bosque` public trip at `'type'` (preserves 50 m). <!-- sdd-owner: implementation -->
- [x] Add/reconfirm a RED seed assertion that running the seed yields every `mode × format` combination
      and every `entity` row has `radiusMeters > 0`. <!-- sdd-owner: implementation -->

---

## Layer 4 — API endpoint (PR 4)

### D1. Proximity body schema + route (GEOF.6)

- [x] Add RED in `apps/api/src/__tests__/experiences.test.ts` for
      `POST /experiences/:id/proximity`: returns `{ canListen, distanceMeters, effectiveRadiusMeters }`;
      out-of-range lat/lon rejected; unknown id or `published=false` id → 404 (NOT_FOUND problem);
      response propagates shared resolver. <!-- sdd-owner: implementation -->
- [x] Implement route in `apps/api/src/routes/experiences.ts`: mount
      `experiencesRouter.post('/:id/proximity', dbGuard(), deviceIdGuard(), jwtGuard(),
rateLimit(RATE_LIMIT_DEFAULTS.PROXIMITY_CHECK), zValidator('json', ProximityBodySchema, validationHook), ...)`
      reusing existing guards per design §2. Read published experience + format/geoMode/radiusMeters,
      build `GeoFenceConfig` from `DEFAULT_REMOTE_CONFIG.geofence`, call shared `resolveProximity`,
      return `{ canListen, distanceMeters, effectiveRadiusMeters }`. Add `PROXIMITY_CHECK` budget to
      `RATE_LIMIT_DEFAULTS` (open decision: mirror EXPERIENCES_LIST unless product wants tighter). <!-- sdd-owner: implementation -->
- [x] Add `ProximityBodySchema` (lat/lon bounds) to shared schemas and wire
      `validationHook` consistent with `feedback.ts`. <!-- sdd-owner: implementation -->

### D2. Surface geo metadata on GET (GEOF.6)

- [x] RED in `apps/api/src/__tests__/experiences.test.ts`: `GET /experiences` returns every experience
      with `geoMode` and `radiusMeters` fields present (flows via `...exp` spread once columns exist). <!-- sdd-owner: implementation -->
- [x] Ensure `...exp` spread in the GET route emits `geoMode`/`radiusMeters` (new columns flow through);
      add camelCase mapping if needed (confirm from PR 1: Drizzle camelCase). Config route already spreads
      `DEFAULT_REMOTE_CONFIG` → assert `GET /config` surfaces per-format `geofence` in
      `apps/api/src/__tests__/config.test.ts` (present from PR 1, confirmed). <!-- sdd-owner: implementation -->

---

## Layer 5: Mobile hook (PR 5)

### E1. Hook refactor to shared resolver (GEOF.7)

- [x] RED in `apps/mobile/src/hooks/__tests__/use-offline-geofence.test.ts` (existing file) for the new
      signature `useOfflineGeofence(targetCoords, override)` where override =
      `{ geoMode, radiusMeters?, format }` (default `{ format:'trip', geoMode:'type' }`): precedence
      any/entity/type/bypass, fail-closed entity missing radius, inclusive boundary, `bypassGeofence=true`
      → un-gated. Update existing stores mocks to the per-format config shape. <!-- sdd-owner: implementation -->
- [x] Refactor `apps/mobile/src/hooks/use-offline-geofence.ts` to resolve via shared
      `resolveProximity` (no local haversine/precedence), reading local cached `config.geofence`
      (per-format) + the optional override; keep the public `GeofenceState` shape unchanged; optional
      online seam behind an injected `proximityClient` that fails open to the offline/local result. <!-- sdd-owner: implementation -->

### E2. Remote config consumers updated (GEOF.1/GEOF.9)

- [x] Update `apps/mobile/src/store/remote-config-store.ts`, `apps/mobile/src/config/app-config.ts`, and
      their `__tests__` (`remote-config-store.test.ts`, `app-config.test.ts`, `config-cache.test.ts`)
      to the per-format `geofence` shape while keeping deep-merge/backcompat behavior. <!-- sdd-owner: implementation -->

---

## Layer 6: Mobile views + haversine removal (PR 6)

### F1. TrackDetailView gates only when entity/type asks (GEOF.8)

- [x] RED `apps/mobile/src/__tests__/track-detail-view.test.tsx` (new): `any` track always playable (no
      banner); `entity`/`type` track far → blocked + `GeofenceBlockedBanner` + blocked alert on play;
      bypass wins (playable from anywhere). Mock `useOfflineGeofence`/stores. <!-- sdd-owner: implementation -->
- [x] Wire `apps/mobile/src/components/track-detail-view.tsx`: replace the hardcoded
      `isNearStart: true` in `useFeedbackTrigger` with `isNearStart: geofence.isNearStart` from
      `useOfflineGeofence({latitude,longitude}, { format:'track', geoMode: track.geoMode, radiusMeters: track.radiusMeters })`.
      Add `isPlaybackBlocked`/`handlePlay`/`handleDownload` + `GeofenceBlockedBanner` + blocked alert
      mirroring `TripDetailView` today (GEOF.8). `any` tracks stay un-blocked; bypass still wins. <!-- sdd-owner: implementation -->

### F2. TripDetailView keeps working (GEOF.9)

- [x] RED in `apps/mobile/src/__tests__/trip-detail-view.test.tsx`: default trip (`geoMode:'type'`,
      config `trip.radiusMeters=50`) preserves the 50 m gate with the new hook signature. Keep the
      existing tests but update the `useOfflineGeofence` mock to the override shape. <!-- sdd-owner: implementation -->
- [x] Update `apps/mobile/src/components/trip-detail-view.tsx`: pass `{ format:'trip', geoMode: track.geoMode,
radiusMeters: track.radiusMeters }` to `useOfflineGeofence` (default `'type'` preserves today). Keep
      bypass logic unchanged. <!-- sdd-owner: implementation -->

### F3. Remove duplicated haversine (design §7)

- [x] Remove internal `apps/mobile/src/utils/haversine.ts` + `apps/mobile/src/utils/__tests__/haversine.test.ts`; repoint
      `apps/mobile/src/app/(tabs)/messages.tsx` (two `getHaversineDistance` call sites) and
      `use-offline-geofence.ts` to the shared `haversineDistance` from `@sonora/shared`. Ambiguity the
      thin re-export removal per design §7. <!-- sdd-owner: implementation -->

### F4. Misnamed test fix (spec risk)

- [x] Verify no `tracks-detail` test mocks a trip; the trip test lives under
      `trip-detail-view.test.tsx` correctly naming `TripDetailView`. If a misnamed `tracks-detail`
      file is reintroduced during this branch, rename it to `trip-detail-view.test.tsx` (or
      `track-detail-view.test.tsx` appropriately). <!-- sdd-owner: implementation -->

---

### Layer 7: Integration/regression + coverage (PR 6 tail)

### G1. Full-suite regression (all layers)

- [x] Run the shared+api+mobile test suites together (see commands) and fix any fallout from the config
      shape change (README fixtures too: `DEFAULT_REMOTE_CONFIG.geofence` in any remaining `geofence`
      fixture). <!-- sdd-owner: implementation -->
- [x] Run typecheck `apps/mobile` (`tsc --noEmit`) and lint `apps/mobile` (`expo lint`; no errors in
      changed files). <!-- sdd-owner: implementation -->
- [x] Start or reuse bounded PR review of the slabs (shared module, schema, route, hook, views)
      for offenses and correctness. <!-- sdd-owner: parent -->

---

## Test commands (for apply/verify)

- Root workspace: standard root scripts.
- `apps/api` : `vitest run` (from `apps/api` / `bun vitest run`, per repo pattern).
- `packages/shared` : `bunx vitest run` (from `packages/shared`).
- `apps/mobile` : `jest --local` interactive (`jest --watchAll` for dev watch; use `--watchAll=false` in CI).
- Typecheck `apps/mobile` : `tsc --noEmit`.
- Lint `apps/mobile` : `expo lint`.
- DB migrations: `drizzle-kit generate` then apply per repo migration script (not `--no-verify`).

## Acceptance mapping (GEOF.1–GEOF.9 → tasks)

| Requirement                                                                                          | Covered by |
| ---------------------------------------------------------------------------------------------------- | ---------- |
| GEOF.1 per-format remote config + validation                                                         | B1, E2     |
| GEOF.2 shared GeoMode + experience fields                                                            | C1         |
| GEOF.3 DB `geo_mode` + `radius_meters`                                                               | C2         |
| GEOF.4 additive migration + backfill (trip→type, track→any)                                          | C3         |
| GEOF.5 seed all modes × formats + positive entity radius                                             | C4         |
| GEOF.6 API surfaces `geoMode`/`radiusMeters` + rejects invalid coords / 404 / enum / non-positive    | D1, D2     |
| GEOF.7 mobile precedence (bypass>entity>type>any), fail-closed, inclusive `distance<=radius`, no-fix | A1, A2, E1 |
| GEOF.8 TrackDetailView gates only when entity/type; any always-playable; bypass wins                 | F1         |
| GEOF.9 TripDetailView 50 m preserved via `'type'` default                                            | F2         |
| Non-goals preserved: waypoints un-touched (C2), no admin UI                                          | C2, C1     |
