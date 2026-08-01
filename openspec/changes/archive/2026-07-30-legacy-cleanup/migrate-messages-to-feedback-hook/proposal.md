# Proposal: Migrate MessagesScreen to useFeedbackSubmit + improve geofence blocked-state UX

## Intent

Two independent improvements:

1. **Migrate messages to shared hook**: MessagesScreen has its own ad-hoc submission logic
   (`handleManualSubmit`) that duplicates `useFeedbackSubmit` exactly: POST to `/feedback` with
   `idempotencyKey`, fallback to offline queue on failure. Migrating to the shared hook eliminates
   this duplication, centralizes error handling, and lets MessagesScreen automatically include GPS
   coordinates without consumers passing them.

2. **Better geofence proximity feedback**: When a trip is too far to play (`isPlaybackBlocked`),
   the current feedback is a small red `<ThemedText>` that's easy to miss. Users need prominent
   visual feedback — a banner card with icon, distance, and radius — and tapping the disabled play
   button should explain why instead of being silently unresponsive.

## Scope

### In Scope

#### Feature 1 — Hook migration

- Modify `useFeedbackSubmit` to read location from `useLocationStore` internally and include
  `latitude`/`longitude` in both the API call and the queue enqueue.
- Simplify `messages.tsx`: replace `useReducer`/`formReducer`/`initialFormState` with `useState`
  for modal visibility; call `useFeedbackSubmit` instead of `ApiClient.post` + `enqueue` directly.
- Remove unused imports from `messages.tsx`: `ApiClient`, `generateUUID`, `useReducer`.
- Update `use-feedback-submit.test.ts` to verify location is included in the POST payload and
  queue entry.

#### Feature 2 — Geofence blocked-state UX

- **Prominent proximity-blocked banner**: Replace the small red `<ThemedText>` at line 218 of
  `trip-detail-view.tsx` with a proper card/alert component that shows:
  - Location-pin icon
  - Explanation that the user needs to be within 50m of the start point
  - Current distance from start (`geofence.distanceMeters`)
  - Styled prominently (not just small red text — a card similar to `GpsPrecisionBadge`'s
    `card-container` pattern with an attention-grabbing theme)
- **Blocked play-button feedback**: Instead of passing `disabled={isPlaybackBlocked}` to
  `UnifiedAudioController`, remove the `disabled` prop for blocked state and intercept the play
  action in `handlePlay` to show an `Alert.alert()` explaining why playback is blocked (similar
  to the existing `triggerBypassAlert` pattern).
- **i18n**: Add new translation keys for the banner text and the alert dialog.
- Keep existing `GpsPrecisionBadge` — it provides useful GPS detail for power users.

### Out of Scope

- No changes to `track-detail-view.tsx` — it already consumes `useFeedbackSubmit` and inherits
  location auto-inclusion.
- No changes to `useFeedbackQueue` or the shared schema — both already accept optional
  coordinates.
- No spec-level behavior changes for feature 1 — pure refactor.
- No changes to `UnifiedAudioController` itself — the disabled-tap feedback is handled at the
  `trip-detail-view.tsx` level.

## Capabilities

### New Capabilities

| ID   | Description                                                                                          | Verification                              |
| ---- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| F2-1 | When playback is blocked by geofence, a prominent banner shows icon + explanation + current distance | Visual inspection                         |
| F2-2 | Tapping the play button while blocked shows an Alert explaining why                                  | Test: alert is called on blocked play tap |

### Modified Capabilities

| ID   | Description                                                                           | Verification                                        |
| ---- | ------------------------------------------------------------------------------------- | --------------------------------------------------- |
| F1-1 | `useFeedbackSubmit` sends GPS coords automatically without consumers passing them     | Test: location coords in POST payload + queue entry |
| F1-2 | MessagesScreen submits feedback through `useFeedbackSubmit`, not `ApiClient` directly | Test: hook called, old submit removed               |

## Approach

