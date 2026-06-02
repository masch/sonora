# Exploration: post-trip-offline-queue

## Current State

The Sonora app is a **greenfield Expo SDK 56** project with **no backend integration yet**. The app is entirely client-side:

- **No API client** or HTTP communication layer exists anywhere in the codebase
- **No network connectivity monitoring** (no NetInfo, no `navigator.onLine` usage)
- **No local structured storage** (no AsyncStorage, no SQLite, no IndexedDB)
- **No feedback form** or post-trip flow exists
- **No sync/queue mechanism** of any kind

The app currently has three tabs (Home, Explore, Settings), a trip detail route at `trips/[id]`, and a tripartite flow on each trip view: **GPS geofence → audio download → audio player**. The existing `useImmersionPlayer` hook from `expo-audio` exposes a `didJustFinish` signal that can detect audio completion — the natural trigger point for a post-trip feedback form.

Local persistence exists only for audio caching via `expo-file-system` (`FileSystem.documentDirectory + 'trips/{tripId}/audio.mp3'`).

The MVP prioritization plan (Phase 1, item 3) explicitly includes **"Offline Post-Trip Feedback Queue"** as a high-priority feature. The plan also mentions the backend architecture is still TBD — no API endpoints exist yet.

## Affected Areas

| File                                               | Why affected                                                                              |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/hooks/use-immersion-player.ts`                | `didJustFinish` signal is the trigger for showing the feedback form after audio completes |
| `src/app/(tabs)/index.tsx`                         | Where the current walk flow lives — feedback form would appear after playback ends        |
| `src/components/audio-media-controls.tsx`          | May need a "Feedback" state or pass-through callback when audio finishes                  |
| `src/components/`                                  | Need new `FeedbackForm` component (text input + submit)                                   |
| `src/hooks/use-offline-queue.ts` (new)             | New hook: manages queue persistence + sync lifecycle                                      |
| `src/data/`                                        | New queue storage abstraction (AsyncStorage or SQLite)                                    |
| `src/hooks/use-network-status.ts` (new)            | New hook: monitors online/offline transitions                                             |
| `package.json`                                     | New deps: `@react-native-async-storage/async-storage`, `@react-native-community/netinfo`  |
| `jest.setup.ts`                                    | New mocks for AsyncStorage and NetInfo                                                    |
| `src/i18n/locales/en.ts`, `src/i18n/locales/es.ts` | New translation keys for feedback form                                                    |
| `openspec/config.yaml`                             | No changes needed                                                                         |

## Approaches

### Approach 1: AsyncStorage + NetInfo Hook + Manual Flush

Store feedback queue entries as JSON in AsyncStorage. Use `@react-native-community/netinfo` to detect connectivity changes. Manually flush the queue when online.

- **Pros**: Simple implementation, no native module config needed, AsyncStorage is the standard Expo offline storage, well-tested in the community, already in jest transformIgnorePatterns
- **Cons**: AsyncStorage has 6MB limit on Android (ample for text), no background sync (only fires when app is active or returns to foreground), not ideal for large payloads
- **Effort**: Low-Medium

### Approach 2: SQLite (expo-sqlite) + Structured Queue

Use `expo-sqlite` for a proper SQLite-backed queue table. Store each message with status (`pending`, `syncing`, `synced`, `failed`), timestamps, and retry count.

- **Pros**: Reliable ACID storage, no size limits, queryable, supports status tracking, works well with background tasks, more robust retry logic
- **Cons**: Heavier dependency, more boilerplate, overkill for MVP (only text messages), adds ~150KB to bundle
- **Effort**: Medium-High

### Approach 3: Hybrid — AsyncStorage Queue + Background Sync via expo-background-fetch

Store queue in AsyncStorage (like Approach 1), but also register a background task via `expo-task-manager` + `expo-background-fetch` to attempt sync even when the app is not frontmost.

- **Pros**: Best UX — syncs without user action, covers iOS background constraints
- **Cons**: iOS background fetch is best-effort (not guaranteed), requires additional configuration, `expo-background-fetch` has ~15-minute minimum interval, more complex
- **Effort**: Medium

### Approach 4: FileSystem-based queue

Reuse `expo-file-system` (already a dependency) to write individual JSON files per message into a `queue/` directory, then read/enumerate them on sync.

- **Pros**: Zero new dependencies, filesystem is already used for audio downloads
- **Cons**: No atomic read-delete operations, race conditions on concurrent access, manual file enumeration, no built-in indexing, error-prone
- **Effort**: Medium

## Recommendation

**Approach 1 (AsyncStorage + NetInfo Hook + Manual Flush)** for the MVP, with the following design:

1. **New dependency**: `@react-native-async-storage/async-storage` (already in jest transformIgnorePatterns)
2. **New dependency**: `@react-native-community/netinfo` (already in jest transformIgnorePatterns)
3. **New hook**: `usePostTripFeedback(tripId)` — manages the feedback form lifecycle:
   - Accepts message text
   - Writes `{ id, tripId, message, createdAt, status: 'pending' }` to AsyncStorage
   - Key pattern: `@sonora/feedback_queue/<uuid>`
4. **New hook**: `useAutoSyncFeedback()` — monitors network via NetInfo:
   - On transition from offline → online, reads all pending queue entries
   - Attempts HTTP POST to configured backend endpoint
   - On success: deletes entry from AsyncStorage
   - On failure: leaves entry (retry on next online transition)
5. **UI**: New `FeedbackForm` component shown after `didJustFinish` fires from the player:
   - Text input + "Send when online" submit button
   - Visual status: pending count, last sync time
   - `LoadingView`-style feedback states (submitting, sent, error)
6. **API contract**: The feedback endpoint is TBD (no backend exists yet). The hook should accept a configurable submit URL. For now, queue locally and log to console — the actual HTTP call can be stubbed until the backend is built.

**Why this approach**:

- AsyncStorage is lightweight and idiomatic for Expo offline storage
- The MVP only stores short text messages — no relational data needs SQLite
- NetInfo monitoring on app foreground is sufficient for the MVP: users will eventually open the app again after the walk
- All new dependencies are already in the jest transformIgnorePatterns (pre-considered)
- Can be upgraded to Approach 3 (background fetch) later if needed
- Absolutely zero backend dependency — the queue works 100% offline

### Effort: Low-Medium

**Estimated implementation steps**:

1. Install `@react-native-async-storage/async-storage` and `@react-native-community/netinfo`
2. Create `src/hooks/use-offline-queue.ts` — generic queue CRUD backed by AsyncStorage
3. Create `src/hooks/use-network-status.ts` — NetInfo connectivity monitoring
4. Create `src/hooks/use-feedback-sync.ts` — auto-sync on online transition (stub POST to configurable endpoint)
5. Create `src/components/feedback-form.tsx` — text input + submit with status states
6. Integrate into the walk flow: detect `didJustFinish` from `useImmersionPlayer` → show `FeedbackForm`
7. Add translation keys for all new UI strings (en/es)
8. Add tests for all new hooks and components following existing patterns

## Risks

- **No backend exists yet**: The auto-sync mechanism must be designed to accept a configurable endpoint URL. The actual HTTP POST will be a no-op/stub until the backend is built. The queue itself works fully offline regardless.
- **AsyncStorage limit**: ~6MB on Android, but feedback is just text — highly unlikely to be an issue. Risk is negligible.
- **Web compatibility**: `@react-native-async-storage/async-storage` works via localStorage on web. Issue #9 in the roadmap mentions evaluating IndexedDB for iOS Safari — but that's a post-MVP concern. For the MVP, AsyncStorage on web (via localStorage) is adequate.
- **iOS background sync**: Without `expo-background-fetch`, sync only fires when the app is active. Acceptable for MVP — users will open the app to do other things after the walk.
- **No retry mechanism for transient failures**: Approach 1 keeps failed entries in the queue for the next online transition. If the backend is down, the entry remains pending indefinitely. Add a `retryCount` + `lastError` field to queue entries to avoid infinite retries.
- **Race condition on rapid online/offline transitions**: NetInfo may fire multiple events. The sync handler must be idempotent and debounced.

## Ready for Proposal

**Yes**. The exploration is complete. The orchestrator should proceed to `sdd-propose` with Approach 1 (AsyncStorage + NetInfo Hook + Manual Flush) as the recommended path.

Key points for the proposal:

- All dependencies are already anticipated in `jest.transformIgnorePatterns`
- The feature aligns with the existing MVP Phase 1 roadmap
- No backend dependency — the queue works now, the HTTP sync stub can be wired later
- The `didJustFinish` signal from `expo-audio` is the natural trigger point
- The feature is isolated: new hooks + one new component, minimal modifications to existing code
