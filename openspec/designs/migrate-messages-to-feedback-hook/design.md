# Design: migrate-messages-to-feedback-hook

**What**: Migrate `messages.tsx` feedback submission to `useFeedbackSubmit`, add GPS coordinates from `useLocationStore` to all feedback submissions, and add geofence blocked UX (banner + alert) to `trip-detail-view.tsx`.

**Why**: Eliminate duplicate inline submit logic, ensure every feedback submission (from any consumer) includes GPS context, and improve UX when playback is geofence-blocked.

**Review path**: Start with architecture changes → data flow → component tree → new i18n keys → testing strategy. Intentionally out of scope: `track-detail-view.tsx`, `GpsPrecisionBadge`, API route changes, and `use-feedback-feed` changes.

---

## 1. Architecture changes

### 1.1 `use-feedback-submit.ts` — Add location to submissions

| Before                                                            | After                                                                |
| ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| Reads only `t` (i18n) and `feedbackQueue`                         | Also reads `coords` from `useLocationStore` on each submission       |
| API POST body: `experienceId, message, idempotencyKey, createdAt` | Adds `latitude, longitude` from store (null when coords unavailable) |
| Queue entry: `{ experienceId, message }`                          | Adds `latitude, longitude`                                           |

**Why not subscribe to the store?** Using `useLocationStore.getState().coords` inside the callback reads the latest value on each invocation without forcing a hook re-render on every GPS update. The callback's dependency array stays `[t, feedbackQueue]`.

```diff
- const submitFeedback = useCallback(
-   async (experienceId: string, message: string) => {
+ const submitFeedback = useCallback(
+   async (experienceId: string, message: string) => {
+     const { coords } = useLocationStore.getState();
+     const lat = coords?.latitude ?? null;
+     const lng = coords?.longitude ?? null;
+
      setFeedbackStatus('sending');
      setFeedbackError(null);
      const idempotencyKey = generateUUID();

      try {
        await ApiClient.post('/feedback', {
          experienceId,
          message,
          idempotencyKey,
          createdAt: new Date().toISOString(),
+         latitude: lat,
+         longitude: lng,
        });
        setFeedbackStatus('sent');
      } catch (_err) {
        logger.error('[API_ERROR] Fetch failed, queueing feedback:');
        try {
-         await feedbackQueue.enqueue({ experienceId, message }, idempotencyKey);
+         await feedbackQueue.enqueue(
+           { experienceId, message, latitude: lat, longitude: lng },
+           idempotencyKey,
+         );
          setFeedbackStatus('queued');
```

**Consumer impact**: `TripDetailView` and `TrackDetailView` (unchanged) will now auto-include location in their feedback submissions — a free improvement.

### 1.2 `messages.tsx` — Remove inline submit, use hook

| What changes   | From                                                                   | To                                                             |
| -------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| Form state     | `useReducer` (6 actions, initial state, reducer fn)                    | Plain `useState<boolean>(false)` for modal visibility          |
| Submit logic   | `handleManualSubmit` with inline `ApiClient.post` + `enqueue` fallback | `useFeedbackSubmit().submitFeedback(generalExperienceId, msg)` |
| Queue access   | `useFeedbackQueue` for enqueuing + reading                             | `useFeedbackQueue` only for reading queue (display merging)    |
| GPS reading    | Manual `location.coords` read in handler                               | Handled by hook internally                                     |
| Closed imports | `useReducer`, `ApiClient`, `generateUUID`                              | Removed                                                        |

**New useEffect for feed refetch after submit:**

```tsx
const feedback = useFeedbackSubmit();

useEffect(() => {
  if (feedback.feedbackStatus === 'sent' || feedback.feedbackStatus === 'queued') {
    setFeedbackFormVisible(false);
    refetch();
  }
}, [feedback.feedbackStatus, refetch]);
```

**Form wiring:**

```tsx
const [feedbackFormVisible, setFeedbackFormVisible] = useState(false);

const handleManualSubmit = async (message: string) => {
  await feedback.submitFeedback(APP_CONFIG.feedback.generalExperienceId, message);
};

const handleDismiss = () => {
  feedback.dismissFeedback();
  setFeedbackFormVisible(false);
};
```

### 1.3 `trip-detail-view.tsx` — Geofence blocked banner + alert

