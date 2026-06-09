# Proposal: Normalize Screen UI to match Home screen aesthetics

## Motivation

The main screen (Home / `TripMap`) features a premium, dynamic, and immersive aesthetic with custom background images, banners, and glassmorphic panels. However, the `explore`, `settings`, and trip detail (`trip-detail-view`) screens use flat background colors and standard containers, resulting in an inconsistent visual experience.

## Proposed Changes

1. Apply the unified background image (`fondo-recorridos-sec-1.png`) to all screens.
2. Create a uniform top banner using `banner-fondo-logo-1.png` to maintain brand consistency.
3. Wrap all content containers in glassmorphic panels (`bg-white/80 backdrop-blur-md rounded-[24px] shadow-md`).
4. Replace all generic text elements with `ThemedText` using proper font weights (`font-extrabold`, `font-black`, `font-bold`) and colors (`text-zinc-800`, `text-zinc-600`) aligned with the Home screen.
5. Ensure strict compliance with localization (i18n) and accessibility rules.
