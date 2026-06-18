# Exploration: UI/UX Aesthetic and Home Screen Layout

### Current State

Currently, the Home screen (`apps/mobile/src/app/(tabs)/index.tsx`) directly renders the `TripMap` component, which displays a top banner containing the Sonora logo, an instructions card, and a list of available trips. The styling is based on NativeWind/Tailwind CSS with variable-driven colors in `src/global.css`, defaulting to pure white `#ffffff` background and black `#000000` text, with custom font `Caveat` loaded as the sans-serif font.

### Affected Areas

- [global.css](file:///home/masch/dev/js/sonora/apps/mobile/src/global.css) — Define the new theme variables for the warm notebook palette (crema background, charcoal text, and adapted borders).
- [index.tsx](<file:///home/masch/dev/js/sonora/apps/mobile/src/app/(tabs)/index.tsx>) — Restructure to render the new Home screen layout (including the logo header, "Continuar escuchando" card, and list items for navigation) instead of directly rendering `TripMap`.

### Approaches

1. **Approach 1: Direct theme migration & page redesign** — Update the color tokens in `global.css` first, then replace the contents of `index.tsx` with the new design mockup (using custom icon wrappers and Card components styled with NativeWind).
   - Pros: Simple, fast, fully realizes the mockup aesthetic.
   - Cons: Moves a lot of files at once.
   - Effort: Medium

### Recommendation

Update `global.css` to define the warm "field notebook" colors, and implement the new home screen layout in `index.tsx` using semantic tailwind tokens.

### Risks

- Tab-bar style needs to align with the new warm colors to look premium.
- SVG/Assets for illustrations need to be imported or generated.

### Ready for Proposal

Yes