### Feature 1 — Hook migration

1. **`use-feedback-submit.ts`**: Import `useLocationStore` and read `coords` inside
   `submitFeedback`. Pass `latitude` and `longitude` (nullable) to both `ApiClient.post` and
   `feedbackQueue.enqueue`. Signature unchanged — consumers don't pass coordinates.

2. **`use-feedback-submit.test.ts`**: Add mock for `useLocationStore` returning sample coords.
   Add tests verifying coordinates appear in the API call payload and the queue enqueue input.

3. **`messages.tsx`**:
   - Replace `useReducer` + `formReducer` + `initialFormState` with simple `useState` for
     `modalVisible`.
   - Call `useFeedbackSubmit()` and wire `submitFeedback(experienceId, message)` directly as
     the form's `onSubmit`.
   - Map `feedbackStatus` → `submitStatus`, `feedbackError` → `submitErrorMsg` for
     `FeedbackForm` props.
   - Wire `dismissFeedback` as the form's `onDismiss`.
   - Remove unused imports: `ApiClient`, `generateUUID`, `useReducer`.

### Feature 2 — Geofence blocked-state UX

1. **Prominent blocked banner** (`trip-detail-view.tsx`, around line 218):
   - Replace the single `<ThemedText>` with a `<TwView>` container using a card style (e.g.
     `bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800/40`) — the
     same `card-container` pattern used by `GpsPrecisionBadge`.
   - Inside it: an `Icon` row (location pin symbol), a bold explanation text with the
     `mustBeOnSite` key, and a distance line: `"Estás a X metros del inicio (se requieren 50m)"`
     using the translated `distanceMeters` value.
   - The banner shows only when `isPlaybackBlocked` is true (same condition as current code).
   - Add new translation keys under `experiences.geofenceBlocked.*` in both `es.ts` and `en.ts`.

2. **Blocked play-button feedback** (`trip-detail-view.tsx`):
   - Remove `isPlaybackBlocked` from the `disabled` prop on `UnifiedAudioController`. The
     `disabled` prop will only carry `!track.audioUrl`.
   - Add a `triggerProximityAlert` function (pattern-matches existing `triggerBypassAlert`):
     shows `Alert.alert()` (or `window.confirm` on web) with a title and message explaining
     the user is too far from the start point.
   - Update `handlePlay` to check `isPlaybackBlocked` first (before `showBypassWarning`), and
     call `triggerProximityAlert` instead of silently doing nothing.
   - Also update `handleDownload` similarly if `isPlaybackBlocked` should prevent download as
     well (consistent with current behavior where both play and download are disabled).
   - Add new translation keys for the proximity alert dialog.

3. **i18n** (`es.ts`, `en.ts`):
   - Add `experiences.geofenceBlocked.title` — "Ubicación no válida" / "Invalid location"
   - Add `experiences.geofenceBlocked.message` — "Necesitás estar a menos de 50m del punto de
     inicio. Estás a {{distance}}." / "You need to be within 50m of the start. You are
     {{distance}} away."
   - Add `experiences.geofenceBlocked.distance` — "Distancia actual: {{distance}}" / "Current
     distance: {{distance}}"
   - Add `experiences.geofenceBlocked.alertTitle` — "Demasiado lejos" / "Too far away"
   - Add `experiences.geofenceBlocked.alertMessage` — "Tenés que estar a menos de 50m del
     inicio para reproducir este recorrido. Actualmente estás a {{distance}}." / "You need to
     be within 50m of the start to play this trip. You are currently {{distance}} away."
   - Add `experiences.geofenceBlocked.ok` — "Entendido" / "Got it"

4. **Tests** (new or updated):
   - Add tests for the blocked-play alert: render `trip-detail-view` with `isPlaybackBlocked`
     true, tap play, verify `Alert.alert` is called with the proximity message.
   - Add tests for the blocked banner: verify banner renders with icon and distance text.
   - (Feature 1 tests already covered in `use-feedback-submit.test.ts`.)

