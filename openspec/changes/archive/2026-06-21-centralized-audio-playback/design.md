# Design: Centralized Audio Playback

## Technical Approach

Single zustand store (`useAudioPlayerStore`) holds an imperative `AudioPlayer` created via `createAudioPlayer()`. An `AudioPlayerBridge` component mounts at the root `_layout.tsx`, creates the player, syncs reactive status to the store via `useAudioPlayerStatus()`, and releases on unmount. A separate `useDownloadManagerStore` handles download queuing (max 3 concurrent, FIFO). Interrupt flow uses a `pendingPlayRequest` slot in the player store with a reusable modal. Existing `useImmersionPlayer` becomes a thin store wrapper. `UnifiedAudioController` and `AudioMediaControls` remain untouched — they consume the same callbacks as today.

## Architecture Decisions

### Decision: Zustand over React Context for Player State

| Option            | Tradeoff                                                                                                                                        | Decision      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **Zustand store** | Already in deps (v5). No provider overhead. Fine-grained subscriptions. Easy to access outside components.                                      | ✅ **Chosen** |
| React Context     | Provider wrap at root needed. All consumers re-render on any change (unless split into multiple contexts). No `.getState()` outside components. | ❌ Rejected   |
| Singleton module  | No reactivity built in. Screens wouldn't automatically re-render on status change.                                                              | ❌ Rejected   |

**Rationale**: Zustand matches the existing store pattern (`location-store.ts`), avoids provider nesting, and enables `getState()` for imperative use in the bridge's cleanup.

### Decision: Bridge Component for Player Lifecycle

| Option                                | Tradeoff                                                                                                            | Decision      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------- |
| **AudioPlayerBridge component**       | Clean `useEffect` for mount/unmount. Hot reload safe. Player status synced via `useAudioPlayerStatus(player)` hook. | ✅ **Chosen** |
| `useEffect` in `_layout.tsx` directly | Works but mixes concerns — layout shouldn't own player lifecycle.                                                   | ❌ Rejected   |

**Rationale**: The bridge encapsulates player creation, status sync, and teardown. React's `useEffect` cleanup handles hot reload without leaks.

### Decision: Download Manager as Separate Store

| Option                                 | Tradeoff                                                           | Decision      |
| -------------------------------------- | ------------------------------------------------------------------ | ------------- |
| **Separate `useDownloadManagerStore`** | Decoupled concerns. Single responsibility. Can test independently. | ✅ **Chosen** |
| Merged into player store               | Unrelated state coupled. Store grows.                              | ❌ Rejected   |

### Decision: Single Pending Slot for Interrupt

Only one interrupt can be pending at a time. If a second `play()` fires while already pending, it replaces the previous pending request. This prevents modal stacking.

## Data Flow

### Player Lifecycle

```
_layout.tsx
  └── <AudioPlayerBridge />            ← mounts at app start
        ├── createAudioPlayer()        ← imperative, no hook
        ├── useAudioPlayerStatus(p)    ← subscribes to player events
        │     └── writes to store: status, positionMs, durationMs
        └── useEffect cleanup:
              └── player.release()

Screen (any)
  └── useAudioPlayerStore(selector)    ← subscribes to relevant slice
        └── actions: play(), pause(), stop(), seekTo()
```

### Interrupt Flow

```
User taps play(newUri)
  └── useAudioPlayerStore.getState().play(newUri)
        ├── store.checkInterrupt()
        │     └── if (status === 'playing'):
        │           ├── set({ pendingPlayRequest: newUri })
        │           └── return  ← wait for user confirmation
        │
        └── else: play immediately

Screen renders <InterruptConfirmationModal>
  └── visible = pendingPlayRequest !== null
  ├── Confirm → store.confirmInterrupt()
  │     ├── stop current (seekTo(0))
  │     ├── load new URI
  │     ├── play
  │     └── clear pendingPlayRequest
  └── Deny → store.cancelInterrupt()
        └── clear pendingPlayRequest
```

### Download Queue

```
enqueue(trackId, url)
  └── store.addToQueue({ trackId, url })
        └── if (activeDownloads.length < 3):
              ├── start download immediately
              └── add to activeDownloads
            else:
              └── add to queue (FIFO)

On download complete/error:
  └── remove from activeDownloads
  └── dequeue next → start

Screens subscribe: useDownloadManagerStore(s => s.downloads[trackId])
```

## File Changes

| File                                              | Action     | Description                                                                                                                                                               |
| ------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/store/audio-player-store.ts`                 | **Create** | Zustand store: `AudioPlayer` ref, status, actions (`play`, `pause`, `stop`, `seekTo`, interrupt). No React hooks inside — pure zustand.                                   |
| `src/store/download-manager-store.ts`             | **Create** | Zustand store: download queue, max 3 concurrent, per-ID status. Uses `expo-file-system` for actual download.                                                              |
| `src/components/audio-player-bridge.tsx`          | **Create** | Mounts at root. Creates `AudioPlayer` via `createAudioPlayer()`. Syncs status to store via `useAudioPlayerStatus()`. Calls `setAudioModeAsync` once. Releases on unmount. |
| `src/components/interrupt-confirmation-modal.tsx` | **Create** | Reusable modal using existing `BottomModal`. Reads `pendingPlayRequest` from player store. Renders confirm/deny.                                                          |
| `src/hooks/use-immersion-player.ts`               | **Modify** | Thin wrapper over `useAudioPlayerStore`. Same return type `ImmersionPlayerState`. Backward-compat — existing consumers need no changes.                                   |
| `src/components/home-audio-player.tsx`            | **Modify** | Already uses `useImmersionPlayer` — no changes needed after hook refactor.                                                                                                |
| `src/app/(tabs)/explore.tsx`                      | **Modify** | Already uses `useImmersionPlayer` — no changes needed after hook refactor.                                                                                                |
| `src/components/track-detail-view.tsx`            | **Modify** | Already uses `useImmersionPlayer` — no changes needed after hook refactor. Should add `<InterruptConfirmationModal />` if no parent handles it.                           |
| `src/app/_layout.tsx`                             | **Modify** | Import and mount `<AudioPlayerBridge />` inside `RootLayout`. Also mount `<InterruptConfirmationModal />` (or let screens handle it).                                     |
| `src/hooks/use-track-download.ts`                 | **Modify** | Refactor download logic from hook-local to delegate to `useDownloadManagerStore`. Keep same return type (`TrackDownloadState`) for backward compat.                       |

## Interfaces / Contracts

### `audio-player-store.ts`

```typescript
interface PendingPlayRequest {
  uri: string;
  resume?: boolean; // resume from previous position, default false
}

