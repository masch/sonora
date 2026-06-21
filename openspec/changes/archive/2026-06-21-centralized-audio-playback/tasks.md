# Tasks: Centralized Audio Playback

## Review Workload Forecast

Estimated changed lines: 800-1100
400-line budget risk: High
Chained PRs recommended: Yes
Delivery strategy: ask-on-risk
Chain strategy: pending

Decision needed before apply: No (size:exception approved)
Chained PRs recommended: Yes (overridden by maintainer — size:exception)
Chain strategy: size-exception
400-line budget risk: High

### Suggested Work Units

| Unit | Goal                         | Likely PR   | Notes                                                                               |
| ---- | ---------------------------- | ----------- | ----------------------------------------------------------------------------------- |
| 1    | Core stores + tests          | PR 1 → main | audio-player-store.ts + download-manager-store.ts + test files                      |
| 2    | Bridge, modal, hooks, layout | PR 2 → main | bridge, modal, use-immersion-player refactor, use-track-download refactor, \_layout |

## Phase 1: Stores (RED → GREEN)

- [x] 1.1 RED: Write unit tests for `audio-player-store.ts` — play/pause/stop/seekTo and interrupt flow
- [x] 1.2 GREEN: Create `apps/mobile/src/store/audio-player-store.ts` with `AudioPlayerState` + actions
- [x] 1.3 RED: Write unit tests for `download-manager-store.ts` — enqueue, 3-concurrent, FIFO, per-ID status
- [x] 1.4 GREEN: Create `apps/mobile/src/store/download-manager-store.ts` with queue + expo-file-system integration

## Phase 2: UI Components (RED → GREEN)

- [x] 2.1 RED: Write render test for `interrupt-confirmation-modal.tsx` — visibility + confirm/deny callbacks
- [x] 2.2 GREEN: Create `apps/mobile/src/components/interrupt-confirmation-modal.tsx` using existing `BottomModal`
- [x] 2.3 GREEN: Create `apps/mobile/src/components/audio-player-bridge.tsx` with `createAudioPlayer()`, `useAudioPlayerStatus()`, `setAudioModeAsync()`, and `useEffect` cleanup

## Phase 3: Hook Refactors (RED → GREEN)

- [x] 3.1 RED: Write backward-compat test for `use-immersion-player.ts` — same `ImmersionPlayerState` return shape
- [x] 3.2 GREEN: Refactor `apps/mobile/src/hooks/use-immersion-player.ts` → thin `useAudioPlayerStore` wrapper
- [x] 3.3 RED: Write backward-compat test for `use-track-download.ts` — delegates to `useDownloadManagerStore`
- [x] 3.4 GREEN: Refactor `apps/mobile/src/hooks/use-track-download.ts` → internal delegation to download manager store

## Phase 4: Root Wiring

- [x] 4.1 GREEN: Mount `<AudioPlayerBridge />` + `<InterruptConfirmationModal />` in `apps/mobile/src/app/_layout.tsx`

## Phase 5: Verify

- [x] 5.1 Run `make validate` — tests pass (39 suites, 248 tests)

### No-Touch List (backward compat via hook interfaces)

- `home-audio-player.tsx`
- `explore.tsx`
- `track-detail-view.tsx`
- `UnifiedAudioController`
- `AudioMediaControls`
