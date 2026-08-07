# Design — Tracks & proximity listening (centralized shared proximity)

**Change:** `tracks-proximity-distance`
**Status:** Designed
**Artifact store:** hybrid (Engram key `sdd/tracks-proximity-distance/design` + this file)
**Inputs:** proposal.md, spec.md, finalized model (Engram obs 979)

---

## 0. Fixed architecture (user-confirmed — not reopened)

The entire proximity/geofence math AND the effective-radius precedence resolver live in a
NEW pure module in `@sonora/shared` (`packages/shared/src/geo/proximity.ts`). It is shared by:

- the backend (online authoritative `POST /experiences/:id/proximity`), and
- the frontend offline fallback (`useOfflineGeofence`).

**Two-tier resolution:**

- **ONLINE:** the client sends its lat/lon + experience id to the backend endpoint; the
  backend computes with the SAME shared function and its fresh config and returns
  `{ canListen, distanceMeters, effectiveRadiusMeters }` (authoritative).
- **OFFLINE** — experience already downloaded, no network: `useOfflineGeofence` uses the SAME
  shared function with locally cached config + entity geo fields. Same math, no duplication.

**Fail-open vs fail-closed rule:** if the online endpoint ERRORS (not a decision), the client
fails open to the offline/local path (user preference). But within a single resolution, an
unresolved ENTITY radius (`geo_mode='entity'` with NULL/invalid `radius_meters`) FAILS CLOSED
(blocked) — never silently un-gated.

**Precedence (confirmed):**

1. `bypassGeofence` (global switch) — wins regardless of mode, always playable.
2. `geo_mode='entity'` → `experiences.radius_meters` (fail-closed if unresolved/invalid).
3. `geo_mode='type'` → `geofence[format].radiusMeters`.
4. `geo_mode='any'` → no gating.

---

## 1. Module layout — shared proximity module

### 1.1 New file: `packages/shared/src/geo/proximity.ts` (pure TS)

No React/RN deps — only `zod` type-only + `Math`. This is the single source of truth for
proximity math and effective-radius precedence, reused by both `apps/api` and `apps/mobile`.

Zod runtime schemas for config/entities STAY in `packages/shared/src/schemas/`. This module
imports only **types** (`GeoMode`, the geofence config shape) and exports pure functions.

### 1.2 Exported surface (stub signatures)

```ts
// packages/shared/src/geo/proximity.ts
import type { UserExperienceFormat } from '../experiences';

export const GEO_MODES = ['any', 'type', 'entity'] as const;
export type GeoMode = (typeof GEO_MODES)[number];

/** Per-format geofence block (same shape for trip & track). */
export interface GeoFormatGeoFence {
  radiusMeters: number; // type-level fallback, positive
  defaultMode: GeoMode; // format-level default listening mode
}

export interface GeoFenceConfig {
  trip: GeoFormatGeoFence;
  track: GeoFormatGeoFence;
  bypassGeofence: boolean; // global master switch, wins over all modes
}

/** Coordinates input (pure, not RN-expo-location). */
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface ListenRadiusInput {
  format: UserExperienceFormat; // 'trip' | 'track'
  geoMode?: GeoMode; // optional; falls back to geofence[format].defaultMode
  radiusMeters?: number | null; // entity radius, meaningful only when entity mode
  bypassGeofence: boolean;
  geofence: GeoFenceConfig;
}

export type RadiusResolution =
  | { status: 'unrestricted'; reason: 'bypass' | 'any' }
  | { status: 'gated'; radiusMeters: number; mode: 'entity' | 'type' }
  | { status: 'blocked'; reason: 'invalid-radius' };

/** Pure precedence resolver — the single source of truth for effective radius. */
export function resolveListenRadius(input: ResolveListenRadiusInput): RadiusResolution;

export interface ProximityDecisionInput extends ResolveListenRadiusInput {
  user: { latitude: number; longitude: number } | null;
  origin: { latitude: number; longitude: number };
}

export interface ProximityDecision {
  canListen: boolean;
  distanceMeters: number | null;
  effectiveRadiusMeters: number | null;
  resolution: 'allowed' | 'blocked' | 'bypass' | 'unrestricted' | 'no-fix';
}

/** Top-level: resolve radius + distance + inclusive boundary in one call. */
export function resolveProximity(input: ProximityDecisionInput): ProximityDecision;

/** Moved from apps/mobile/src/utils/haversine.ts — see §6. */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number;
```

### 1.3 Resolver semantics (matches GEOF.7 precedence + edge cases)

