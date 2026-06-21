## Exploration: Home audio player section

### Current State

Currently, `apps/mobile/src/app/(tabs)/index.tsx` (HomeScreen) displays a static "Continue Listening" card that links to the experiences screen (`/experiences?format=trip`). It displays a progress bar and remaining time, but does not allow inline playback or controlling the audio.

### Affected Areas

- `apps/mobile/src/app/(tabs)/index.tsx` — Add/integrate the interactive audio instructions player.
- [NEW] `apps/mobile/src/components/home-audio-player.tsx` — Component containing player logic (using `useImmersionPlayer` / `useAudioPlayer`), controls, and progress bar.
- `apps/mobile/src/i18n/locales/en.ts` — Translation strings in English.
- `apps/mobile/src/i18n/locales/es.ts` — Translation strings in Spanish.

### Approaches

1. **Direct inline rendering in index.tsx** — Embed all player hooks and buttons directly in the HomeScreen component.
   - Pros: No extra files, fast implementation.
   - Cons: HomeScreen becomes bloated, violates modularity/atomic design principles.
   - Effort: Low

2. **Separate HomeAudioPlayer component** — Create a dedicated component under `src/components` that uses existing custom audio player hooks (`useImmersionPlayer` / `useAudioPlayer`) and displays the layout.
   - Pros: Highly modular, clean architecture, easier unit testing.
   - Cons: Slightly more initial boilerplate.
   - Effort: Medium

### Recommendation

We recommend **Approach 2 (Separate HomeAudioPlayer component)** to keep the home screen code clean and modular, following atomic design conventions.

### Risks

- Audio source availability: The instructions audio must be loaded from a valid URL/asset. We can configure a default online instructions track or mock URL.
- State sharing: If other parts of the app also play audio (e.g. Experiences), we must ensure playback does not conflict. The `setupImmersionAudioSession` hook handles standard Expo audio configurations.

### Ready for Proposal

Yes
