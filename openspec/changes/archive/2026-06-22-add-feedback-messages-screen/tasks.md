# Tasks: Add Feedback Messages Screen

## Review Workload Forecast

| Field                   | Value           |
| ----------------------- | --------------- |
| Estimated changed lines | 250 - 350 lines |
| 400-line budget risk    | Medium          |
| Chained PRs recommended | No              |
| Suggested split         | Single PR       |
| Delivery strategy       | ask-on-risk     |
| Chain strategy          | size-exception  |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

---

## Phase 1: Database & Backend Foundation

- [x] 1.1 Add `latitude` and `longitude` fields to drizzle table schema in `apps/api/src/db/schema.ts`.
- [x] 1.2 Update payload validations in `packages/shared/src/feedback.ts` to support optional GPS parameters.
- [x] 1.3 Add `GET /feedback` route and update `POST /feedback` handler in `apps/api/src/routes/feedback.ts`.
- [x] 1.4 Write integration unit tests in `apps/api/src/__tests__/feedback.test.ts` verifying request validations with coordinates.

## Phase 2: Client Storage & Navigation

- [x] 2.1 Update `FeedbackEntry` type in `apps/mobile/src/types/feedback.ts` to include optional coordinates.
- [x] 2.2 Enhance local kv-store mapping in `apps/mobile/src/storage/feedback-storage.ts` and queue saving.
- [x] 2.3 Add "messages" entry into `TABS` constant mapping in `apps/mobile/src/constants/tabs.ts`.
- [x] 2.4 Toggle `SHOW_LOCAL_MESSAGES = true` in `apps/mobile/src/app/(tabs)/index.tsx`.

## Phase 3: Screen & UI Implementation

- [x] 3.1 Create new tab view component screen `apps/mobile/src/app/(tabs)/messages.tsx`.
- [x] 3.2 Add filter sub-tabs ("Todos" and "Cercanos") and wire client-side geolocated distance filtering.
- [x] 3.3 Add "+ Mensaje nuevo" button triggering the feedback submission modal form.
- [x] 3.4 Hook up GPS coordinates from `useLocationStore` when sending feedback.

## Phase 4: Integration & Tests

- [x] 4.1 Write UI integration rendering tests for the new screen in `apps/mobile/src/__tests__/messages.test.tsx`.
- [x] 4.2 Verify network auto-sync works by flushing queued offline feedback with GPS coordinates.

## Phase 5: Refactoring & UX Adjustments

- [x] 5.1 Refactor experience format tuple arrays in `packages/shared/src/experiences.ts` to avoid spread operations.
- [x] 5.2 Unify `idempotencyKey` generation to use `generateUUID` across `messages.tsx` and `track-detail-view.tsx`.
- [x] 5.3 Split the unified `experiences.tsx` screen into dedicated `tracks.tsx` and `trips.tsx` tab screens and adjust navigation.
