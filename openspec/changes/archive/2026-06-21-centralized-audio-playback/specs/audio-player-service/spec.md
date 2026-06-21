# Specification: Audio Player Service

## Purpose

Centralizes audio playback into a single zustand store (`useAudioPlayerStore`) backed by an imperative `AudioPlayer` instance. Provides play/pause/seek/stop, interrupt confirmation flow, background playback, and lock screen controls. All screens consume the same player instance via store selectors.

## Requirements

### 1. Player Lifecycle

The system MUST create a single `AudioPlayer` instance via `createAudioPlayer()` in an `AudioPlayerBridge` component mounted at the app root (`apps/mobile/src/app/_layout.tsx`).

The audio mode MUST be configured once at startup with `shouldPlayInBackground: true`, `playsInSilentMode: true`, and `interruptionMode: 'doNotMix'`.

The player MUST be released when `AudioPlayerBridge` unmounts.

#### Scenario: Player created on bridge mount

- GIVEN the app renders `_layout.tsx`
- WHEN `AudioPlayerBridge` mounts
- THEN `createAudioPlayer()` is called with no initial source
- AND the player ref is stored in `useAudioPlayerStore`

#### Scenario: Player released on bridge unmount

- GIVEN a player instance exists
- WHEN `AudioPlayerBridge` unmounts (hot reload, navigation away)
- THEN the player resources are released

### 2. Status Synchronization

The system MUST sync player status to the store reactively via `useAudioPlayerStatus()` in `AudioPlayerBridge`.

The store MUST track: `status` (idle|loading|playing|paused|stopped|error), `positionMs`, `durationMs`, and `errorMsg`.

#### Scenario: Status updates propagate to store

- GIVEN the player is playing
- WHEN `playbackStatusUpdate` fires
- THEN `useAudioPlayerStatus` updates `positionMs` and `status` in the store

#### Scenario: Error state propagated

- GIVEN a playback error occurs
- WHEN `playbackStatusUpdate` reports the error
- THEN store `status` becomes `error` and `errorMsg` is set

### 3. Playback Controls

The store MUST expose actions: `play(uri: string)`, `pause()`, `seekTo(positionMs: number)`, and `stop()`.

`seekTo` SHALL accept milliseconds and convert to seconds internally.

`stop()` SHALL pause and seek to position 0.

#### Scenario: Play when idle

- GIVEN no audio is playing
- WHEN `play(uri)` is called
- THEN the player loads `uri` and begins playback
- AND store `status` becomes `playing`

#### Scenario: Pause and resume

- GIVEN audio is playing
- WHEN `pause()` is called
- THEN playback pauses
- AND WHEN `play(uri)` is called with the same URI
- THEN playback resumes from current position

#### Scenario: Seek to position

- GIVEN audio is loaded
- WHEN `seekTo(30000)` is called
- THEN playback position moves to 30s

#### Scenario: Stop resets position

- GIVEN audio is at 45s
- WHEN `stop()` is called
- THEN audio pauses and position resets to 0

### 4. Interrupt Confirmation

When `play(newUri)` is called while a different source is playing, the store SHALL set `pendingPlayRequest` with the new URI instead of playing immediately.

Screens SHALL render `InterruptConfirmationModal` when `pendingPlayRequest` is non-null. The modal SHALL show "Cancel current audio and play new one?" with Yes/No buttons.

Confirming SHALL stop current audio, load the new URI, and begin playback. Denying SHALL clear the pending request and leave current audio unchanged.

#### Scenario: Interrupt confirmed

- GIVEN audio is playing from URI "A"
- WHEN `play("B")` is called
- THEN `pendingPlayRequest` is set to "B"
- AND WHEN user taps "Yes"
- THEN current audio stops, URI "B" loads and plays
- AND `pendingPlayRequest` clears

#### Scenario: Interrupt denied

- GIVEN audio is playing and `pendingPlayRequest` is set
- WHEN user taps "No"
- THEN current audio continues unchanged
- AND `pendingPlayRequest` clears

#### Scenario: Rapid play requests use single slot

- GIVEN a `pendingPlayRequest` for URI "B" exists
- WHEN `play("C")` is called
- THEN `pendingPlayRequest` updates to "C" (only one modal at a time)

### 5. Background Playback

Playback SHALL continue when the app enters background or the device locks.

The system MUST NOT persist playback position across app restarts.

#### Scenario: Background playback continues

- GIVEN audio is playing
- WHEN user backgrounds the app
- THEN audio continues without interruption

#### Scenario: No position persistence

- GIVEN audio was playing at 30s
- WHEN the app is killed and relaunched
- THEN position starts at 0

### 6. Lock Screen Controls

Lock screen SHALL display play/pause, -10s rewind, and restart controls.

`restart` SHALL seek to position 0 and continue playing.

`rewind10s` SHALL subtract 10,000ms from current position, clamping at 0.

#### Scenario: Lock screen pause

- GIVEN audio is playing while device is locked
- WHEN user taps pause on lock screen
- THEN audio pauses
- AND WHEN user taps play
- THEN audio resumes from current position

#### Scenario: Lock screen rewind

- GIVEN audio is at 20s
- WHEN user taps -10s on lock screen
- THEN position moves to 10s

#### Scenario: Lock screen restart

- GIVEN audio is at 60s
- WHEN user taps restart on lock screen
- THEN position resets to 0 and playback continues
