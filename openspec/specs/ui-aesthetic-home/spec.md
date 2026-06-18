# Specification: UI/UX Aesthetic and Home Screen Redesign

## 1. Theme and Color Palette

- The system must support a warm "field notebook" (cuaderno de campo) aesthetic.
- Light mode colors:
  - Background: `#F4EDE2` (warm cream)
  - Text: `#2B2826` (charcoal/pencil)
  - Background elements/containers: `#EBE4D8` (warm paper)
  - Selected states: `#DFD7C8`
  - Secondary text: `#76706B`
  - Links: `#8A6E53`
  - Borders: `rgba(43, 40, 38, 0.15)`
- Dark mode colors:
  - Background: `#1A1817`
  - Text: `#F4EDE2`
  - Background elements/containers: `#2B2826`
  - Selected states: `#3D3936`
  - Secondary text: `#A59E99`
  - Links: `#C6B29C`
  - Borders: `rgba(244, 237, 226, 0.15)`

## 2. Typography

- Standard system print sans-serif must be used for body readability (Inter/system).
- The cursive font `Caveat` must be used for artistic header and branding accents (e.g., subtitle, script texts).
- Android must map specific cursive font weights (Medium, SemiBold, Bold) to their respective system font file variants.

## 3. Home Screen

- The header must render the unified mockup image asset `home-unified-header.png` at `h-[380px]` with `contentFit="contain"`.
- The screen reader accessibility must be preserved by including hidden text layers for "SONORA" and the poetic subtitle.
- A "Continuar escuchando" direct borderless player card must be displayed with play/pause state indicator, track title, and progress bar.
- List menu items must navigate to the appropriate tabs/routes (e.g., `/tracks`, `/explore`).

## 4. Tracks/Recorridos Screen

- The original home screen content (`TripMap`) must be migrated to a dedicated `/tracks` tab screen.
- Both the tracks screen and the details view must not contain the repeating background image `fondo-recorridos-sec-1.png`.

## 5. Navigation & Global Theme

- Global navigation headers and screens must dynamically use the correct background and text colors from `RuntimeColors` depending on `colorScheme`.
- `useColorScheme()` must return an object with both the `scheme` name and `isDark` boolean to prevent code duplication.
