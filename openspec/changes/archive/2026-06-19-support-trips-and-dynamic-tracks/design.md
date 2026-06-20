# Design: Support Trips and Dynamic Tracks

## Technical Approach

We will refactor the backend database tables to use Drizzle ORM and introduce an `experiences` table which acts as the unified entity model for both simple audio tracks and complex geofenced trips. Dynamic categories will be supported via a separate `categories` table. Trips will have ordered GPS coordinates stored in a `waypoints` table. The React Native mobile frontend will fetch categories and experiences dynamically from the backend, using the `type` discriminator to render appropriate UI constraints and mapping coordinates.

## Architecture Decisions

| Decision               | Choice                                                               | Rationale                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Experience Model**   | Unified `experiences` table with `type: 'track' \| 'trip'` column.   | Simpler REST API queries, high component reuse in React Native, and trivial extension path for future content types.         |
| **Route Coordinates**  | Ordered relation table `waypoints` (`experience_id`, `order`, etc.). | Allows dynamic checkpoint list with optional checkpoint-specific audio triggers, keeping the main content table lightweight. |
| **Dynamic Categories** | Table `categories` (`key` PK, `label_key`, `order`).                 | Allows content management systems or backend managers to configure categories without updating the mobile app bundle.        |

## Data Flow

```
Mobile App (React Native)
  ├── Fetch categories/experiences ──→ API Server (Express/Wrangler)
  │                                           │
  │                                     Queries DB
  │                                           ↓
  └── Display List & Detail views ←── JSON responses (Drizzle schemas)
```

## File Changes

| File                                               | Action | Description                                                                                                   |
| -------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/db/schema.ts`                        | Modify | Define `categories`, `experiences`, and `waypoints` tables. Remove old `tracks` table.                        |
| `apps/api/src/db/seed.ts`                          | Modify | Seed database with new `categories`, `experiences` and `waypoints`.                                           |
| `packages/shared/src/tracks.ts`                    | Modify | Redefine shared types for `Category`, `Experience`, and `Waypoint`. Remove hardcoded `TRACKS` record map.     |
| `apps/mobile/src/data/tracks.ts`                   | Modify | Fetch and cache experiences/categories from local SQLite / remote API instead of loading hardcoded constants. |
| `apps/mobile/src/app/(tabs)/tracks.tsx`            | Modify | Add a filter selector for `Type` (All / Tracks / Trips) and populate category chips dynamically.              |
| `apps/mobile/src/components/track-detail-view.tsx` | Modify | Enforce geofencing playback block for trips, and display trip route coordinates on the map.                   |

## Interfaces / Contracts

```typescript
// packages/shared/src/tracks.ts
export type ExperienceType = 'track' | 'trip';

export interface Category {
  key: string;
  labelKey: string;
  order: number;
}

export interface Waypoint {
  id: string;
  experienceId: string;
  order: number;
  latitude: number;
  longitude: number;
  audioUrl?: string | null;
  radiusMeters: number;
}

export interface Experience {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: ExperienceType;
  categoryKey: string;
  audioUrl?: string | null;
  durationSeconds: number;
  latitude: number;
  longitude: number;
  recordedAt?: string | null;
  priceLabel?: string | null;
  imageKey: string;
  isDownloadable: boolean;
  waypoints?: Waypoint[];
}
```

## Testing Strategy

| Layer        | What to Test              | Approach                                                                                |
| ------------ | ------------------------- | --------------------------------------------------------------------------------------- |
| Unit         | Proximity geofencing hook | Test `useOfflineGeofence` with varied mock coordinates.                                 |
| Integration  | Experiences filtering     | Test filtering layout in `tracks.tsx` when switching from Tracks to Trips.              |
| E2E / Manual | Trip playback enforcement | Verify play button is disabled/error-labeled when user is outside starting coordinates. |

## Migration / Rollout

Deploy schema updates using Drizzle migrations (`bun run drizzle-kit generate` and migration apply). Run seed script to populate migrated dynamic database.

## Open Questions

None.
