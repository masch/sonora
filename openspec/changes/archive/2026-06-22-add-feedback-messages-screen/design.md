# Design: Add Feedback Messages Screen

## Technical Approach

We will build the community feedback reading/writing hub. The client will query `GET /feedback` to download community feedback logs, filter them locally (or geolocalize within 500m of the active GPS location), and present a stylish feed card layout under a new "Mensajes" tab. Submitting feedback will query the GPS store at creation time and append latitude/longitude to the request payload.

---

## Architecture Decisions

| Component               | Choice                                              | Tradeoff / Rationale                                                                                       |
| ----------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Messages Tab UI**     | Create `apps/mobile/src/app/(tabs)/messages.tsx`    | Keeps file-based tab routing clean. Registers directly with the main tab bar layout components.            |
| **GPS Filtration**      | Client-Side filtering via Haversine logic           | Highly responsive, avoids complex SQL geometry filters on Hono, and is robust for varying network signals. |
| **Bookmark/Saved Feed** | Disabled/Omitted (Out of Scope)                     | Streamlines scope and keeps implementation focused on the core community messages board.                   |
| **GPS Acquisition**     | Capture current coordinates from `useLocationStore` | Centralized store already watches GPS; simply query it when building the feedback payload.                 |

---

## Data Flow

```
[User interacts with Messages UI] ──> Fetch GET /feedback from API
                                             │
 [User types and submits comment] ────> Reads coordinates from useLocationStore
                                             │
                                   Is Network connected?
                                   /                 \
                                (Yes)               (No)
                                 /                     \
                      POST to /feedback         Queue in SQLite KV-store
```

---

## File Changes

| File                                      | Action | Description                                                                            |
| ----------------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| `apps/api/src/db/schema.ts`               | Modify | Add `latitude` and `longitude` fields to the feedbacks table schema.                   |
| `packages/shared/src/feedback.ts`         | Modify | Update Zod payload validations to accept latitude and longitude coordinates.           |
| `apps/api/src/routes/feedback.ts`         | Modify | Introduce `GET /feedback` and accept GPS fields on `POST /feedback`.                   |
| `apps/mobile/src/types/feedback.ts`       | Modify | Extend `FeedbackEntry` type definition to include optional `latitude` and `longitude`. |
| `apps/mobile/src/app/(tabs)/index.tsx`    | Modify | Set `SHOW_LOCAL_MESSAGES = true` and update navigation logic.                          |
| `apps/mobile/src/constants/tabs.ts`       | Modify | Append `messages` to `TABS` array constant.                                            |
| `apps/mobile/src/app/(tabs)/messages.tsx` | Create | Main screen showing Feed filter tabs and manual feedback trigger button.               |

---

## Interfaces / Contracts

```typescript
// packages/shared/src/feedback.ts
export const FeedbackPostBodySchema = z.object({
  experienceId: z.string().min(1),
  message: z.string().min(1),
  idempotencyKey: z.string().min(1),
  createdAt: z.string().min(1),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});
```

---

## Testing Strategy

| Layer       | What to Test                                | Approach                                                                        |
| ----------- | ------------------------------------------- | ------------------------------------------------------------------------------- |
| Unit        | API request validations                     | Test Hono handlers with missing or invalid GPS parameters.                      |
| Integration | Messages screen rendering and tab switching | Render `MessagesScreen` with mock data and test toggling "Todos" vs "Cercanos". |
| Integration | Queue caching with GPS                      | Mock SQLite kv-store and verify entries match coordinates.                      |

---

## Migration / Rollout

Run Drizzle schema migration target `make api-db-migrate` to add database table columns prior to server deployment.
