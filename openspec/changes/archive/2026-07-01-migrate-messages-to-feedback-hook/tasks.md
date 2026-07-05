# Tasks: Migrate MessagesScreen to useFeedbackSubmit + geofence blocked-state UX

## Review Workload Forecast

| Field                   | Value                              |
| ----------------------- | ---------------------------------- |
| Estimated changed lines | ~257                               |
| 400-line budget risk    | Low                                |
| Chained PRs recommended | No                                 |
| Suggested split         | Single PR with 4 work-unit commits |
| Delivery strategy       | ask-on-risk                        |
| Chain strategy          | pending                            |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Hook Foundation

- [x] 1.1 **Add location from store to `useFeedbackSubmit`** — `use-feedback-submit.ts`: import `useLocationStore`, call `getState().coords` in `submitFeedback`, pass `latitude`/`longitude` to both `ApiClient.post` body and `feedbackQueue.enqueue`. Update `use-feedback-submit.test.ts`: mock location store, add lat/lng assertions to existing tests, add `null coords` test case.

## Phase 2: MessagesScreen Migration

- [x] 2.1 **Migrate MessagesScreen to `useFeedbackSubmit`** — `messages.tsx`: remove `useReducer`, `ApiClient`, `generateUUID`, `DeviceEventEmitter` imports + code. Replace with `useState(false)` for modal + `useFeedbackSubmit()`. Add `useEffect` on `feedbackStatus` to close modal + `refetch()` on `sent`/`queued`. Wire `submitFeedback` as form `onSubmit`. Keep `useFeedbackQueue` for `queue` (still needed for merged feed display).

## Phase 3: Geofence Blocked-State UX

- [x] 3.1 **Create `GeofenceBlockedBanner` component** — `components/geofence-blocked-banner.tsx` (new): icon (location pin) + title + explanation + `distanceMeters` + `requiredRadiusMeters`. Add `components/__tests__/geofence-blocked-banner.test.tsx` (new): verify render with distance, handle null distance.
- [x] 3.2 **Add `experiences.geofenceBlocked` i18n keys** — `es.ts` + `en.ts`: `title`, `explanation`, `distance`, `requiredRadius`, `playAlertTitle`, `playAlertMessage`, `ok`.
- [x] 3.3 **Wire banner and proximity alert in `TripDetailView`** — `trip-detail-view.tsx`: replace small red `<ThemedText>` with `<GeofenceBlockedBanner>`. Remove `isPlaybackBlocked` from `UnifiedAudioController` `disabled` prop. Add `showGeofenceAlert` → intercept in `handlePlay`/`handleDownload` before bypass check. Test: tap play while blocked shows `Alert.alert`; tap while on-site plays normally; download also blocked.

## Dependencies

```
Phase 1 ──> Phase 2  (MessagesScreen needs updated hook)
Phase 3.1 ──> Phase 3.2 ──> Phase 3.3  (i18n and component needed before wiring)
Phase 1 and Phase 3 are independent (parallelizable)
```

## Implementation Order

1. Phase 1 (hook with location) — 1 commit
2. Phase 2 (MessagesScreen migration) — 1 commit
3. Phase 3.1 + 3.2 + 3.3 (geofence UX + i18n) — 1-2 commits
4. Merge all into single PR (~257 lines, under 400-line budget)
