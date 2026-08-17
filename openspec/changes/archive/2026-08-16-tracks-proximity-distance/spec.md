# Geofence & Proximity Listening Specification

## Purpose

Give every experience a first-class, per-entity geo listening policy. Instead of the
current binary state — derivas gated by one global radius, tracks always playable — each
experience opts into one of three geo listening modes (`any`, `type`, `entity`), and the
mobile app resolves an effective proximity radius from remote config plus entity data so
playback/feedback gating is consistent across tracks and trips.

Per-format remote config (same shape for both track and trip) and per-format fallback
radius let editors configure different distances by experience type, while a single
global bypass switch keeps working and always wins.

## Requirements

### Requirement: GEOF.1 — Per-format geofence remote config

The remote config `geofence` object MUST expose per-format geo policy using the same shape
for both formats:

```ts
geofence: {
  trip:  { radiusMeters: <int,positive>, defaultMode: 'type'   },
  track: { radiusMeters: <int,positive>, defaultMode: 'entity' },
}
```

- `trip.radiusMeters` is the type-level (fallback) radius for `geo_mode='type'` derivas,
  defaulting to `50`.
- `track.radiusMeters` is the type-level (fallback) radius for `geo_mode='type'` tracks.
- `defaultMode` is the format-level default listening mode used when no explicit
  per-entity mode is supplied. `trip.defaultMode` MUST default to `'type'`;
  `track.defaultMode` MUST default to `'entity'`.
- The existing global `bypassGeofence` boolean MUST remain present and uninterpreted by
  the geo-resolution below; it outranks every geo mode.

#### Scenario: default config supplies per-format radius and mode

- GIVEN `DEFAULT_REMOTE_CONFIG`
- THEN `geofence.trip.radiusMeters` resolves to `50`, `geofence.trip.defaultMode` to `'type'`
- AND `geofence.track.radiusMeters` is present and positive, `geofence.track.defaultMode` to `'entity'`

#### Scenario: API/remote-config payload schema validates the shape

- GIVEN a `RemoteConfigPayloadSchema` `geofence` validator
- WHEN a payload has `geofence.trip.radiusMeters <= 0` or `geofence.track.radiusMeters <= 0`
- THEN validation fails

### Requirement: GEOF.2 — GeoMode shared type & experience fields

Shared `BaseExperience` MUST expose `geoMode` and `radiusMeters`, and a `GeoMode` union
type `'any' | 'type' | 'entity'` MUST be added to the shared package.

- `geoMode` carries the entity's listening mode (`GeoMode`).
- `radiusMeters` is the entity's per-entity radius, meaningful only when `geoMode === 'entity'`.
- `Waypoint.radiusMeters` is left untouched and un-gated (non-goal).

#### Scenario: entity carries its own mode and radius

- GIVEN an `Experience` from the shared types
- THEN it exposes `geoMode: GeoMode` and `radiusMeters: number | null`

### Requirement: GEOF.3 — DB schema for `experiences.geo_mode` and `radius_meters`

The `experiences` table MUST gain:

- `geo_mode` — enum `geo_mode` with values `any | type | entity`, default `'any'`.
- `radius_meters` — nullable integer, only meaningful when `geo_mode='entity'`.

`waypoints.radius_meters` MUST remain untouched and un-gated.

#### Scenario: columns exist and default safely

- GIVEN the `experiences` table schema
- THEN `geo_mode` is a NOT-NULL enum column defaulting to `'any'`
- AND `radius_meters` is a nullable integer column

### Requirement: GEOF.4 — Additive migration with backfill

An additive Drizzle migration MUST add the `geo_mode` enum + `radius_meters` column to
`experiences`, then backfill existing rows by format:

- existing trips (`format='trip'`) → `geo_mode = 'type'` (preserves current 50 m behavior)
- existing tracks (`format='track'`) → `geo_mode = 'any'` (preserves current always-playable behavior)
- `waypoints` unaffected.

#### Scenario: trips keep 50 m gate

- GIVEN existing trip rows before the migration
- WHEN the migration runs
- THEN those rows have `geo_mode='type'` so the default remote `trip.radiusMeters` (50) applies

#### Scenario: tracks stay always-playable by default

- GIVEN existing track rows before the migration
- WHEN the migration runs
- THEN those rows have `geo_mode='any'` (no gate), matching today's behavior

### Requirement: GEOF.5 — Seed covers all three modes for both formats

The seed MUST include representative experiences so every combination of the three modes
(`any`/`type`/`entity`) exists for both track and trip formats, plus at least one row
exercising entity mode with an explicit positive radius.

#### Scenario: all mode × format combinations are seeded

- GIVEN `npm run seed` (API seed script)
- THEN the DB contains a track and a trip for each of `geo_mode` `any`, `type`, and `entity`
- AND every `entity` row has a positive `radius_meters`

### Requirement: GEOF.6 — API surfaces and validates geo metadata

