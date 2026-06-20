## Exploration: Support Trips and Dynamic Tracks

### Current State

- **Database Schema**: There's a `tracks` table with `id`, `slug`, `title`, `description`, `durationSeconds`, `audioUrl`, `feedbackTrigger`. It doesn't contain geofencing coordinates, category, or subLabel details, which are currently hardcoded in the frontend.
- **Frontend Metadata**: Tracks are statically defined in `packages/shared/src/tracks.ts` via `LocalTrackMetadata`, which includes metadata such as `startCoordinates`, `category`, `subLabel`, `imageKey`, `priceLabel`, etc.
- **Location logic**: Every track detail view uses `useOfflineGeofence` targeting `track.startCoordinates`, but it only displays a proximity badge and does not block playback (playback is playable anywhere). There is no "Trip" type with user tracking/route constraints.

### Affected Areas

- `apps/api/src/db/schema.ts` — Define new DB entities for `tracks` and `trips` (or a unified `contents`/`items` entity with type variants).
- `packages/shared/src/tracks.ts` — Update shared types/interfaces to distinguish between a `Track` and a `Trip`, or unify them under a discriminator.
- `apps/mobile/src/app/(tabs)/index.tsx` — Split the navigation logic so that "Explorar Recorridos" goes to a list of Trips and "Explorar Tracks" goes to a list of Tracks (or filters the unified list accordingly).
- `apps/mobile/src/app/(tabs)/tracks.tsx` — Add logic to handle both tracks and trips dynamically, with appropriate filtering.
- `apps/mobile/src/components/track-detail-view.tsx` — Conditionally render play controls and location restrictions depending on whether the content is a `track` (playable anywhere, optional proximity feedback) or a `trip` (requires user to be at start coordinates to play, tracks route progress).

### Approaches

1. **Unified Schema with Type Discriminator** — Keep a single table/entity in the DB (e.g. `items` or `experiences`) with a `type: 'track' | 'trip'` discriminator column.
   - Pros: Simpler schema, shared UI components can reuse 90% of the loading, querying, and rendering logic.
   - Cons: Some fields (like route coordinates list/path for trips) are null or unused for simple tracks.
   - Effort: Medium

2. **Separate Entities (Tracks and Trips Tables)** — Create two distinct tables in the database.
   - Pros: Highly normalized, strict schema constraints per type.
   - Cons: Code duplication in API endpoints, repository layer, and frontend screens (requires separate views/screens or complex mapping to a union type).
   - Effort: High

### Recommendation

We recommend **Approach 1 (Unified Schema with Type Discriminator)** because tracks and trips share almost all properties (title, description, image, duration, price, audio, category, author, status), with the main differences being behavior (playback restrictions) and additional fields (trips have a path/route, whereas tracks only have a single start point). A unified entity with type discrimination simplifies backend queries, API endpoints, schema migration, and frontend lists.

### Risks

- Offline-first capabilities: Trips tracking user progress might require robust location background services or offline map caching.
- Migration path: Transitioning from current static/hardcoded tracks to dynamic DB-fetched values requires keeping backward compatibility while migrating data.

### Ready for Proposal

Yes — Proceeding to Proposal phase. We will present the proposal to the user and start the proposal question round.