```text
resolveListenRadius(input):
  mode = input.geoMode ?? input.geofence[input.format].defaultMode
  1. if input.bypassGeofence            -> { status:'unrestricted', reason:'bypass' }
     mode=='any'                       -> { status:'unrestricted', reason:'any' }
  2. if mode == 'entity':
       if !(radiusMeters > 0)          -> { status:'blocked', reason:'invalid-ge' }  // fail-closed
       else                            -> { status:'gated', radiusMeters, mode:'entity' }
  3. if mode == 'type'                 -> { status:'gated',
                                            radiusMeters: geofence[format].radiusMeters,
                                            mode:'type' }
  4. fallback (defensive)              -> { status:'unrestricted', reason:'any' }

resolveProximity(input):
  r = resolveListenRadius(input)
  if r.status == 'unrestricted':
    return { canListen:true, distanceMeters:null, effectiveRadiusMeters:null, resolution: r.reason==='bypass'?'bypass':'unrestricted' }
  if r.status == 'blocked':
    return { canListen:false, distanceMeters:null, effectiveRadiusMeters:null, resolution:'blocked' }
  if input.user == null:
    return { canListen:false, distanceMeters:null, effectiveRadiusMeters:r.radiusMeters, resolution:'no-fix' }
  distance = haversineDistance(...)
  return { canListen: distance <= r.radiusMeters,  // inclusive boundary (GEOF.7)
           distanceMeters: distance,
           effectiveRadiusMeters: r.radiusMeters,
           resolution: distance <= r.radiusMeters ? 'allowed' : 'blocked' }
```

