# Proposal: Home Audio Player Section

## Intent

Replace the static "Continue Listening" section on the Home screen with an interactive inline audio player. This allows users to listen to audio instructions on the spot with play/pause, rewind 10 seconds, restart from the beginning, and a progress bar showing the position and total duration.

## Scope

### In Scope

- Create a new component `apps/mobile/src/components/home-audio-player.tsx` that contains the layout, progress bar, playback timing, and compact controls (play/pause, rewind 10s, restart), and also handles downloading states.
- Integrate `useTrackDownload` and `useImmersionPlayer` in the new component to download instructions and play them offline.
- Configure a default mock audio instructions URL in `apps/mobile/src/config/app-config.ts` (e.g. `APP_CONFIG.audio.instructionsUrl`).
- Replace the static card inside `apps/mobile/src/app/(tabs)/index.tsx` with the new interactive `HomeAudioPlayer` component.
- Add English and Spanish translation keys for controls, status, downloading, and instructions label.

### Out of Scope

- Deep link routing when tapping the controls (tapping the audio player handles playback, not navigation).

## Capabilities

### New Capabilities

- `home-audio-player`: Compact inline audio player on the home screen.

### Modified Capabilities

- `home-screen`: The static "Continue Listening" section is now an interactive audio player.

## Approach

1. Add a configurable `instructionsUrl` property to `apps/mobile/src/config/app-config.ts` (or utilize a default publicly available test audio track).
2. Create `apps/mobile/src/components/home-audio-player.tsx` using `useTrackDownload` (with trackId `"instructions"`) and `useImmersionPlayer` with the downloaded local URI.
3. Implement the UI layout in `HomeAudioPlayer`:
   - If not downloaded, show a Play/Download button. When clicked, trigger download and automatically start playing upon completion.
   - If downloading, show a progress bar indicating download progress.
   - If downloaded, show controls (Play/Pause, Rewind 10s, Restart) and a progress bar representing playback position.
4. Replace the hardcoded continue-listening block in `apps/mobile/src/app/(tabs)/index.tsx` with `<HomeAudioPlayer />`.
5. Update `es.ts` and `en.ts` locales files to define the texts and label keys.

## Affected Areas

| Area                                               | Impact   | Description                                             |
| -------------------------------------------------- | -------- | ------------------------------------------------------- |
| `apps/mobile/src/config/app-config.ts`             | Modified | Add configurable instruction audio URL.                 |
| `apps/mobile/src/components/home-audio-player.tsx` | New      | Compact audio player component.                         |
| `apps/mobile/src/app/(tabs)/index.tsx`             | Modified | Replace static card with the new interactive component. |
| `apps/mobile/src/i18n/locales/en.ts`               | Modified | Add English translations.                               |
| `apps/mobile/src/i18n/locales/es.ts`               | Modified | Add Spanish translations.                               |

## Risks

| Risk                                   | Likelihood | Mitigation                                                                                                               |
| -------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| Audio streaming failure                | Low        | Display appropriate error/status states if the remote URL fails to load.                                                 |
| Multiple audios playing simultaneously | Medium     | Ensure when the home player is active, other playback sessions are stopped, or standard interruption handling is active. |

## Rollback Plan

`git checkout main -- apps/mobile/src/app/(tabs)/index.tsx apps/mobile/src/config/app-config.ts apps/mobile/src/i18n/locales/en.ts apps/mobile/src/i18n/locales/es.ts && rm apps/mobile/src/components/home-audio-player.tsx`

## Success Criteria

- [ ] The Home screen displays the "Continue Listening" section with interactive play, pause, rewind, and restart buttons.
- [ ] Tapping play streams the configurable instructions audio file.
- [ ] Rewind button shifts position back by 10 seconds.
- [ ] Restart button resets playback position to 0.
- [ ] Progress bar updates dynamically as the audio plays.
