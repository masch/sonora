# Design: Home Audio Player Section

## Context

We are replacing the static "Continue Listening" section on the Home screen with an interactive inline audio player. The player must support offline playback by downloading the audio instructions file locally.

## Architecture

We will create a new component `HomeAudioPlayer` which integrates:

1. `useTrackDownload` with a fixed track ID `'instructions'` and the configurable URL.
2. `useImmersionPlayer` which binds to the `localAudioUri` output of the download hook once downloaded.

```
+-----------------------------------------------------------+
| HomeScreen                                                |
|                                                           |
|  +-----------------------------------------------------+  |
|  | HomeAudioPlayer                                     |  |
|  |                                                     |  |
|  |  [Play/Pause/Download Icon]                         |  |
|  |  "River path"                                       |  |
|  |  Current Time / Duration (or Downloading status)    |  |
|  |  [Rewind 10s] [Restart] (compact controls)          |  |
|  |                                                     |  |
|  |  ================================== [Progress Bar]  |  |
|  +-----------------------------------------------------+  |
+-----------------------------------------------------------+
```

## State Flow

1. **Initial State (not downloaded)**:
   - `download.status` = `'idle'`
   - Action icon = `'play.fill'`
   - Progress bar = `0%`
   - Subtitle = `'Cargá las instrucciones para escuchar'` (or `'Load instructions to listen'`)

2. **Downloading State**:
   - `download.status` = `'downloading'`
   - Action icon = `'arrow.down.circle.fill'` (with downloading state)
   - Progress bar = `download.progress`
   - Subtitle = `'Descargando audio (X%)…'`

3. **Ready/Playback State (download completed)**:
   - `download.status` = `'completed'`
   - `localAudioUri` is passed to `useImmersionPlayer`
   - Shows action icon (`play.fill` or `pause.fill` depending on playback status)
   - Shows compact rewind/restart controls
   - Timing text shows `position / duration`
   - Progress bar shows playback position percentage
