# Specification: Global Audio Player

## Requirements

1. **Persistent Global Player Bar**:
   - The player bar must render above the bottom tab navigation on all screens where the tab bar is present, as well as standalone stack screens.
   - It must only display when there is an active `currentUri` and the audio status is either `'playing'` or `'paused'`.

2. **Visibility & Layout Hiding Rules**:
   - The player bar must automatically hide when the user views the detail/immersion screen (`/tracks/[id]` or `/trips/[id]`) of the _currently playing_ track or trip.
   - It must also hide when playing instructions on the Home screen tab.

3. **Controls**:
   - Play/Pause toggle on the right side.
   - Close (x) button on the left side to stop and clear playback state.
   - Real-time progress bar indicating percentage completed.

4. **Geofencing Bypass**:
   - Honor the remote config value `bypassGeofence` as the primary setting if available.
   - Fall back to the local `.env` configuration `EXPO_PUBLIC_BYPASS_GEOFENCE` during development.

## Scenarios

### Scenario 1: Toggle Playback from Mini Player

- **Given** audio is currently playing
- **When** the user taps the play/pause toggle button on the global player bar
- **Then** the audio must pause and the button icon must change to play.

### Scenario 2: Close Mini Player

- **Given** audio is playing or paused
- **When** the user taps the close button on the global player bar
- **Then** playback must stop, the player state must be cleared, and the global player bar must hide.

### Scenario 3: Automatically Hide on Currently Playing Detail Screen

- **Given** track `123` is currently playing
- **When** the user navigates to `/tracks/123`
- **Then** the global player bar must hide to avoid duplicate controls.
