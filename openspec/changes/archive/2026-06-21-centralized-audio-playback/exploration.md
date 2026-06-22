## Exploration: Centralized Audio Playback

### Current State

**Three independent audio consumers**, each creating their own `useAudioPlayer` instance via `useImmersionPlayer`:

1. **`home-audio-player.tsx`** (Home tab `index.tsx`) — Instructions audio. Uses `useTrackDownload('instructions', instructionsUrl)` + `useImmersionPlayer()`. Dedicated inline UI (not `UnifiedAudioController`).

2. **`explore.tsx`** (hidden Explore tab) — First experience demo. Uses `useTrackDownload(experience.slug, experience.audioUrl)` + `useImmersionPlayer()`. Uses `AudioMediaControls` directly (not `UnifiedAudioController`) and `DownloadProgressCard` for download UI. The first experience is fetched and set on mount, so it auto-loads audio.

3. **`track-detail-view.tsx`** (Track detail `tracks/[id].tsx`) — Full track audio. Uses `useTrackDownload(track.id, track.audioUrl)` + `useImmersionPlayer()`. Uses `UnifiedAudioController` for download+play state machine.

**Two stateless UI components** (receive everything as props, untouched by centralization):

- `UnifiedAudioController` — download + play state machine. Receives `downloadStatus`, `playerStatus`, callbacks, etc.
- `AudioMediaControls` — play/pause/stop/rewind controls. Receives `status`, `positionMs`, `durationMs`, `onPlay`, etc.

**Existing zustand pattern**: `location-store.ts` uses `create<LocationStore>()` with side-effectful actions returning cleanup functions.

### Affected Areas

| File                                          | Why                                                                                                            |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/hooks/use-immersion-player.ts`           | Will be refactored — the hook becomes a thin consumer of the centralized store/context, or is removed entirely |
| `src/hooks/use-track-download.ts`             | Stays per-screen (downloads are track-specific). But feeds into the global player instead of a local one       |
| `src/components/home-audio-player.tsx`        | Must consume centralized player instead of creating its own `useImmersionPlayer`                               |
| `src/app/(tabs)/explore.tsx`                  | Must consume centralized player                                                                                |
| `src/components/track-detail-view.tsx`        | Must consume centralized player                                                                                |
| `src/components/unified-audio-controller.tsx` | **Stays unchanged** — stateless, props-based                                                                   |
| `src/components/audio-media-controls.tsx`     | **Stays unchanged** — stateless, props-based                                                                   |
| `src/app/_layout.tsx`                         | Likely mounting point for the provider/initializer                                                             |
| `src/store/`                                  | New store if using zustand approach                                                                            |
| `src/components/`                             | New context provider component if using context approach                                                       |

### Key Discovery: `createAudioPlayer` exists imperatively

`expo-audio` v56 provides `createAudioPlayer(source, options)` as an **imperative** (non-hook) function. This means the player instance can be created outside React's render cycle — at module level, in a zustand store, or in a context provider — without needing to call `useAudioPlayer` inside a component.

The `AudioPlayer` instance:

- Has imperative methods: `.play()`, `.pause()`, `.seekTo()`
- Emits `playbackStatusUpdate` events
- Can be passed to `useAudioPlayerStatus(player)` hook for reactive consumption
- Requires manual `.release()` to prevent memory leaks (unlike `useAudioPlayer` which auto-releases)

### Approaches

#### Approach A: Zustand Store + Thin Bridge Component

**Description**: Create a zustand `useAudioPlayerStore` that holds the player instance reference, reactive status, and control methods. A thin `AudioPlayerBridge` component mounts near the root, creates the player imperatively or via `useAudioPlayer`, runs `useAudioPlayerStatus`, and syncs everything to the store.

```
[AudioPlayerBridge]  ← mounts in _layout.tsx, creates 1 player, syncs to zustand
       │
       ▼
[Zustand AudioPlayerStore]  ← reactive status + player ref + control actions
       │
       ├── ▲ home-audio-player.tsx  (selects status, calls store.play(uri))
       ├── ▲ explore.tsx            (selects status, calls store.play(uri))
       └── ▲ track-detail-view.tsx  (selects status, calls store.play(uri))
```

**Reactive status flow**:

- `AudioPlayerBridge` calls `useAudioPlayer(source)` + `useAudioPlayerStatus(player)` → syncs to zustand every render
- Screens use zustand selectors: `useAudioPlayerStore(s => s.status)`, `useAudioPlayerStore(s => s.positionMs)`
- On `play(uri)`: store updates the player's source, calls `.play()`

**Pros**:

- Matches existing zustand pattern (`location-store.ts`)
- Fine-grained subscriptions via selectors (zundand's strength)
- No context nesting
- `home-audio-player.tsx` already has clean boundaries — easy to refactor
- Imperative `createAudioPlayer` enables this without hook constraints

**Cons**:

- The bridge component adds a layer (must be mounted at root)
- Two sources of truth risk (player internal state vs zustand state) if not careful
- Slightly more boilerplate than context
- Need to handle player `.release()` on bridge unmount

**Effort**: Medium

**"Interrupt existing playback" handling**: Store checks `if (status === 'playing')` before switching source. Can either auto-stop or show confirmation dialog via a separate zustand state field (`pendingInterrupt`). Screens check this field and render dialog if needed.

**Web support**: `createAudioPlayer` works on web via HTML5 Audio. `downloadFirst: false` for web URLs.

---

#### Approach B: React Context Provider

**Description**: Create an `AudioProvider` component that wraps the app at root level. It calls `useAudioPlayer` once and `useAudioPlayerStatus`, providing both controls and reactive state via `React.createContext` + `useContext`.

```
[AudioProvider]  ← wraps app, holds 1 AudioPlayer from useAudioPlayer
    │
    ├── ▲ home-audio-player.tsx  (useContext(AudioContext))
    ├── ▲ explore.tsx            (useContext(AudioContext))
    └── ▲ track-detail-view.tsx  (useContext(AudioContext))