| Element                      | Current                                                    | New                                                                          |
| ---------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Blocked indicator            | Bare `<ThemedText>` with `experiences.errors.mustBeOnSite` | `<GeofenceBlockedBanner>` component with icon + distance                     |
| Play button when blocked     | `disabled={true}` on `UnifiedAudioController` (dead tap)   | `disabled` only for missing audio; `handlePlay` shows geofence blocked Alert |
| Download button when blocked | `disabled={true}` (dead tap)                               | `handleDownload` shows geofence blocked Alert                                |

**Condition logic (unchanged):**

```tsx
const isPlaybackBlocked = !geofence.isNearStart && !isBypassable && !APP_CONFIG.bypassGeofence;
const showBypassWarning = !geofence.isNearStart && isBypassable && !APP_CONFIG.bypassGeofence;
```

**Updated handlePlay:**

```tsx
const handlePlay = () => {
  if (isPlaybackBlocked) {
    showGeofenceBlockedAlert();
  } else if (showBypassWarning) {
    triggerBypassAlert(() => player.play());
  } else {
    player.play();
  }
};
```

(Same pattern for `handleDownload`.)

**Updated UnifiedAudioController disabled prop:**

```diff
- disabled={!track.audioUrl || isPlaybackBlocked}
+ disabled={!track.audioUrl}
```

The banner IS the visual indicator; the button shows an actionable alert instead of being dead.

---

## 2. Component tree — `GeofenceBlockedBanner`

**File**: `src/components/geofence-blocked-banner.tsx`

**Props interface:**

```tsx
interface GeofenceBlockedBannerProps {
  distanceMeters: number | null;
  requiredRadiusMeters: number;
}
```

**Visual structure (top to bottom):**

```
┌────────────────────────────────────────────────┐
│  🔒 location.slash  Title: "Fuera del área"    │
│                                                 │
│  "Acercate al punto de inicio para              │
│   escuchar este recorrido."                      │
│                                                 │
│  📏 Distance to start: 120m   (o "Buscando…")  │
│  🎯 Required: 50m                                │
└────────────────────────────────────────────────┘
```

- Container: `TwView` with `card-container` + rose/red border accent
- Icon: `<Icon ios="location.slash" android="location_off" web="location_off" ... />`
- Title: `ThemedText` with bold, small uppercase
- Description: `ThemedText` with explanation text
- Distance row: `HintRow` reusing existing `map.distanceMeters`/`map.distanceKilometers` and `index.geofence.notAvailable`
- Required row: `HintRow` reusing existing `index.geofence.requiredProximity`

**Why separate component, not inline:**

- Follows existing pattern (`GpsPrecisionBadge`, `HintRow`)
- Testable independently
- Encapsulates the i18n format complexity

**Placement in trip-detail-view.tsx:**

```diff
- {isPlaybackBlocked && (
-   <ThemedText className="text-xs text-rose-600 font-bold text-center mt-2 px-4">
-     {t('experiences.errors.mustBeOnSite' as TranslationKeys)}
-   </ThemedText>
- )}
+ {isPlaybackBlocked && (
+   <GeofenceBlockedBanner
+     distanceMeters={geofence.distanceMeters}
+     requiredRadiusMeters={geofence.requiredRadiusMeters}
+   />
+ )}
```

After the mini-map section, before `UnifiedAudioController`.

**Alert (triggered by tapping play/download while blocked):**

```tsx
const showGeofenceBlockedAlert = () => {
  const distStr =
    geofence.distanceMeters !== null
      ? geofence.distanceMeters >= 1000
        ? t('map.distanceKilometers', { value: (geofence.distanceMeters / 1000).toFixed(1) })
        : t('map.distanceMeters', { value: Math.round(geofence.distanceMeters) })
      : t('index.geofence.notAvailable');

  const msg = t('experiences.geofenceBlocked.alertMessage', {
    radius: geofence.requiredRadiusMeters,
    distance: distStr,
  });

  if (Platform.OS === 'web') {
    window.alert(msg);
  } else {
    Alert.alert(t('experiences.geofenceBlocked.alertTitle'), msg);
  }
};
```

---

## 3. Data flow — location from store to API/queue

