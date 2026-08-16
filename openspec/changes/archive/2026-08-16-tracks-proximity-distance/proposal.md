# Proposal — Tracks & proximity listening (geo listening modes)

**Change:** `tracks-proximity-distance`
**Status:** Proposed (approved scope — proposal question round already held)
**Artifact store:** hybrid (Engram topic key `sdd/tracks-proximity-distance/proposal`)

---

## 1. Intent

Give every experience a first-class, per-entity listening location policy instead of the
current binary state (derivas gated by a single global 50 m geofence; tracks always
playable with no geo gate).

Concretely this change:

1. Introduces a shared concept of **three geo listening modes** per experience:
   `any`, `type`, `entity`.
2. Adds the columns needed on the `experiences` table: `geo_mode` (enum) and
   `radius_meters` (nullable integer).
3. Adds a per-experience-type remote-config fallback radius so the `type` mode can
   use a different radius for tracks than the existing 50 m used for derivas.
4. Makes the mobile geofence hook resolve the **effective radius** from the
   experience's own data, and wires `TrackDetailView` to it (tracks stop being
   unconditionally always-playable **only when** their own entity asks for gating).
5. Preserves today's behavior for existing rows by construction (tracks default to
   `any`; derivas default to `type` → 50 m).

This is product-driven: tracks should support proximity-based listening at a
configurable distance, and each experience should be able to opt into one of three
listening states without duplicating geofence logic.

---

## 2. Current-state gap

- **Tracks** (`format: 'track'`, `TrackDetailView`) have **no** geofence gate today.
  `isNearStart` is hardcoded to `true` in the feedback wiring, so a track is always
  playable from anywhere. There is no way to gate a track by proximity.
- **Derivas / trips** (`format: 'trip'`, `TripDetailView`) are gated by a **single
  global 50 m radius** from remote config (`geofence.radiusMeters`, default 50 m).
  There is no per-entity override and no per-type override: editing a single
  experience's radius is impossible without editing the global config (which affects
  every derivas/trip).
- The gap: the system cannot express **“this track/experience plays only near its
  origin”** at a configurable distance, nor can a specific experience override its
  type's radius.

---

## 3. Target users & situations

| Persona / situation                                                                    | Today                                                         | After                                                                                                                  |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Content editor wanting a **track** to only play near its origin point                  | Impossible — tracks are always playable                       | Sets `geo_mode = entity` (and radius) or `type` on the track; playback gated                                           |
| Editor wanting **different radii by experience type** (e.g. tracks 30 m, derivas 50 m) | Impossible — one global radius for all trips, none for tracks | Remote config exposes a per-format geofence block `geofence.trip` / `geofence.track`, each with its own `radiusMeters` |
| Editor wanting to **override one experience's radius**                                 | Impossible                                                    | Sets `geo_mode = entity` + `radius_meters`                                                                             |
| Editor wanting a track/experience playable **anywhere** (current track behavior)       | Implicit tracks default                                       | Explicit `geo: any`, migration-safe default                                                                            |
| Existing trips users                                                                   | 50 m gate                                                     | Unchanged by default (`type` → 50 m)                                                                                   |

---

## 4. Business rules

### 4.1 The three geo listening modes (per experience)

Each experience carries exactly one of three modes:

1. **`any`** — listen from anywhere; no geo restriction. Preserves current tracks
   behavior and is the **migration-safe default** for existing rows.
2. **`type`** — use the experience-type-level radius from remote config as the
   effective radius. For derivas/trips this is `geofence.trip.radiusMeters` (50 m, today);
   for tracks it is `geofence.track.radiusMeters`. This is the default for
   existing derivas so today's 50 m behavior is preserved.
3. **`entity`** — use this experience's own `radius_meters` (DB column), overriding
   the type-level radius.

### 4.2 Effective-radius resolution (precedence)

```
geo_mode == 'any'    -> unrestricted playback (NOT gated)
geo_mode == 'type'   -> effectiveRadius = typeFallback(format)
                             'trip'  -> geofence.trip.radiusMeters   (default 50)
                             'track' -> geofence.track.radiusMeters
geo_mode == 'entity' -> effectiveRadius = experience.radius_meters (required, > 0)
```

- Precedence: **`entity` > `type` > config default.**
- `bypassGeofence` (global switch) wins over **all** geo modes.
- `radius_meters` is only meaningful when `geo_mode = 'entity'`. In any other mode it
  is ignored by the client.
- `geo_mode = 'entity'` with a `NULL` or invalid `radius_meters` is a **validation
  error** (see Edge cases) rather than a silent fallback, to avoid surprising
  always-blocked or always-available behavior.