interface AudioPlayerState {
  status: PlayerStatus;
  positionMs: number;
  durationMs: number;
  errorMsg: string | null;
  currentUri: string | null;
  pendingPlayRequest: PendingPlayRequest | null;
}

interface AudioPlayerActions {
  play: (uri: string, resume?: boolean) => void;
  pause: () => void;
  stop: () => void;
  seekTo: (positionMs: number) => void;
  confirmInterrupt: () => void;
  cancelInterrupt: () => void;
  // Internal — called by bridge:
  _setPlayer: (player: AudioPlayer | null) => void;
  _syncStatus: (status: Partial<AudioPlayerState>) => void;
}

type AudioPlayerStore = AudioPlayerState & AudioPlayerActions;
```

### `download-manager-store.ts`

```typescript
type DownloadStatus = 'idle' | 'queued' | 'downloading' | 'completed' | 'error';

interface DownloadEntry {
  status: DownloadStatus;
  progress: number;
  localUri: string | null;
  errorMsg: string | null;
}

interface DownloadManagerState {
  downloads: Record<string, DownloadEntry>; // keyed by trackId
  queue: Array<{ trackId: string; url: string }>;
  activeCount: number;
  maxConcurrent: number; // = 3
}

interface DownloadManagerActions {
  enqueue: (trackId: string, url: string) => void;
  cancel: (trackId: string) => void;
  getDownload: (trackId: string) => DownloadEntry | undefined;
}

type DownloadManagerStore = DownloadManagerState & DownloadManagerActions;
```

### `audio-player-bridge.tsx` (contract)

```typescript
// No props. Reads/writes store via getState() + useAudioPlayerStatus().
// Responsibilities:
// 1. useEffect mount: createAudioPlayer() → store._setPlayer(player)
// 2. useAudioPlayerStatus(player) → store._syncStatus(...)
// 3. useEffect mount: setAudioModeAsync(immersion config)
// 4. useEffect unmount: player.release(), store._setPlayer(null)
```

## Testing Strategy

All tests use `@testing-library/react-native` with Jest. The `make validate` command runs `jest --passWithNoTests --watchAll=false`.

| Layer       | What to Test                                                                   | Approach                                                                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | `audio-player-store` actions (play, pause, stop, interrupt flow)               | Pure zustand: `useAudioPlayerStore.getState().play(...)` then assert `getState()` values. Mock `createAudioPlayer` return value.                                                                        |
| Unit        | `download-manager-store` queue logic (FIFO, max 3, status transitions)         | Pure zustand: enqueue 4 items, assert 3 active + 1 queued, complete one, assert next dequeued.                                                                                                          |
| Unit        | `interrupt-confirmation-modal` render + callbacks                              | Mock player store. Assert modal visible/hidden, confirm/cancel dispatch store actions.                                                                                                                  |
| Integration | `useImmersionPlayer` wrapper returns same shape                                | Unit test the thin wrapper — assert it maps store selectors to the same `ImmersionPlayerState` interface.                                                                                               |
| Integration | `HomeAudioPlayer` + `ExploreScreen` + `TrackDetailView`                        | These already use `useImmersionPlayer` — mock it as before. Tests should pass with **no changes** after hook refactor (backward compat). Add a test confirming `useImmersionPlayer` delegates to store. |
| E2E         | Cross-screen playback (play on Explore, navigate to Track, playback continues) | Manual test. Not automated — too many native dependencies (expo-audio, file system).                                                                                                                    |

**Mock approach for store tests**: Replace `use-immersion-player` mock with mock of `audio-player-store`. Store tests call `useAudioPlayerStore.getState()` directly — no mocking needed.

## Migration / Rollout

No phased rollout needed. This is a behind-the-scenes refactor:

1. **Create** store files + bridge + modal (greenfield, no existing code broken)
2. **Modify** `use-immersion-player` to be a thin wrapper — existing consumers compile and work
3. **Add** bridge + modal to `_layout.tsx` — no visual change until a play() triggers interrupt
4. **Verify** all existing tests pass unchanged (backward compat)
5. **Add** new tests for stores and interrupt modal

Rollback: Revert store files and bridge. `useImmersionPlayer` goes back to original. Screens untouched.

## Open Questions

- [ ] Where should `InterruptConfirmationModal` mount? Root `_layout.tsx` (covers all screens) vs each screen individually. Root is simpler — one modal, one connect to store.
- [ ] Does `expo-audio`'s `useAudioPlayerStatus` hook still work if called inside a child component of the bridge, or must the bridge call it directly? Need to verify — the hook subscribes to `player.playbackStatusUpdate` events.
- [ ] `setAudioModeAsync` — move to bridge or keep in `_layout.tsx`? Bridge makes sense since it owns the player, but `setAudioModeAsync` is a global session config.
