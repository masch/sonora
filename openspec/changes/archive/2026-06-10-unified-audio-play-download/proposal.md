# Proposal: Unified Audio Play & Download Action

## Motivation

The Sonora application needs a simpler, more intuitive user experience for trip audio playback. Instead of having separate download and play buttons, a single action should initiate the download and automatically transition into playing the audio.

Additionally, the audio controller controls need modernization:

1. Reordering controls to place a "Reset" (restart to 0:00) button first.
2. Replacing the "Stop" button with a dedicated 10-second rewind button.
3. Making the rewind duration configurable via an application-wide configuration file.
4. Removing the "Delete" button from the trip details once audio is downloaded to prevent accidental deletions.

## Proposed Changes

1. **Configurable Offset**: Introduce a central configuration in `src/config/app-config.ts` defining `audio.rewindOffsetMs` (set to `10000`).
2. **Unified Audio Component**: Create `UnifiedAudioController` in `src/components/unified-audio-controller.tsx` which wraps the download progress indicator and playback control logic.
3. **Control Layout Improvements**: Reorder buttons in `AudioMediaControls` to: Reset (arrow.counterclockwise) -> Play/Pause -> Rewind (gobackward.10), removing the old Stop button.
4. **Detail Screen Integration**: Update `TripDetailView` to render the unified controller, manage local downloads, trigger autoplay upon download completion, and hide the "Delete" action.
5. **Localization & Testing**: Add required translation keys and update/write Jest tests to verify reset and rewind behaviors.
