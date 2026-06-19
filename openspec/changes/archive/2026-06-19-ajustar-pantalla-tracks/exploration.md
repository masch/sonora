## Exploration: Adapt the tracks screen to match the mockup design

### Current State

Currently, the `TracksScreen` (`src/app/(tabs)/tracks.tsx`) only renders the `<TripMap />` component, showing a map instead of the track library requested in the mockup. The design requires a search input, category filters as tags/chips ("Todas", "Aves", "Historias", "Paisajes", "Poemas", "Comunidad", "Infancias"), and a detailed list of tracks with an image, title, track type, duration, and a three-dot menu button on the right.

### Affected Areas

- `/home/masch/dev/js/sonora/apps/mobile/src/app/(tabs)/tracks.tsx` — Replace the map with the search bar, category chips, and tracks list interface with their respective styling and interactions.
- `/home/masch/dev/js/sonora/apps/mobile/src/data/tracks.ts` — [NEW] Create mock data file containing the tracks shown in the design: "Tacuarita Azul", "El arroyo", "La piedra antigua", "Viento en los chañares", and "Voces del monte".
- `/home/masch/dev/js/sonora/apps/mobile/src/i18n/locales/es.ts` and `/home/masch/dev/js/sonora/apps/mobile/src/i18n/locales/en.ts` — Add translation strings for search placeholders, track titles, and categories.
- `/home/masch/dev/js/sonora/apps/mobile/src/__tests__/tracks.test.tsx` — [NEW] Create unit tests to verify rendering, filtering, and user interaction on the tracks screen.

### Approaches

1. **Interactive track list with local state** — Create a structured component that stores the active category filter and search query in local React state, filtering the mock data at render time.
   - Pros: Fast implementation, low coupling, high performance with instant client-side filtering.
   - Cons: None for the current scope.
   - Effort: Medium

### Recommendation

Approach 1 is recommended to achieve high fidelity with the provided mockup design.

### Risks

- Maintaining consistent styling for dark/light mode using Tailwind variables.
- Ensuring track images load correctly or use appropriate placeholders.

### Ready for Proposal

Yes
