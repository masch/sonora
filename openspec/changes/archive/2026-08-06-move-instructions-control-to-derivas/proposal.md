# Proposal: Move Instructions Control from Home to Derivas Screen

## Intent

Relocate the instructions audio player control (`HomeAudioPlayer`) from the main Home screen (`apps/mobile/src/app/(tabs)/index.tsx`) to the Derivas/Tip screen context, positioning it below search and category filter controls while removing instructions from the general experience list. Also deprecate/remove the `showHomeInstructions` RemoteConfig property.

## User Impact

- **Home Screen**: Instructions player is removed, leaving a clean navigation menu.
- **Derivas/Tip Screen**: Instructions audio control is permanently available below the search bar and filter chips, rather than listed as a regular experience card.

## Scope & Components

- `apps/mobile/src/app/(tabs)/index.tsx`: Remove `HomeAudioPlayer` / instructions control.
- `apps/mobile/src/components/experiences-view.tsx`: Position `HomeAudioPlayer` below filter chips and search input.
- `packages/shared/src/schemas/config.ts`: Remove `showHomeInstructions` from RemoteConfig schema and default values.
- `apps/api/src/db/seed.ts`: Unpublish instructions seed experience.
