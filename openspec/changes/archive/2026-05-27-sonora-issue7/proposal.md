# Proposal: Replace PNG tab icons with platform-native icon systems

**Status**: Draft
**Issue**: [#7](https://github.com/masch/sonora/issues/7)
**Created**: 2026-05-27

## Intent

Replace all PNG-based tab icons with platform-appropriate vector icon systems to eliminate raster assets, reduce bundle size, and provide consistent iconography across platforms.

## Scope

- **Native tabs** (`app-tabs.tsx`): migrate from `require('@/assets/images/tabIcons/*.png')` to Ionicons via `@expo/vector-icons`
- **Web tabs** (`app-tabs.web.tsx`): add icons via `expo-symbols` SymbolView with platform-specific names (SF Symbols for iOS, Material Icons for Android/web)
- **New `Icon` component**: extract a reusable `Icon` wrapper around `SymbolView` for future use
- **Cleanup**: delete `assets/images/tabIcons/` (9 PNG files, all resolutions)

## Out of scope

- Other SVG or icon system migrations beyond tabs
- Animation or interactive icon states
- Dark mode icon variants (template rendering handles this)

## Approach

### Native (iOS + Android real device)

Use `NativeTabs.Trigger.VectorIcon` with `Ionicons` from `@expo/vector-icons`. This is the standard approach for Expo native tab bars — cross-platform, vector-based, no raster assets.

### Web (browser)

Use `expo-symbols` SymbolView with a platform-discriminated name object `{ ios, android, web }` so the same component renders the correct icon on every browser/platform.

Create a reusable `Icon` component that wraps `SymbolView` to avoid repeating the `{ ios, android, web }` object pattern.

## Risks

- `SymbolView` names differ between iOS (SF Symbols) and Android/web (Material Icons) — easy to forget the `android` or `web` key, causing invisible icons on that platform
- PNG assets must be fully removed from all imports before deletion to avoid build errors
