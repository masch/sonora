# Delta for Home Audio Player

## MODIFIED Requirements

### Requirement: 2. Download and Offline Support

Trigger download via `useDownloadManagerStore.enqueue(trackId, url)` when clicking the action button in the undownloaded state. Wait for store status to become `completed`, then play the audio using `useAudioPlayerStore.play(localAudioUri)`.
(Previously: Used local `useTrackDownload` hook with `startDownload()` and auto-played on completion.)

#### Scenario: Download triggered through centralized manager

- GIVEN audio is in undownloaded state
- WHEN user taps the download action button
- THEN `useDownloadManagerStore.enqueue(trackId, url)` is called
- AND download status becomes `queued` or `downloading`

#### Scenario: Auto-play after centralized download

- GIVEN download status becomes `completed`
- WHEN the store reports the download is finished
- THEN `useAudioPlayerStore.play(localAudioUri)` is called
- AND playback begins through the centralized player

#### Scenario: Download error state

- GIVEN `getStatus(trackId)` returns `error`
- WHEN download fails
- THEN the error is displayed and no play action is triggered

### Requirement: 3. Playback Controls (Downloaded State)

- **Play/Pause**: Toggle playback via `useAudioPlayerStore.play(uri)` and `useAudioPlayerStore.pause()`.
- **Rewind 10s**: Shift current playback position by -10,000ms using `useAudioPlayerStore.seekTo(positionMs - 10000)`.
- **Restart**: Reset current playback position to 0 using `useAudioPlayerStore.seekTo(0)`.
  (Previously: Used local `useImmersionPlayer` hook for all controls.)

#### Scenario: Play toggles through centralized store

- GIVEN audio is downloaded and ready
- WHEN user taps play
- THEN `useAudioPlayerStore.play(uri)` is invoked
- AND store `status` becomes `playing`

#### Scenario: Pause through centralized store

- GIVEN audio is playing
- WHEN user taps pause
- THEN `useAudioPlayerStore.pause()` is invoked
- AND store `status` becomes `paused`

#### Scenario: Rewind 10s

- GIVEN audio is at 30s
- WHEN user taps rewind
- THEN `seekTo(20000)` is called (clamped at 0)

#### Scenario: Restart

- GIVEN audio is at any position
- WHEN user taps restart
- THEN `seekTo(0)` is called
- AND playback continues from the beginning

## UNCHANGED Requirements

The following requirements from the main spec remain unchanged and are not modified by this change:

### Requirement: 1. Audio Source

- Stream or download from a configurable URL (`APP_CONFIG.audio.instructionsUrl`).
- Default mock URL: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3`.

### Requirement: 4. Progress Display

- Progress bar representing:
  - Download percentage while downloading (sourced from `useDownloadManagerStore` selector).
  - Playback percentage relative to total duration once downloaded (sourced from `useAudioPlayerStore` selector).
- Text representation:
  - Current time / duration (e.g. `0:30 / 2:00`) once downloaded.
  - Downloading status (e.g. `Downloading audio (45%)…`) while downloading.
  - Subtitle help text when idle.