```
┌──────────────────────┐
│  useLocationStore    │
│  (Zustand)           │
│                      │
│  coords:             │
│    {lat, lng} | null │
│  status: initializing│
│          | weak      │
│          | ready     │
└────────┬─────────────┘
         │ useLocationStore.getState().coords
         ▼
┌──────────────────────┐
│  useFeedbackSubmit   │  ← reads coords at submit time
│                      │
│  submitFeedback(     │
│    expId, msg        │
│  ) → {               │
│    latitude,         │  ← null-safe: coords?.latitude ?? null
│    longitude,        │
│    ...               │
│  }                   │
└──────┬──────────────┘
       │
       ├── try: POST /feedback { ..., lat, lng }
       │        → FeedbackPostBodySchema accepts optional lat/lng
       │
       └── catch: queue.enqueue({ ..., lat, lng })
                → FeedbackEntry stores lat/lng as-is
```

**When GPS is initializing**: `coords` is `null` → `lat = null, lng = null` → both are omitted from the API body (the schema accepts `null`). The queue entry stores null. The server/display handles missing coords gracefully.

---

## 4. New i18n keys

### `en.ts`

```typescript
experiences: {
  // ... existing keys ...
  geofenceBlocked: {
    alertTitle: 'Location Required',
    alertMessage:
      'This trip can only be played within {{radius}}m of the starting point. Your current distance: {{distance}}.',
  },
},
components: {
  // ... existing keys ...
  geofenceBlockedBanner: {
    title: 'Out of area',
    description: 'Move closer to the starting point to unlock this trip.',
  },
},
common: {
  // ... add 'ok' for alert buttons
  ok: 'OK',
},
```

### `es.ts`

```typescript
experiences: {
  // ... existing keys ...
  geofenceBlocked: {
    alertTitle: 'Ubicación requerida',
    alertMessage:
      'Este recorrido solo se puede escuchar a menos de {{radius}}m del punto de inicio. Tu distancia actual: {{distance}}.',
  },
},
components: {
  // ... existing keys ...
  geofenceBlockedBanner: {
    title: 'Fuera del área',
    description: 'Acercate al punto de inicio para desbloquear este recorrido.',
  },
},
common: {
  ok: 'OK',  // neutral, universally understood
},
```

**Total: 6 new keys** (3 per locale).

---

## 5. Testing strategy

### 5.1 `use-feedback-submit.test.ts` — 5 new tests

| Test                                                | What it verifies                                           | Mock setup                                                                     |
| --------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `should include lat/lng from location store`        | POST body + queue entry have lat/lng when coords available | `useLocationStore` returns `{ coords: { latitude: -34.5, longitude: -58.3 } }` |
| `should omit lat/lng when coords null`              | POST body + queue entry omit lat/lng                       | `useLocationStore` returns `{ coords: null }`                                  |
| `should include lat/lng in queue on API failure`    | Queued entry has lat/lng when API fails                    | `ApiClient.post` rejects + coords available                                    |
| `should handle missing lat/lng on API failure`      | Queue entry has null lat/lng when coords null              | `ApiClient.post` rejects + `coords: null`                                      |
| `should include null lat/lng when GPS initializing` | Fields present but null                                    | `useLocationStore` returns `{ coords: null, status: 'initializing' }`          |

**Mock pattern:**

```tsx
const mockLocationStore = { coords: null, status: 'initializing' as const };
jest.mock('@/store/location-store', () => ({
  useLocationStore: () => mockLocationStore,
}));
```

Tests mutate `mockLocationStore.coords` before `submitFeedback` calls.

### 5.2 `messages.test.tsx` — No changes needed

The existing tests for rendering, filtering, and modal opening remain valid. The submit path (currently untested in this suite) is now covered by `use-feedback-submit.test.ts`.

### 5.3 New `geofence-blocked-banner.test.tsx` — 3 tests

| Test                                 | What it verifies                                      |
| ------------------------------------ | ----------------------------------------------------- |
| `renders with distance info`         | Shows distance and required radius labels             |
| `renders without distance when null` | Shows "N/A" for distance, still shows required radius |
| `renders instruction text`           | Description text is present                           |

### 5.4 `trip-detail-view.tsx` — 2 new test scenarios

