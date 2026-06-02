# Tasks: Post-Trip Offline Feedback Queue

## Review Workload Forecast

| Field                   | Value                                                |
| ----------------------- | ---------------------------------------------------- |
| Estimated changed lines | ~480–550                                             |
| 400-line budget risk    | Medium                                               |
| Chained PRs recommended | Yes                                                  |
| Suggested split         | PR 1: API + types + hooks → PR 2: UI + wiring + i18n |
| Delivery strategy       | ask-on-risk                                          |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal                         | Likely PR | Notes                                                                 |
| ---- | ---------------------------- | --------- | --------------------------------------------------------------------- |
| 1    | API + types + hooks + tests  | PR 1      | Foundation: deps, API, 4 hooks, mocks, tests                          |
| 2    | FeedbackForm + wiring + i18n | PR 2      | UI layer: form modal, trigger wiring, translations, integration tests |

## Phase 1: Foundation (deps, types, API, mocks)

- [x] 1.1 Install `expo-sqlite` + `@react-native-community/netinfo` in package.json
- [x] 1.2 Add `FeedbackTriggerMode` type + `feedbackTrigger` field to `src/data/trips.ts`
- [x] 1.3 Scaffold `api/` dir: `package.json`, `tsconfig.json`, `wrangler.toml`
- [x] 1.4 Create `api/src/index.ts` — Hono `POST /feedback` with validation + KV binding dedup (201/409/422)
- [x] 1.5 Add `expo-sqlite` + NetInfo mocks to `jest.setup.ts`

## Phase 2: Core Hooks (RED → GREEN per hook)

- [x] 2.1 **Test**: `useNetworkStatus` — NetInfo online→offline→online transitions, empty queue no-op (spec scenarios: flush, rapid toggle, empty queue)
- [x] 2.2 **Impl**: `src/hooks/use-network-status.ts` — NetInfo listener exposes `{ isOnline }`
- [x] 2.3 **Test**: `useFeedbackQueue` — enqueue/peek/remove cycle, dedup by idempotencyKey (spec: queue on failure, duplicate key)
- [x] 2.4 **Impl**: `src/hooks/use-feedback-queue.ts` — expo-sqlite/kv-store CRUD: `enqueue()`, `peekAll()`, `remove()`
- [x] 2.5 **Test**: `useFeedbackSync` — flush 3 entries, partial failure leaves remaining (spec: flush on reconnect, partial failure)
- [x] 2.6 **Impl**: `src/hooks/use-feedback-sync.ts` — reads queue, POSTs each, removes on 201, leaves on error
- [x] 2.7 **Test**: `useFeedbackTrigger` — each mode opens form, no trigger = hidden (spec: each mode, no trigger)
- [x] 2.8 **Impl**: `src/hooks/use-feedback-trigger.ts` — reads `feedbackTrigger`, wires source, exposes `{ showFeedback, dismiss }`

## Phase 3: FeedbackForm + i18n

- [x] 3.1 **Test**: FeedbackForm — render, empty validation error, valid submit calls `onSubmit`, shows queued/sent/error states
- [x] 3.2 **Impl**: `src/components/feedback-form.tsx` — `<Modal>` with text input, submit, status: sending/sent/queued/error
- [x] 3.3 Add `feedback.*` i18n keys to `src/i18n/locales/en.ts` (title, placeholder, submit, sending, sent, queued offline, error, validation empty)
- [x] 3.4 Add `feedback.*` i18n keys to `src/i18n/locales/es.ts`

## Phase 4: Integration Wiring

- [x] 4.1 Wire `useFeedbackTrigger` + `FeedbackForm` into `TripDetailView`: audio_end via player `didJustFinish`
- [x] 4.2 Wire geofence arrival trigger in `TripDetailView` (`geofence` mode)
- [x] 4.3 Wire `useFeedbackSync` into `TripDetailView` to auto-flush on online transition
- [x] 4.4 Add manual feedback button to `TripDetailView` footer (`manual` mode)

## Phase 5: Verification

- [x] 5.1 Write API test (Vitest/miniflare): POST /feedback validation errors, 201 success, 409 duplicate dedup
- [x] 5.2 Verify `make validate` passes (format, test, lint, typecheck, gga)
