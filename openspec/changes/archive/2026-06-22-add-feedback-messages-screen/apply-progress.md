# Apply Progress: Add Feedback Messages Screen

## Implementation Progress

**Change**: add-feedback-messages-screen
**Mode**: Strict TDD

### Completed Tasks

- [x] 1.1 Add `latitude` and `longitude` fields to drizzle table schema in `apps/api/src/db/schema.ts`
- [x] 1.2 Update payload validations in `packages/shared/src/feedback.ts` to support optional GPS parameters
- [x] 1.3 Add `GET /feedback` route and update `POST /feedback` handler in `apps/api/src/routes/feedback.ts`
- [x] 1.4 Write integration unit tests in `apps/api/src/__tests__/feedback.test.ts` verifying request validations with coordinates
- [x] 2.1 Update `FeedbackEntry` type in `apps/mobile/src/types/feedback.ts` to include optional coordinates
- [x] 2.2 Enhance local kv-store mapping in `apps/mobile/src/storage/feedback-storage.ts` and queue saving
- [x] 2.3 Add "messages" entry into `TABS` constant mapping in `apps/mobile/src/constants/tabs.ts`
- [x] 2.4 Toggle `SHOW_LOCAL_MESSAGES = true` in `apps/mobile/src/app/(tabs)/index.tsx`
- [x] 3.1 Create new tab view component screen `apps/mobile/src/app/(tabs)/messages.tsx`
- [x] 3.2 Add filter sub-tabs ("Todos" and "Cercanos") and wire client-side geolocated distance filtering
- [x] 3.3 Add "+ Mensaje nuevo" button triggering the feedback submission modal form
- [x] 3.4 Hook up GPS coordinates from `useLocationStore` when sending feedback
- [x] 4.1 Write UI integration rendering tests for the new screen in `apps/mobile/src/__tests__/messages.test.tsx`
- [x] 4.2 Verify network auto-sync works by flushing queued offline feedback with GPS coordinates
- [x] 5.1 Refactor experience format tuple arrays in `packages/shared/src/experiences.ts` to avoid spread operations
- [x] 5.2 Unify `idempotencyKey` generation to use `generateUUID` across `messages.tsx` and `track-detail-view.tsx`
- [x] 5.3 Split the unified `experiences.tsx` screen into dedicated `tracks.tsx` and `trips.tsx` tab screens and adjust navigation

### TDD Cycle Evidence

| Task | Test File                                                    | Layer       | Safety Net | RED        | GREEN     | TRIANGULATE | REFACTOR |
| ---- | ------------------------------------------------------------ | ----------- | ---------- | ---------- | --------- | ----------- | -------- |
| 1.4  | `apps/api/src/__tests__/feedback.test.ts`                    | Integration | ✅ Passed  | ✅ Written | ✅ Passed | ✅ 3 cases  | ✅ Clean |
| 2.2  | `apps/mobile/src/hooks/__tests__/use-feedback-queue.test.ts` | Unit        | ✅ Passed  | ✅ Written | ✅ Passed | ✅ 2 cases  | ✅ Clean |
| 4.1  | `apps/mobile/src/__tests__/messages.test.tsx`                | Integration | N/A (new)  | ✅ Written | ✅ Passed | ✅ 3 cases  | ✅ Clean |

### Files Changed

| File                                               | Action   | What Was Done                                                                   |
| -------------------------------------------------- | -------- | ------------------------------------------------------------------------------- |
| `apps/api/src/db/schema.ts`                        | Modified | Added double precision columns for coordinates                                  |
| `packages/shared/src/feedback.ts`                  | Modified | Updated Zod schema coordinates validations                                      |
| `apps/api/src/routes/feedback.ts`                  | Modified | Implemented GET route and persisted coordinates on POST                         |
| `apps/mobile/src/types/feedback.ts`                | Modified | Extended FeedbackEntry interface                                                |
| `apps/mobile/src/hooks/use-feedback-queue.ts`      | Modified | Cached GPS coordinates in offline storage queue                                 |
| `apps/mobile/src/hooks/use-feedback-sync.ts`       | Modified | Shared GPS coordinates during flushQueue request payload                        |
| `apps/mobile/src/constants/tabs.ts`                | Modified | Appended Tracks, Trips, and Messages configuration to TABS                      |
| `apps/mobile/src/app/(tabs)/index.tsx`             | Modified | Enabled SHOW_LOCAL_MESSAGES button and corrected routing to /tracks and /trips  |
| `apps/mobile/src/app/(tabs)/messages.tsx`          | Created  | Built messages list tab with Todos/Cercanos filtering and manual modal triggers |
| `packages/shared/src/experiences.ts`               | Modified | Refactored formats arrays into explicit const tuples                            |
| `apps/mobile/src/components/track-detail-view.tsx` | Modified | Shared and preserved stable generated UUID keys on retry                        |
| `apps/mobile/src/app/(tabs)/tracks.tsx`            | Created  | Dedicated tracks tab view screen                                                |
| `apps/mobile/src/app/(tabs)/trips.tsx`             | Created  | Dedicated trips tab view screen                                                 |
| `apps/mobile/src/components/experiences-view.tsx`  | Created  | Reusable parameterized ExperiencesScreen component                              |

### Deviations from Design

None — implementation matches design.

### Issues Found

None.

### Remaining Tasks

None.

### Workload / PR Boundary

- Mode: single PR
- Current work unit: N/A
- Boundary: Full implementation of backend API, frontend Messages tab screen, and split Tracks/Trips tabs
- Estimated review budget impact: ~350 changed lines

### Status

17/17 tasks complete. Ready for verify.