| Test                                                   | What it verifies                         |
| ------------------------------------------------------ | ---------------------------------------- |
| `shows blocked banner when isPlaybackBlocked`          | Banner renders instead of old error text |
| `shows geofence Alert on play when blocked`            | `Alert.alert` called with blocked title  |
| `shows geofence Alert on download when blocked`        | `Alert.alert` called with blocked title  |
| `bypassable tracks still show bypass alert (existing)` | Unchanged behavior preserved             |

---

## 6. Verification instructions

### Feature 1 — Hook migration

1. **Submit feedback from Messages screen**
   - Enable GPS (iOS Simulator → Features → Location → Apple)
   - Open Messages tab, tap "Nuevo mensaje"
   - Type a message, submit
   - ✅ Verify: POST to `/feedback` includes `latitude` and `longitude` (check network tab)

2. **Submit while GPS off**
   - Disable location services
   - Submit feedback
   - ✅ Verify: POST body has `latitude: null, longitude: null`

3. **Offline fallback**
   - Toggle airplane mode
   - Submit feedback
   - ✅ Verify: Status shows "Saved offline", entry appears as pending in feed

4. **Modal behavior**
   - Submit → ✅ Modal closes on success
   - Submit → API fail → queue success → ✅ Modal closes, entry is pending in feed
   - Submit → both fail → ✅ Modal stays open with error message

### Feature 2 — Geofence blocked UX

1. **Blocked banner**
   - Open a trip far from its start coordinates
   - ✅ Verify: Banner renders with location.slash icon, "Out of area" title, distance, required proximity
   - Verify: `GpsPrecisionBadge` below remains unchanged

2. **Tap play while blocked**
   - Tap the play/download button
   - ✅ Verify: Alert shows "Location Required" with distance info
   - Verify: Audio does NOT start playing

3. **Tap download while blocked**
   - Tap download button
   - ✅ Verify: Same Alert shows (download does not start)

4. **Bypassable track, not near start**
   - Use a track with `geofenceBypassable: true`
   - ✅ Verify: Bypass warning Alert with Continue/Cancel shows (existing behavior)

5. **GPS initializing**
   - Set device to airplane mode, open a trip
   - ✅ Verify: Banner shows "N/A" for distance, blocked state still active
   - Tap play → ✅ Alert shows "N/A" for distance

---

## 7. Commit plan

Per [work-unit-commits](https://opencode-ai.github.io/skills/work-unit-commits), each commit is a single coherent unit with tests included:

| #   | Commit message                                                 | Files                                                                                                                   | Lines (est.) |
| --- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1   | `feat(feedback): add location from store to useFeedbackSubmit` | `use-feedback-submit.ts`, `use-feedback-submit.test.ts`                                                                 | ~30          |
| 2   | `feat(messages): migrate to useFeedbackSubmit hook`            | `messages.tsx`                                                                                                          | ~35          |
| 3   | `feat(trip-detail): add geofence blocked banner and alert`     | `geofence-blocked-banner.tsx` (new), `geofence-blocked-banner.test.tsx` (new), `trip-detail-view.tsx`, `en.ts`, `es.ts` | ~120         |
| 4   | `chore(i18n): add common.ok key for alert buttons`             | `en.ts`, `es.ts`                                                                                                        | ~4           |

Total estimated: ~190 lines — comfortably within a single PR.

---

## Files summary

| File                                                                    | Action | Purpose                                        |
| ----------------------------------------------------------------------- | ------ | ---------------------------------------------- |
| `apps/mobile/src/hooks/use-feedback-submit.ts`                          | Modify | Add location from store to POST/queue          |
| `apps/mobile/src/hooks/__tests__/use-feedback-submit.test.ts`           | Modify | Add 5 location-coverage tests                  |
| `apps/mobile/src/app/(tabs)/messages.tsx`                               | Modify | Use `useFeedbackSubmit`, remove inline reducer |
| `apps/mobile/src/components/geofence-blocked-banner.tsx`                | Create | Blocked state banner component                 |
| `apps/mobile/src/components/__tests__/geofence-blocked-banner.test.tsx` | Create | Banner tests                                   |
| `apps/mobile/src/components/trip-detail-view.tsx`                       | Modify | Banner + blocked alert + disabled logic        |
| `apps/mobile/src/i18n/locales/en.ts`                                    | Modify | Add 3 new keys                                 |
| `apps/mobile/src/i18n/locales/es.ts`                                    | Modify | Add 3 new keys                                 |
