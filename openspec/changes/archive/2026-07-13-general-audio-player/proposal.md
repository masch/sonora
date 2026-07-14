# Proposal: Global Audio Player

## Intent

Improve the general audio playback experience by displaying a persistent, compact audio player bar across the application screens (specifically above the tab navigation) when audio is currently playing or paused, providing quick controls and visibility of current progress similar to the Waking Up app.

## Scope

### In Scope

- A persistent `GlobalAudioPlayer` component displayed above the bottom tab bar.
- Only visible when the audio status is `playing` or `paused` and there is a `currentUri`.
- Features:
  - Close button `(x)` on the left to stop playback.
  - Current audio title in the center.
  - Play/pause toggle button on the right.
  - A thin progress bar line indicating the playback progress at the top of the player bar.
- Fully compatible with `useAudioPlayerStore` state and operations.
- Update `ScreenWrapper`/layouts to adjust padding and prevent layout overlap.

### Out of Scope

- Expanding the mini player into a full-screen view (deferred to full player screen `tracks/[id]`).
- Custom audio controls customization per-screen.

## Capabilities

### New Capabilities

- `global-audio-player`: A persistent mini audio player component shown above the tab navigation across all major screens.

### Modified Capabilities

None

## Approach

1. Create a `GlobalAudioPlayer` component in `apps/mobile/src/components/global-audio-player.tsx`.
2. Connect it to `useAudioPlayerStore` to read `status`, `positionMs`, `durationMs`, `currentMetadata`, and trigger `play()`, `pause()`, `stop()`.
3. Render the layout: a full-width container positioned above the bottom tab bar with:
   - A top thin progress bar using the percentage `positionMs / durationMs`.
   - Close icon, Title text, and Play/Pause icon.
4. Mount `GlobalAudioPlayer` inside `apps/mobile/src/app/(tabs)/_layout.tsx` to automatically display it above the tab bar.
5. Adjust screen wrappers if needed to ensure the bottom content is not obscured.

## Affected Areas

| Area                                                 | Impact   | Description                                         |
| ---------------------------------------------------- | -------- | --------------------------------------------------- |
| `apps/mobile/src/app/(tabs)/_layout.tsx`             | Modified | Mount the persistent `GlobalAudioPlayer` component. |
| `apps/mobile/src/components/global-audio-player.tsx` | New      | Implement the new global mini player component.     |

## Risks

| Risk                            | Likelihood | Mitigation                                                            |
| ------------------------------- | ---------- | --------------------------------------------------------------------- |
| Layout overlap with tab content | Medium     | Add bottom padding to scroll/screen containers when player is active. |

## Rollback Plan

Revert git changes to `apps/mobile/src/app/(tabs)/_layout.tsx` and delete `apps/mobile/src/components/global-audio-player.tsx`.

## Success Criteria

- [ ] The global mini player is displayed when audio is playing or paused.
- [ ] Tapping play/pause toggles playback correctly.
- [ ] Tapping the close `(x)` button stops playback and hides the player.
- [ ] The progress bar updates in real time.
