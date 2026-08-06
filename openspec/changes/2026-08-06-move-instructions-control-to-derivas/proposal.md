# Proposal: Move Instructions Control from Home to Derivas Screen

## Intent

Relocate the instructions audio player control (`use-instructions-audio` / `HomeAudioPlayer`) from the main Home screen (`apps/mobile/src/app/(tabs)/index.tsx`) to the Derivas/Tip screen context.

## User Impact

- **Home Screen**: Instructions player is removed from Home, keeping the screen clean and focused on main content.
- **Derivas/Tip Screen**: The instructions audio control is accessible directly within the Derivas/Tip experience flow.

## Scope & Components

- `apps/mobile/src/app/(tabs)/index.tsx`: Remove `HomeAudioPlayer` / instructions control.
- Derivas Screen / Components: Integrate the instructions player control.
- Tests: Update relevant tests under `apps/mobile/src/__tests__/`.
