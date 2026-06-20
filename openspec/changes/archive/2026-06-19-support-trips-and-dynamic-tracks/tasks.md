# Tasks: Support Trips and Dynamic Tracks

## Review Workload Forecast

| Field                   | Value                                    |
| ----------------------- | ---------------------------------------- |
| Estimated changed lines | 600-800 lines                            |
| 400-line budget risk    | High                                     |
| Chained PRs recommended | Yes                                      |
| Suggested split         | PR 1 (Backend/Schema) -> PR 2 (Frontend) |
| Delivery strategy       | ask-on-risk                              |
| Chain strategy          | size-exception                           |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: size-exception
400-line budget risk: High

### Suggested Work Units

| Unit | Goal                                                                   | Likely PR | Notes                                                             |
| ---- | ---------------------------------------------------------------------- | --------- | ----------------------------------------------------------------- |
| 1    | Database schemas, migrations, seed, and shared types.                  | PR 1      | Base branch: main. Includes schema definitions and seeding tests. |
| 2    | Mobile UI list filters, detail view geofencing and waypoint rendering. | PR 2      | Base branch: PR 1 branch.                                         |

## Phase 1: Backend & Schema Foundation (PR 1)

- [x] 1.1 Modify `apps/api/src/db/schema.ts` to define `categories`, `experiences`, and `waypoints` tables; drop `tracks` table.
- [x] 1.2 Generate Drizzle migrations and verify schema generation.
- [x] 1.3 Update `apps/api/src/db/seed.ts` with mock data for dynamic categories, experiences, and waypoints.
- [x] 1.4 Redefine shared types in `packages/shared/src/tracks.ts` matching the new database models.

## Phase 2: Mobile UI & Playback Logic (PR 2)

- [x] 2.1 Refactor `apps/mobile/src/data/tracks.ts` to fetch categories and experiences dynamically.
- [x] 2.2 Add category chips carousel and a filter for content type (Track / Trip) in `apps/mobile/src/app/(tabs)/tracks.tsx`.
- [x] 2.3 Update `apps/mobile/src/components/track-detail-view.tsx` to conditionally restrict playback for trips based on start geofence.
- [x] 2.4 Render path/waypoints on the map in `apps/mobile/src/components/track-detail-view.tsx` if content is a trip.

## Phase 3: Testing & Validation

- [x] 3.1 Verify geofencing PlaybackRestriction scenarios in mobile tests.
- [x] 3.2 Verify SearchAndFilter type-toggle scenarios in mobile tests.