Experiences routes MUST surface `geoMode` and `radiusMeters` on every experience response.
Input validation MUST reject:

- a `geo_mode` value other than exactly `any`, `type`, or `entity`; and
- a `radius_meters` that is present but not a positive integer.

`geo_mode='entity'` MUST NOT be accepted without a positive `radius_meters`.

#### Scenario: valid entity row passes

- GIVEN a row with `geo_mode='entity'` and `radius_meters=30`
- THEN the API accepts it and surfaces `geoMode='entity'`, `radiusMeters=30`

#### Scenario: invalid mode is rejected

- GIVEN a row with `geo_mode='off'` (or any value outside the enum)
- THEN the API rejects the input

#### Scenario: entity with non-positive radius is rejected

- GIVEN a row with `geo_mode='entity'` and `radius_meters=0` (or `NULL`)
- THEN the API rejects the input as invalid

### Requirement: GEOF.7 — Mobile effective-radius resolution (precedence)

`useOfflineGeofence` MUST accept an optional per-entity override
`{ geoMode, radiusMeters }` and an explicit format, and resolve the effective radius by
this precedence, highest → lowest:

1. `bypassGeofence` global (switch master) — always playable, wins over all modes.
2. `geo_mode = 'entity'` → the entity's own `radius_meters` (failure-closed if unresolved).
3. `geo_mode = 'type'` → `geofence[format].radiusMeters` (type-level fallback).
4. `geo_mode = 'any'` → no gating (always playable).

Haversine comparison MUST keep the inclusive `distance <= radius` rule. When coords are
unavailable, `isNearStart` remains `false` (blocked until a fix). When entity mode selects
an unresolved/invalid radius, resolution MUST fail closed (blocked) rather than silently
un-gate.

#### Scenario: bypass wins over all modes

- GIVEN `bypassGeofence=true`
- WHEN any `geo_mode` or format is in play
- THEN `useOfflineGeofence` reports `isNearStart=true` (un-gated)

#### Scenario: entity mode uses its own radius

- GIVEN override `{ geoMode:'entity', radiusMeters:30 }` and config `track.radiusMeters=100`
- WHEN the GPS location is 60 m from the origin
- THEN `isNearStart=false` (30 m drives the decision, not 100)

#### Scenario: entity mode fails closed on missing radius

- GIVEN `geo_mode='entity'` with `radiusMeters` unresolved/NULL
- WHEN resolving the effective radius
- THEN the outcome is blocked (not silently playable)

#### Scenario: type mode uses the format-level fallback

- GIVEN `geo_mode='type'`, format `'track'`, and `geofence.track.radiusMeters=100`
- THEN the effective radius is 100 for that decision

#### Scenario: any mode is un-gated

- GIVEN `geo_mode='any'`
- WHEN played from any distance
- THEN `isNearStart=true` at all times (matches current track behavior)

#### Scenario: haversine boundary is inclusive

- GIVEN a user exactly `radiusMeters` away from a gating experience
- THEN `distance <= radius` holds and the experience is notNearStart (`true`)

### Requirement: GEOF.8 — `TrackDetailView` gates only when its entity asks

`TrackDetailView` MUST use `useOfflineGeofence` with the track's own data and gate
playback/feedback ONLY when the track's `geo_mode` is `'entity'` or `'type'`. A track with
`geo_mode='any'` MUST remain always playable (no gate, matching today). The full-bypass
paths (`bypassGeofence`, `geofenceBypassable`) MUST continue to win over the track's mode.

#### Scenario: any track is gated (status quo preserved)

- GIVEN a track with `geo_mode='any'`
- THEN it is playable from anywhere, with no geofence blocking

#### Scenario: entity/type track is gated when far away

- GIVEN a track with `geo_mode='entity'` (radius 30) at 80 m from user
- THEN playback/feedback is blocked and `GeofenceBlockedBanner` is shown (mirroring trip UX)

#### Scenario: bypass still wins on a track

- GIVEN a track whose entity/type mode would gate
- WHEN `bypassGeofence=true`
- THEN it remains playable anywhere

### Requirement: GEOF.9 — `TripDetailView` keeps working

`TripDetailView` MUST continue using the geofence hook and gate playback as today. With
the `'type'` backfill and default config, existing trips keep the 50 m behavior with no
code change, and an explicitly entity/type/track trip behaves by the same precedence as a track.

#### Scenario: default trip stays gated at 50 m

- GIVEN a trip with `geo_mode='type'` and `geofence.trip.radiusMeters=50`
- THEN it reports the same 50 m gate as before

---

## Non-goals

- Admin UI for editing radius / geo mode (seed is the authoring mechanism).
- Waypoint-level radius or gating (`waypoints.radius_meters` untouched).
- Per-entity override via remote config map beyond the per-format shape.

### Related specs / risks

- No existing canonical geofence spec; this change creates one.
- The `'tracks-detail'` test is misnamed (it mocks a trip) — fix naming.