## Affected Areas

| Area                                               | Impact         | Description                                                                            |
| -------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------- |
| `src/hooks/use-feedback-submit.ts`                 | Modified       | Add location from useLocationStore to POST and queue                                   |
| `src/hooks/__tests__/use-feedback-submit.test.ts`  | Modified       | Add location coverage                                                                  |
| `src/app/(tabs)/messages.tsx`                      | Modified       | Replace ad-hoc submission + useReducer with useFeedbackSubmit + useState               |
| `src/components/trip-detail-view.tsx`              | Modified       | Replace small blocked text with prominent banner; make disabled play button show alert |
| `src/i18n/locales/es.ts`                           | Modified       | Add `experiences.geofenceBlocked.*` keys                                               |
| `src/i18n/locales/en.ts`                           | Modified       | Add `experiences.geofenceBlocked.*` keys                                               |
| `src/__tests__/trip-detail-view.test.tsx` (or new) | Added/Modified | Tests for blocked banner + play-alert behavior                                         |

## Risks

| Risk                                                     | Likelihood | Mitigation                                                                              |
| -------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------- |
| Feature 1: No significant risks                          | Low        | Hook is well-tested (8 existing tests); MessagesScreen behavior preserved exactly       |
| Feature 2: Banner adds visual weight to the detail view  | Medium     | Banner only shows when blocked; same condition as current small text                    |
| Feature 2: Alert dialog may be dismissed without reading | Low        | The banner remains visible as persistent passive feedback even after alert is dismissed |

## Rollback Plan

Revert commits in reverse order:

1. `git revert <geofence-play-commit>`
2. `git revert <geofence-banner-commit>`
3. `git revert <messages-commit>`
4. `git revert <hook-commit>`

No data migration or schema change — pure code rollback.

## Dependencies

None.

## Success Criteria

### Feature 1

- [ ] `useFeedbackSubmit` sends `latitude`/`longitude` from `useLocationStore` in the API POST and queue enqueue
- [ ] MessagesScreen submits feedback through the hook, not directly through ApiClient
- [ ] MessagesScreen modal visibility uses `useState` (not `useReducer`)
- [ ] All existing tests pass (hook tests + any messages-screen tests)
- [ ] Unused imports removed from messages.tsx

### Feature 2

- [ ] When `isPlaybackBlocked` is true, a prominent banner card renders with icon, explanation, and current distance
- [ ] The banner disappears when `isPlaybackBlocked` becomes false (user nears the start)
- [ ] Tapping the play button while blocked shows an Alert explaining the proximity requirement
- [ ] Tapping "Entendido" / "Got it" dismisses the alert without starting playback
- [ ] Existing `GpsPrecisionBadge` still renders with GPS detail data
- [ ] New translation keys are added in both `es.ts` and `en.ts`
- [ ] All tests pass

## Commit Plan

4 work-unit commits:

| #   | Message                                                               | Scope              | Contents                                                                                                                             |
| --- | --------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `feat(hook): add location to useFeedbackSubmit via useLocationStore`  | Hook + tests       | Import useLocationStore, read coords, include in POST and enqueue. Update tests.                                                     |
| 2   | `refactor(messages): migrate MessagesScreen to useFeedbackSubmit`     | messages.tsx       | Replace ad-hoc submit + useReducer with useFeedbackSubmit + useState. Clean unused imports.                                          |
| 3   | `feat(trip-detail): add proximity-blocked banner with distance info`  | trip-detail + i18n | Replace small red blocked text with prominent card (icon + explanation + distance). Add i18n keys. Add banner tests.                 |
| 4   | `feat(trip-detail): make blocked play button explain proximity block` | trip-detail + i18n | Remove `isPlaybackBlocked` from `disabled`; add `triggerProximityAlert`; intercept in `handlePlay`/`handleDownload`. Add alert test. |