- **Inclusive rule kept:** `distance <= radius` (matches today's hook).
- **`bypass` wins over any mode**, including a presumably-invalid entity radius (it short-circuits
  before fail-closed check) — matches "bypass outranks all".

### 1.4 Index export

Add `export * from './geo/proximity';` to `packages/shared/src/index.ts`.

---

## 2. Backend endpoint — online authoritative

### 2.1 Route

- **File:** `apps/api/src/routes/experiences.ts` (existing `experiencesRouter`; also mount not
  needed — registered via `app.route('/experiences', experiencesRouter)` in `index.ts`).
- **Path:** `POST /experiences/:id/proximity`
- **Method:** POST (client supplies the user's coordinates in the body; id in path).
- **Minimal request body:**

```ts
z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
```

- **Response shape (online authoritative), exactly:**

```json
{ "canListen": true, "distanceMeters": 40, "effectiveRadiusMeters": 50 }
```

(No radius canListen-only; the client's offline fallback must be able to replicate, so we
always return all three.)

- **Validation:** `zValidator('json', schema, validationHook)` — same pattern as the feedback
  route (`apps/api/src/routes/feedback.ts`). Reject out-of-range lat/lon.

### 2.2 Config & DB it reads

- **DB:** `experiences` by `:id` (must be `published === true`). Reads `format`,
  `geo_mode`, `radius_meters`, `latitude`, `longitude`. Reuses the shared resolver.
- **Config:** the backend's own config. Today config is env-derived and the route returns
  `DEFAULT_REMOTE_CONFIG` (`apps/api/src/routes/config.ts`). The endpoint builds its
  `GeoFenceConfig` from the same `DEFAULT_REMOTE_CONFIG.geofence` (extended to per-format
  `{ trip, track, bypassGeofence }`) so back and front resolve identically. `bypassGeofence`
  reflects the same global switch.

### 2.3 How it uses the shared module

```ts
experiencesRouter.post(
  '/:id/proximity',
  dbGuard(), deviceIdGuard(), jwtGuard(), rateLimit(RATE_LIMIT_DEFAULTS...),
  zValidator('json', ProximityBodySchema, validationHook),
  async (c) => {
    const db = c.var.db;
    const id = c.req.param('id');
    const exp = await db.select().from(experiences).where(and(eq(experiences.id, id), eq(experiences.published, true)));
    if (!exp) return problem(c, ERRORS.NOT_FOUND, 'Experience not found');

    const { latitude, longitude } = c.req.valid('json');
    const geo = resolveProximity({
      user: { latitude, longitude },
      origin: { latitude: exp.latitude, longitude: exp.longitude },
      format: exp.format,
      geoMode: exp.geoMode,
      radiusMeters: exp.radiusMeters,
      bypassGeofence: DEFAULT_REMOTE_CONFIG.geofence.bypassGeofence,
      geofence: DEFAULT_REMOTE_CONFIG.geofence,
    });
    return success(c, { canListen: geo.canListen, distanceMeters: geo.distanceMeters, effectiveRadiusMeters: geo.effectiveRadiusMeters });
  },
);
```

### 2.4 Auth / privacy / throttling

- **Auth:** reuse the existing guards (`dbGuard`, `deviceIdGuard`, `jwtGuard`, `rateLimit`) used
  by `GET /experiences`. No new auth model.
- **Privacy (user coords):** sending lat/lon is OPTIONAL and gated by an explicit in-app
  consent/permission prompt. The endpoint is only called when the user has granted location
  permission (the same `requestForegroundPermissionsAsync` already used by `location-store.ts`).
  If permission is not granted, the client never calls the online path and relies on the
  offline/local path with `user = null` → `no-fix`/blocked. The body is minimal (coords only);
  no device id is sent beyond the existing `deviceId` header.
- **Throttling:** reuse `RATE_LIMIT_DEFAULTS.*`, following the existing per-route limit
  pattern. `canListen` re-check happens on play + a light refresh on the detail screen (e.g.
  debounced when user coords change, `distanceInterval: 5` from `location-store` already
  produces deltas). No per-tick polling; cheap and bounded.
- **Optional/auth-driven:** the endpoint is optional at the client level — it is the ONLINE
  path; if it errors, the client fails open to the offline cache (see §3). It is not required
  for offline parity.

---

## 3. Mobile hook refactor — `useOfflineGeofence`

### 3.1 What changes

Keep the same public `GeofenceState` shape so `TripDetailView`/`TrackDetailView` wire-up is
minimal. New internal behaviour:

1. Accept an optional per-entity override `{ geoMode, radiusMeters }` and a `format`
   (defaults `format='trip'`, `geoMode='type'` → today's behaviour preserved).
2. Build `GeoFenceConfig` from the **locally cached remote config** (`useRemoteConfigStore`),
   which already re-fetches + re-caches on `refetch`/`init` (`setCachedConfig`) — reuse that
   to refresh the local config when back online.
3. Call the shared `resolveProximity` (pure) — NOT a duplicated haversine/precedence.
4. **Online path (optional):** if online, best-effort call `POST /experiences/:id/proximity`
   with user coords; if it succeeds use the authoritative result; if it fails, **fail open**
   to the offline/local-cache result.

### 3.2 Stub signatures

```ts
// apps/mobile/src/hooks/use-offline-geofence.ts
import { resolveProximity, type GeoMode } from '@sonora/shared';
import { useRemoteConfigStore, type ProximityConfig } from ...;

export interface GeofenceOverride {
  geoMode: GeoMode;
  radiusMeters?: number | null;
  format: 'trip' | 'track';
}

export interface GeofenceState { /* unchanged shape as today */ }

export function useOfflineGeofence(
  targetCoords: { latitude: number; longitude: number } | null,
  override: GeofenceOverride = { format: 'trip', geoMode: 'type' },  // preserves today's trip 50m
): GeofenceState {
  const { config } = useRemoteConfigStore();
  const { coords, accuracy, status, errorMsg } = useLocationStore();

  const geo = resolveProximity({
    user: coords,
    origin: targetCoords,
    format: override.format,
    geoMode: override.geoMode,
    radiusMeters: override.radiusMeters,
    bypassGeofence: config.geofence.bypassGeofence,
    geofence: config.geofence, // per-format now
  });

  return {
    isNearStart: geo.canListen,
    gpsAccuracy: accuracy,
    gpsStatus: status,
    distanceMeters: geo.distanceMeters,
    requiredRadiusMeters: geo.effectiveRadiusMeters ?? 0,
    userCoordinates: coords,
    errorMsg,
  };
}
```

### 3.3 Injection seams (testable)

- The hook reads `config` and `coords` from the stores, but the pure decision is computed in
  `resolveProximity(...)` which is fully unit-testable. Component tests inject
  `targetCoords`/`override`/store config to drive all GEOF.7–GEOF.9 cases.
- Optional **online seam:** gate the endpoint call behind an injected
  `proximityClient` (default `ApiClient` POST). In tests, stub it to `resolve`
  to `{ ok: false }` (fall back to offline) or `{ ok:true, canListen:... }`. Do NOT make
  proximity resolution depend on the online path for correctness.

### 3.4 Consumers

- **`TrackDetailView`** (`track-detail-view.tsx`): replace the hardcoded
  `isNearStart: useFeedbackTrigger(…{ isNearStart: true })` and use
  `useOfflineGeofence({ latitude, longitude }, { format:'track', geoMode: track.geoMode, radiusMeters: track.radiusMeters })`.
  Gate feedback/playback **only when entity/type asks**; `any` stays always-playable; bypass
  still wins (GEOF.8). Add the same `GeofenceBlockedBanner` + `isPlaybackBlocked`/`handlePlay`
  gating that `TripDetailView` has today.
- **`TripDetailView`** (`trip-detail-view.tsx`): keep the hook call; now pass
  `{ format:'trip', geoMode: track.geoMode, radiusMeters: track.radiusMeters }`. Default
  `'type'` + config `trip.radiusMeters=50` preserves today's 50 m gate with no code change
  (GEOF.9). Existing bypass logic (`isBypassable`, `useRemoteConfigStore` bypass) unchanged.

---

## 4. DB/experience fields surface

| Layer                   | Field                                               | Type                                                          | Notes                                                     |
| ----------------------- | --------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| DB `experiences`        | `geoMode` (`geo_mode`)                              | enum `geo_mode` `any\|type\|entity`, NOT NULL default `'any'` | `apps/api/src/db/schema.ts` new `experienceGeoModeEnum`   |
| DB `experiences`        | `radiusMeters` (`radius_meters`)                    | integer, nullable                                             | only meaningful when `geo_mode='entity'`; validated `> 0` |
| schema enum             | `GEO_MODES`                                         | `['any','type','entity']` as const                            | source of truth in `schemas/geo` or re-exported           |
| Shared `BaseExperience` | `geoMode: GeoMode` + `radiusMeters: number \| null` | added to `packages/shared/src/experiences.ts`                 | sourced via `...exp` from API                             |

- `Waypoint.radiusMeters` untouched & un-gated (non-goal).
- The DB `Experience['geoMode']` maps to the shared `GeoMode` after the route expands
  `...exp` (already does via `...exp` spread — the extra columns flow through automatically
  once present; new camelCase mapping handled by a small mapper or Drizzle alias).

---

## 5. Remote-config shape change

Extend `DEFAULT_REMOTE_CONFIG` + `RemoteConfigPayloadSchema.geofence` in
`packages/shared/src/schemas/config.ts` from:

```ts
geofence: { radiusMeters: 50, bypassGeofence: false }
```

to the per-format block (both formats identical shape):

```ts
geofence: {
  trip:  { radiusMeters: 50,   defaultMode: 'type'   },
  track: { radiusMeters: 50,   defaultMode: 'entity' },
  bypassGeofence: false,
}
```

`apps/api/src/routes/config.ts` already spread-and-returns `DEFAULT_REMOTE_CONFIG`,
so it surfaces the new shape unchanged. `remote-config-store.ts` deep-merge in
`loadConfig` already overlays nested objects (config-cache merge handles nested `geofence`),
so per-format defaults survive partial cached payloads. Old clients ignore new fields;
new clients read the per-format block (additive, non-breaking).

---

## 6. Migration & seed

### 5.1 Additive Drizzle migration (GEOF.4)

`apps/api/src/db/schema.ts`:

```ts
export const experienceGeoModeEnum = sonoraSchema.enum('geo_mode', [...GEO_MODES]);

export const experiences = sonoraSchema.table('experiences', {
  // ...existing columns,
  geoMode: experienceGeoModeEnum('geo_mode').default('any').notNull(),
  radiusMeters: integer('radius_meters'),
});
```

Generate with `drizzle-kit generate` (dialect postgresql, out `./migrations`), then the SQL:

```sql
ALTER TABLE sonora.experiences ADD COLUMN geo_mode sonora.geo_mode NOT NULL DEFAULT 'any';
ALTER TABLE sonora.experiences ADD COLUMN radius_meters integer;
UPDATE sonora.experiences SET geo_mode = 'type'  WHERE format = 'trip';
UPDATE sonora.experiences SET geo_mode = 'any'   WHERE format = 'track';
```

- Backfill is **mandatory** & **validated** (address `EXISTS`/XCT asserts: count trips =
  count trips with `geo_mode='type'`; tracks every `geo_mode='any'`; no NULL `geo_mode`).
- Reversible (drop columns + enum; no `waypoint` impact).

### 5.2 Seed (GEOF 5)

`apps/api/src/db/seed.ts`: add representative experiences covering **every mode × format**
(any/type/entity × track/trip) + at least one `entity` row with positive `radius_meters`.
Every entity row must carry a positive radius; any `geofenceBypassable` rows stay set.

---

## 7. Removed duplicated haversine

`apps/mobile/src/utils/haversine.ts` duplicates the same geodetic function that now lives in
`@sonora/shared`. **Migration:**

1. `haversineDistance` implemented ONCE in `packages/shared/src/geo/proximity.ts` (see §1).
2. Update importers to the shared export:
   - `apps/mobile/src/hooks/use-offline-geofence.ts` → `import { resolveProximity } from '@sonora/shared'` (no direct haversine).
   - `apps/mobile/src/app/(tabs)/messages.tsx` → `import { haversineDistance } from '@sonora/shared'`.
3. Keep a thin re-export `export { haversineDistance } from '@sonora/shared';` in
   `apps/mobile/src/utils/haversine.ts` for a period IF any external consumer exists — but the
   plan is to fully remove the file and its `__tests__/haversine.test.ts` (its cases move to
   shared under `packages/shared` vitest). The duplicate logic is removed, not kept.

---

## 8. Testing strategy (mapping GEOF.1–GEOF.9)

**Shared unit tests** — `packages/shared` (vitest), new `src/geo/proximity.test.ts`
(+ migrated haversine cases in `src/geo/haversine.test.ts`):

- `resolveListenRadius` precedence: `bypass` > `entity` > `type` > `any` (GEOF.7).
- `entity` with NULL/non-positive radius → `blocked` (fail-closed) (GEOF.7).
- `type` uses `geofence[format].radiusMeters` (trip vs track) (GEOF.7).
- `any` → unrestricted (GEOF.7).
- Inclusive boundary `distance <= radius` (GEOF.7).
- `resolveProximity` with `user=null` → `no-fix`/blocked; `user` present computes distance.
- `haversineDistance(0-case + known pair)` migrated from mobile test (removed duplicate).

**Shared config schema tests** — `packages/shared/src/schemas/__tests__/config.test.ts`:

- per-format geofence shape, defaults (trip 50/'type', track present/'entity'), bypass present (GEOF.1).
- `radiusMeters <= 0` fails schema validation (GEOF.1).

**API route tests** — `apps (api)`:

- `POST /experiences/:id/proximity` returns `{ canListen, distanceMeters, effectiveRadiusMeters }`;
  uses shared resolver (GEOF.6 + end-to-end).
- invalid coords rejected; unknown/non-public id → 404 (GEOF.6 edge).
- `GET /experiences` surfaces `geoMode` + `radiusMeters` (GEOF.6).
- input validation: invalid `geo_mode` rejected; `entity` with non-positive/missing
  `radius_meters` rejected (GEOF.6).

**Mobile hook/component tests** (`apps/mobile`):

- `use-offline-geofence.test.ts`: precedonce /entity/type/any/bypass /fail-closed /
  inclusive boundary via the shared resolver with store config + override (GEOF.7).
- `track-detail-view.test.tsx`: any track always-playable (GEOF.8); entity/type far → blocked +
  `GeofenceBlockedBanner`; bypass wins.
- `trip-detail-view.test.tsx`: default trip → 50 m gate preserved (GEOF.9).
- **Fix naming:** the test named `'tracks-detail'` actually mocks a trip — rename to e.g.
  `'trip-detail ...'` (spec risk).

---

## 9. Risks

- **Config divergence backend vs front** — mitigated by both invoking the SAME
  `@sonora/shared` resolver; the online endpoint is authoritative, offline is a cache-bound
  replica.
- **Fail-open privacy leak if endpoint logs coords:** coords in body are transient, kept only
  in-memory, never stored; existing device-jwt + rate limit apply.
- **`defaultMode` vs DB backfill tension** (`track.defaultMode='entity'` while columns default
  `'any'`): clarified — `defaultMode` is the authoring/fallback default when no explicit mode
  is present; the migration backfills explicitly to preserve status quo. Resolver uses
  `geoMode ?? defaultMode`.
- **Migration backfill missed** would silently un-gate trips → validated with row-count asserts.
- **Entity forgot radius** → fail-closed to blocked (safer than silent unfence).

---

## 10. Open decisions to close in apply

- Exact `RATE_LIMIT_DEFAULTS.*` budget for the proximity endpoint (mirror existing
  experiences list budget unless product wants tighter).
- Whether the online endpoint is gated behind permission opt-in at the client (yes per §2.4)
  — no backend change needed; only the client stops calling it when permission is off.

---

## 11. Non-goals (unchanged from spec)

Admin UI for editing radius; waypoint-level radius/gating; per-format map beyond the shape.