### 4.3 Remote-config shape (decision)

**Chosen shape:** a per-format geofence block, identical for both formats:

```ts
geofence: {
  trip:  { radiusMeters: number, defaultMode: 'type'   },
  track: { radiusMeters: number, defaultMode: 'entity' },
  bypassGeofence: boolean,
}
```

_Justification:_ `tracks` and `trips` share the same shape, each format defines its
own `radiusMeters` and `defaultMode`, and there are no loose sibling keys
(rejected `tracksRadiusMeters` / existing fragile `radiusMeters` meaning). Every
format explicitly declares its geofence params, and the effective radius reads
`geofence[format].radiusMeters`. Keeps the existing 50 m default under
`geofence.trip` for backward compatibility. `defaultMode` sets the authoring default
for a type (trips→`type`, tracks→`entity`) and is independent of the DB backfill
which preserves status quo for existing rows.

### 5.1 DB model (decision)

Columns **on the `experiences` table** (not `waypoints` — `waypoints.radius_meters`
stays untouched and un-gated):

| Column          | Type                                                         | Notes                                                     |
| --------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| `geo_mode`      | enum `geo_mode` (`any` / `type` / `entity`), default `'any'` | Migration-safe default                                    |
| `radius_meters` | integer, nullable                                            | Only meaningful when `geo_mode='entity'`; validated `> 0` |

---

## 5. Product outcome

After this change:

- A track can be configured to play only within its own radius (`entity`) or within a
  tracks-wide radius (`type`), or from anywhere (`any`).
- A deriva/trip keeps its current 50-m behavior by default, and can opt into a
  per-route entity radius.
- The API surfaces `geoMode` + `radiusMeters` on every experience, validated.
- The mobile app computes the effective radius once from config + entity data and
  gates playback / feedback accordingly and consistently for tracks and trips.

---

## 6. Current-state → target mapping (affected areas)

| Area                | File(s)                                                                    | Change                                                                                                                                                   |
| ------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared schemas      | `packages/shared/src/schemas/config.ts`                                    | Add per-format geofence block `geofence.trip` / `geofence.track`, each `{ radiusMeters, defaultMode }` + default                                         |
| Shared types        | `packages/shared/src/experiences.ts`                                       | `BaseExperience` exposes `geoMode` + `radiusMeters`; add `GeoMode` type + enum                                                                           |
| DB schema           | `apps/api/src/db/schema.ts`                                                | Add `experienceGeoModeEnum` + `experiences.geo_mode` (default `'any'`) + `experiences.radius_meters` (nullable)                                          |
| DB migration        | `apps/api/.../migrations/<new>`                                            | Additive migration; backfill existing rows (tracks→`any`, trips→`type`)                                                                                  |
| Seed                | `apps/api/src/db/seed.ts`                                                  | Representative rows covering all three states for both formats                                                                                           |
| API routes          | `apps/api/src/routes/experiences.ts`                                       | Surface `geoMode`/`radiusMeters` (via `...exp`), add input validation where rows are created                                                             |
| Mobile hook         | `apps/mobile/src/hooks/use-offline-geofence.ts`                            | Accept optional per-entity override `{ geoMode, radiusMeters }`; resolve effective radius                                                                |
| Mobile detail views | `apps/mobile/src/components/track-detail-view.tsx`, `trip-detail-view.tsx` | TrackDetailView uses the hook with the track's own data (stops being always-playable only when the entity asks for gating); TripDetailView keeps working |
| Tests               | `apps/api/__tests__`, `apps/mobile` tests                                  | New/updated for the 3 modes + precedence + validation                                                                                                    |

---

## 7. Implications & impact

- **DB migration:** additive `geo_mode` (default `'any'`) + nullable `radius_meters`.
  Existing derivas must be backfilled to `'type'` to keep the current 50-m behavior
  (otherwise default `'any'` would silently un-gate all existing trips). Existing
  tracks default to `'any'`, which is exactly their current behavior.
- **API:** experience objects now carry two extra fields. Existing clients ignore
  unknown fields; no breaking contract change. Validation rejects invalid `geo_mode`
  and non-positive `radius_meters`.
- **Mobile:** `useOfflineGeofence` becomes slightly more complex (effective-radius
  resolution) but stays the single source of truth. `TrackDetailView` needs the new
  driving of the hook; it should NOT regress to always-playable for `any` tracks.
- **Existing 50-m derivas behavior preserved** by the `'type'` backfill + default
  config radius 50.
- **Admin tooling:** no dedicated UI in scope (see Non-goals). Content ops edit
  directly in DB for now.

---

## 8. Edge cases

