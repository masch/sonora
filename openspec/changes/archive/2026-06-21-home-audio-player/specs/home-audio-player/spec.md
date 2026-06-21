# Specification: Home Audio Player Section

## Functional Requirements

### 1. Audio Source

- Stream or download from a configurable URL (`APP_CONFIG.audio.instructionsUrl`).
- Default mock URL: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3`.

### 2. Download and Offline Support

- Trigger download using `useTrackDownload` when clicking the action button in the undownloaded state.
- Automatically start playing the audio once download completes.

### 3. Playback Controls (Downloaded State)

- **Play/Pause**: Toggle playback using `useImmersionPlayer`.
- **Rewind 10s**: Shift current playback position backward by 10,000ms.
- **Restart**: Reset current playback position to 0.

### 4. Progress Display

- Progress bar representing:
  - Download percentage while downloading.
  - Playback percentage relative to total duration once downloaded.
- Text representation:
  - Current time / duration (e.g. `0:30 / 2:00`) once downloaded.
  - Downloading status (e.g. `Downloading audio (45%)…`) while downloading.
  - Subtitle help text when idle.
