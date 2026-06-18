# Design: UI/UX Aesthetic and Home Screen Redesign

We will apply the field notebook (cuaderno de campo) theme and restructure the Home screen.

## Theme Colors (global.css)

We will modify `global.css` with the new color variables for both light and dark mode.

- **Light Mode (`:root`)**:
  - `--color-text`: `#2B2826` (Charcoal pencil)
  - `--color-background`: `#F4EDE2` (Warm cream paper)
  - `--color-backgroundElement`: `#EBE4D8` (Parchment elements)
  - `--color-backgroundSelected`: `#DFD7C8` (Warm selected item)
  - `--color-textSecondary`: `#76706B` (Softer pencil graphite)
  - `--color-link`: `#8A6E53` (Warm notebook brown)

- **Dark Mode (`@variant dark`)**:
  - `--color-text`: `#F4EDE2` (Cream paper)
  - `--color-background`: `#1A1817` (Dark charcoal)
  - `--color-backgroundElement`: `#2B2826` (Muted charcoal cards)
  - `--color-backgroundSelected`: `#3D3936` (Slightly lighter dark selected item)
  - `--color-textSecondary`: `#A59E99` (Secondary cream graphite)
  - `--color-link`: `#C6B29C` (Muted soft brown)

## Home Screen Layout (index.tsx)

We will redesign the Home screen using standard layout and themed components:

1. **Header**: Clean logo and title using `ThemedText` with Caveat font styling.
2. **Illustration Section**: Hand-drawn landscape illustration from the existing assets. We'll use a local image/logo asset styled appropriately.
3. **Continuar escuchando Card**: An attractive horizontal player state representation.
4. **List items**: Navigation triggers to `explore` and other relevant screens.
