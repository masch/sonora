# Proposal: Adapt tracks screen to match design mockup

## Intent

Replace the current map component in the Tracks tab with an interactive track library that supports searching, category tag filtering, and a clean list showing track information (title, category, duration, image, and action menu).

## Scope

### In Scope

- Mock track data definition in `src/data/tracks.ts`.
- Implementation of the `TracksScreen` UI (`src/app/(tabs)/tracks.tsx`) with search bar, interactive category tags, and list.
- Translation strings for Spanish and English.
- Unit test suite for user interaction and filtering.

### Out of Scope

- Real audio playback functionality on this screen (to be implemented in future phases).
- Backend connection (uses in-memory local state).

## Capabilities

### New Capabilities

- `tracks-library`: Interactive audio track library with filtering.

### Modified Capabilities

None

## Approach

1. Mock the track dataset from the mockup in `src/data/tracks.ts`.
2. Code the layout using `Tw*` components to align with project conventions.
3. Use React hooks (`useState`, `useMemo`) for instant search and filtering.

## Affected Areas

| Area                        | Impact   | Description                                      |
| --------------------------- | -------- | ------------------------------------------------ |
| `src/data/tracks.ts`        | New      | Mock data for the tracks list.                   |
| `src/app/(tabs)/tracks.tsx` | Modified | Replace the map with the track list and filters. |
| `src/i18n/locales/es.ts`    | Modified | Translations for search and categories.          |
| `src/i18n/locales/en.ts`    | Modified | Translations for search and categories.          |

## Risks

| Risk                        | Likelihood | Mitigation                                            |
| --------------------------- | ---------- | ----------------------------------------------------- |
| Dark mode style consistency | Low        | Use Tailwind tokens and color-scheme utility classes. |

## Rollback Plan

`git checkout main -- src/app/(tabs)/tracks.tsx src/i18n/locales/ && rm src/data/tracks.ts`

## Success Criteria

- [ ] Tracks screen displays the centered title "TRACKS" at the top.
- [ ] Search input and category chips ("Todas", "Aves", "Historias", "Paisajes", "Poemas", "Comunidad", "Infancias") filter the list instantly.
- [ ] Each track row correctly displays its image, title, category, duration, and three-dot menu button.
