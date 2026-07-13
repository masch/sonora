# Design: Global Audio Player

## Architecture & State flow

1. **Centralized Playback Hooks (`useCurrentExperience`)**:
   - Create a unified hook `useCurrentExperience` that aggregates the state from the active player store (`useAudioPlayerStore`).
   - Normalizes and exposes the active `experienceId`, status indicators (`isPlaying`, `isPaused`), and the active `metadata`.

2. **Global Layout Component**:
   - `GlobalAudioPlayer` is placed in the root layout stack to ensure it stays mounted and overlayed above the primary view hierarchy.
   - Computes visibility based on:
     - Player state (`isPlaying || isPaused`)
     - Route matching: parses the pathname dynamically using `usePathname()` from Expo Router, comparing active details screens `/tracks/[id]` with the active `experienceId`.
     - Inset height: calculates dynamic bottom offsets via `useSafeAreaInsets` to prevent overlaying the Android system navigation bar when rendering outside of tab views.