```

**Pros**:

- Most idiomatic React pattern
- No two-state sync needed — `useAudioPlayerStatus` provides the single source of truth
- Provider naturally manages lifecycle (player created on mount, released on unmount)
- Less code than zustand + bridge

**Cons**:

- Context triggers re-renders on every status change (300ms+ updates) — all consumers re-render
- Can't do fine-grained subscriptions like zustand selectors
- Adding memo/separate contexts for different pieces of status adds complexity
- The shared-location-subscription design explicitly rejected context in favor of zustand for this reason

**Effort**: Low-Medium

**"Interrupt existing playback" handling**: Store a `pendingInterruptSource` in context state. Provider exposes `requestPlay(source)` which checks current state before switching.

**Web support**: Same as zustand — `useAudioPlayer` handles web via HTML5 Audio.

---

#### Approach C: Singleton Player Service (Imperative Only)

**Description**: Create a module-level singleton (`AudioPlayerService`) that creates one `AudioPlayer` via `createAudioPlayer()`. Exposes imperative methods and event-based subscriptions. Screens subscribe to events or poll a shared ref.

```
[AudioPlayerService]  ← module singleton, createAudioPlayer()
    │
    ├── ▲ home-audio-player.tsx  (useEffect subscribe, imperative calls)
    ├── ▲ explore.tsx
    └── ▲ track-detail-view.tsx
```

**Pros**:

- Works outside React render cycle
- Fully controllable lifecycle
- Zero React overhead

**Cons**:

- No reactive state — must bridge to React via `useState` + `useEffect` + event listeners
- Anti-pattern in React apps — fighting the framework
- Testing harder (module-level mutable state)
- Memory leak risk if not careful with listeners
- Doesn't integrate with React DevTools or error boundaries

**Effort**: High

**"Interrupt existing playback" handling**: Manual event-based interrupt flow.

**Web support**: `createAudioPlayer` works on all platforms.

---

### Recommendation

**Approach A: Zustand Store + Thin Bridge Component** — recommended.

**Why**:

1. **Pattern consistency**: The existing codebase chose zustand over context for shared state (`location-store.ts` design explicitly rejected context). We follow the same architectural pattern.
2. **Fine-grained subscriptions**: Audio status changes every 500ms (current `updateInterval`). Zustand selectors ensure only the consumer that needs `positionMs` re-renders, not all screens.
3. **Clean migration path**: Existing screens keep their download hooks. They replace `useImmersionPlayer()` with `useAudioPlayerStore()` selectors. `UnifiedAudioController` and `AudioMediaControls` remain completely unchanged.
4. **`createAudioPlayer` availability**: Since `expo-audio` provides imperative player creation, we avoid the "hooks restriction" problem entirely.
5. **Testable**: Zustand stores are easy to mock in tests (as the existing tests already mock `useImmersionPlayer`, they can mock `useAudioPlayerStore` instead with a similar pattern).

### Changes to `useImmersionPlayer`

The hook should NOT be removed — it should be **simplified** to a thin consumer of the zustand store:

```typescript
// Before: creates own useAudioPlayer instance
const player = useAudioPlayer(localAudioUri, { ... });

// After: consumes centralized store
const { status, positionMs, durationMs, play, pause, stop, seekTo } = useAudioPlayerStore();
```

This keeps a clean API for consumers while hiding the zustand dependency. The bridge component handles the actual player lifecycle.

### Download Architecture Decision

**Keep downloads per-screen.** Centralizing downloads would add significant complexity:

- Different tracks have different download lifecycles
- Delete operations are track-specific
- The download URI is already per-track state

Flow: Screen's `useTrackDownload` produces `localAudioUri` → screen calls `store.play(localAudioUri)` → store updates player source → player loads and plays. The download and play are decoupled.

### Risks

- **Player lifecycle**: Must ensure `.release()` is called when the bridge unmounts (app teardown or hot reload). Use a `useEffect` cleanup in the bridge component.
- **Source switching**: Changing `AudioPlayer.source` mid-playback must work. Need to test: does `player.play(newSource)` work, or do we need to pause → set source → play?
- **Confirmation dialog UX**: The "interrupt with confirmation" requirement needs careful thought. The store can hold a `pendingPlayRequest` state that screens check, but the dialog itself must be rendered somewhere (likely in each screen that initiates playback, or as a global overlay).
- **Web Audio session**: On web, `setAudioModeAsync` may not apply. The bridge should handle platform differences.
- **Race conditions**: Rapid play/pause/next-track calls could race if source switching is async.

### Ready for Proposal

**Yes** — all approaches have been analyzed, the recommended approach is clear, architectural constraints are understood, and `createAudioPlayer` enables the imperative creation needed for the zustand approach.