| Case                                                  | Behavior                                                                                                                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `geo_mode='entity'` but `radius_meters` is `NULL`     | Validation error; the row must not be published as `"entity"` without a radius. Client treats unresolved as blocked (fail-closed) if it somehow receives it.            |
| `radius_meters` `<= 0` or negative                    | Rejected by API validation (must be `> 0`). Seed/migration must not introduce these.                                                                                    |
| Weak GPS / no fix                                     | `useOfflineGeofence` already returns `isNearStart: false` when coords are `null`; treat as unavailable → blocked until a fix. GPS accuracy surfaced via existing badge. |
| Haversine boundary (user exactly `radiusMeters` away) | Consistent with current behavior: use `distance <= radius` (inclusive boundary), same rule as today.                                                                    |
| `bypassGeofence` / `geofenceBypassable`               | These existing bypass paths must continue to work regardless of mode (i.e. `bypass` wins over any geo mode).                                                            |
| Track with `geo_mode:'any'`                           | Must remain always playable (current behavior) — do not gate.                                                                                                           |
| Existing trip rows before backfill                    | Must resume as `'type'` (50 m) — backfill is mandatory and validated in the migration.                                                                                  |
| Rate of change far from origin in `'entity'`/`'type'` | Blocked banner + blocked alert, mirroring the current trip UX.                                                                                                          |
| Migration schema drift                                | Additive migration only; no destructive change to existing columns.                                                                                                     |

---

## 9. First-slice scope boundaries (in scope)

- `experiences` columns + enum + migration + seed.
- Remote-config per-format geofence (`geofence.trip`/`geofence.track` + `radiusMeters`/`defaultMode`); schema + API config surface.
- `BaseExperience.geoMode`/`radiusMeters` + shared `GeoMode`.
- API surfacing + validation for new fields.
- `useOfflineGeofence` effective-radius resolution + per-entity override.
- `TrackDetailView` wiring (gates only when entity/type asks).
- `TripDetailView` continues working (default `'type'` → 50 m).
- Tests covering all three modes, precedence, and validation.

## 10. Non-goals

- **Admin UI for editing radius** is out of the first slice (unless trivial to reuse
  an existing admin entrypoint — probably not present; seeding is the mechanism).
- Refactoring `waypoints` radius or adding waypoint-level gating.
- Introducing new remote-config shape with `radiusMetersPerFormat` map.
- Per-user/per-location overrides beyond geo mode/radius.
- New UI copy/translation for a possibly new "located track" banner unless the
  existing `GeofenceBlockedBanner` already fits (reuse it).
- Any payment/pricing changes.

---

## 12. Constraints

- Single global `bypassGeofence` switch keeps working and outranks all geo modes.
- Backward compatibility of the API payload (new fields additive, ignored by old
  clients).
- Strict TDD Mode is active for this repo: changes are written RED → GREEN per
  behavior.
- No changes to product pricing, access model, or purchase logic.

---

## 13. Business tradeoffs

- **Default `'any'` for tracks preserves status quo** (no surprise regression) but
  means tracks don't start benefiting from proximity until their rows are authored
  (`'type'`/`'entity'`); acceptance should confirm the seeded track that demonstrates
  gating.
- **Default `'type'` for existing trips** protects the current 50-m behavior; migrating
  them to `'any'` would be a behavioral change and is intentionally not chosen.
- Choosing a per-format block (`geofence.trip`/`geofence.track`) over loose sibling keys normalizes naming; one source per format.
- Failing closed on invalid `entity` radius (blocking rather than fallback) avoids
  silently exposing a located experience but risks blocking a misconfigured content.
  Deemed safer than silent unfencing.

---

## 14. Success criteria

- Existing trips keep the current 50-m gate after migration (no behavior change at
  default).
- Existing tracks remain always-playable by default (`'any'`).
- A track seeded `'entity'` (or `'type'`) is gated by its effective radius; outside
  it, playback is blocked with the existing `GeofenceBlockedBanner` UX.
- A track seeded `'any'` plays from anywhere.
- API accepts only valid `geo_mode` and positive `radius_meters`.
- Unit/contract tests cover all four precedence cases (`any`, `type`-trip,
  `type`-track, `entity`) plus edge cases.

---

## 15. Rollback

- **Migration:** additive columns are reversible (drop `radius_meters`,
  `geo_mode`, plus the enum) without affecting `waypoints`. Backfill of existing
  rows can be reverted.
- **Remote config:** remove/ignore the per-format `geofence.trip`/`geofence.track` blocks; client falls back to a config density. Old client/API compatibility preserved.
- **Client:** because the shared client ignores unknown fields, a bad rollout can be
  reverted by restoring old build without DB-affecting the API.
