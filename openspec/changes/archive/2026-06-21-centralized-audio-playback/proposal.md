# Proposal: Centralized Audio Playback

## Intent

Three screens create independent `useAudioPlayer` instances, preventing cross-screen audio control and wasting resources. Centralize into one player + one download manager for consistent behavior, background playback, and lock screen controls.

## Scope

### In Scope

- Single zustand audio player store using imperative `createAudioPlayer`
- `AudioPlayerBridge` component at root for player lifecycle + status sync
- `InterruptConfirmationModal` (reusable, "Cancel current audio and play new one?")
- Centralized download manager (max 3 concurrent, rest queued per track ID)
- Background playback + lock screen controls (play/pause, -10s, restart)
- `useImmersionPlayer` refactored to thin store consumer
- Home, Explore, Track Detail screens consume centralized store
- `UnifiedAudioController` and `AudioMediaControls` stay unchanged

### Out of Scope

- Position persistence (store supports `resume: true` in code — no persistence layer)
- Per-track download UI (remains per-screen)
- User preferences/settings for audio
- Download delete lifecycle management

## Capabilities

### New Capabilities

- `audio-player-service`: Centralized player via zustand store. Single instance, play/pause/seek/stop, interrupt confirmation, background playback, lock screen controls.
- `download-manager`: Centralized download orchestration with 3-concurrent limit, FIFO queue, per-ID status tracking.

### Modified Capabilities

- `home-audio-player`: Playback mechanism changes from local `useAudioPlayer` to centralized store consumer. Requirement #3 spec text needs updating.

## Approach

**Audio player**: `useAudioPlayerStore` holds player ref (from `createAudioPlayer`), reactive status (synced via `useAudioPlayerStatus` in `AudioPlayerBridge`), and control actions. `AudioPlayerBridge` mounts in `_layout.tsx`, creates player imperatively, syncs status to store on each `playbackStatusUpdate`, releases player on unmount cleanup.

**Download manager**: New zustand `useDownloadManagerStore` with `enqueue(id, url)`, max 3 concurrent workers, per-ID status. Screens subscribe per ID for download progress.

**Interrupt flow**: `play(uri)` checks current status. If playing, sets `pendingPlayRequest` in store. Screens render `InterruptConfirmationModal` when pending request exists. Confirm → store stops current + loads new + plays. Deny → clears request.

**Migration**: Screens replace `useImmersionPlayer()` with `useAudioPlayerStore()` selectors. The hook becomes a thin wrapper over the store for backward compat.

## Affected Areas

| Area                                                          | Impact   | Description                      |
| ------------------------------------------------------------- | -------- | -------------------------------- |
| `apps/mobile/src/store/audio-player-store.ts`                 | New      | Zustand player store             |
| `apps/mobile/src/store/download-manager-store.ts`             | New      | Zustand download store           |
| `apps/mobile/src/components/audio-player-bridge.tsx`          | New      | Player lifecycle bridge          |
| `apps/mobile/src/components/interrupt-confirmation-modal.tsx` | New      | Reusable interrupt dialog        |
| `apps/mobile/src/hooks/use-immersion-player.ts`               | Modified | Thin store consumer              |
| `apps/mobile/src/components/home-audio-player.tsx`            | Modified | Consume store                    |
| `apps/mobile/src/app/(tabs)/explore.tsx`                      | Modified | Consume store                    |
| `apps/mobile/src/components/track-detail-view.tsx`            | Modified | Consume store                    |
| `apps/mobile/src/app/_layout.tsx`                             | Modified | Mount bridge + player store init |

## Risks

| Risk                         | Likelihood | Mitigation                               |
| ---------------------------- | ---------- | ---------------------------------------- |
| Player leak on hot reload    | Medium     | `useEffect` cleanup in bridge            |
| Source switching race        | Low        | Serialize play requests in store action  |
| Modal stacking on rapid play | Low        | Single pending slot, one modal at a time |

## Rollback Plan

Revert store files and hook refactors. Each screen returns to own `useImmersionPlayer()`. Remove bridge from `_layout.tsx`. Single-commit revert.

## Dependencies

- `expo-audio` v56 (already installed)

## Success Criteria

- [ ] All 3 screens play through the same player instance
- [ ] Interrupt confirmation shows when playing + new play triggered
- [ ] 3 concurrent downloads, 4th+ queued, resolved in FIFO order
- [ ] Background audio continues on app close/lock
- [ ] Lock screen shows play/pause, -10s, restart
- [ ] `UnifiedAudioController` and `AudioMediaControls` unchanged
