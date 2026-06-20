# Proposal: Support Trips and Dynamic Tracks

## Intent

Refactor the database schema and mobile frontend to support both standalone audio tracks (playable anywhere, recorded at a specific GPS coordinate/timestamp) and interactive trips (requires user to be at start coordinates to begin, tracks user progress along dynamic checkpoints). This proposal also makes categories dynamic and establishes a flexible "Content" model that can accommodate new experience types in the future.

## Scope

### In Scope

- **Dynamic Categories Table**: Create a `categories` table to replace hardcoded category keys.
- **Unified Experience/Content Table**: Create a `contents` (or `experiences`) table with a `type` column ('track', 'trip') and generic metadata.
- **Dynamic Checkpoints/Waypoints Table**: Create a `waypoints` table for trips, linking coordinates and optional audio triggers to a parent content ID.
- **Frontend Refactoring**:
  - Update API client to fetch categories and contents from the DB.
  - Refactor `tracks.tsx` to display both Tracks and Trips, filtered by category and type.
  - Update track detail view to handle conditional playback (Tracks: play anywhere; Trips: geofenced start, waypoint tracking).
- **Migration & Seeding**: Delete the old schema and write a migration script to populate the new database tables with the migrated mock data.

### Out of Scope

- Advanced background navigation instructions/turn-by-turn guidance.
- Dynamic creation of trips/contents from a mobile admin interface.

## Capabilities

### New Capabilities

- `dynamic-categories`: Fetch categories dynamically from the database instead of using a hardcoded array.
- `trip-playback-tracking`: Enforce starting geofence for Trips and track user progress along a set of waypoints.

### Modified Capabilities

- `track-playback`: Change track fetching to retrieve records dynamically from the backend and support location recording timestamps.

## Approach

1. **DB Schema (Drizzle ORM)**:
   - Create `categories` table (`key` PK, `label_key`, `order`).
   - Create `contents` table (`id` PK, `slug` unique, `title`, `description`, `type` text, `category_key` FK, `audio_url` nullable, `duration_seconds`, `latitude`, `longitude`, `recorded_at` timestamp nullable, `price_label`, `image_key`, `is_downloadable`).
   - Create `waypoints` table (`id` PK, `content_id` FK, `order` integer, `latitude`, `longitude`, `audio_url` nullable, `radius_meters`).
2. **Frontend Adaptation**:
   - Create list filters by type (`track` | `trip`).
   - Detail view dynamically loads waypoints for trips and renders them on the map.
   - Restrict playback on `trip` detail page if user is outside the starting waypoint geofence.

## Affected Areas

| Area                                               | Impact   | Description                                                                       |
| -------------------------------------------------- | -------- | --------------------------------------------------------------------------------- |
| `apps/api/src/db/schema.ts`                        | Modified | Define `categories`, `contents`, and `waypoints` tables; drop old `tracks` table. |
| `apps/api/src/db/seed.ts`                          | Modified | Seed the database with the new unified structure.                                 |
| `packages/shared/src/tracks.ts`                    | Modified | Update shared types to match the new dynamic entities.                            |
| `apps/mobile/src/app/(tabs)/tracks.tsx`            | Modified | Fetch and filter categories and content from the backend dynamically.             |
| `apps/mobile/src/components/track-detail-view.tsx` | Modified | Add type-conditional checks for play restrictions and waypoint path mapping.      |

## Risks

| Risk                            | Likelihood | Mitigation                                                                                            |
| ------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| GPS inaccuracies blocking trips | Medium     | Allow a configurable geofence radius (default 50m) and clear visual GPS precision feedback.           |
| Offline network loss            | Medium     | Rely on already downloaded audio files and offline geofencing queries using the local database/cache. |

## Rollback Plan

Revert database schema changes via a migration rollback and restore original static mockup values in `packages/shared/src/tracks.ts` and UI files.

## Dependencies

- Drizzle ORM migration runner.

## Success Criteria

- [ ] Database successfully seeds with categories, contents, and waypoints.
- [ ] Users can browse both tracks and trips on the same screen, with dynamic categories.
- [ ] Tracks are playable anywhere in the world.
- [ ] Trips are blocked from playing until the user enters the starting coordinates geofence, and show a route on the map.
