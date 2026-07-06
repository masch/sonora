# Design: Web Admin Tabs Refactor

## Routing Structure

The admin web application routing is refactored from a flat hierarchy to a nested group layout:

- `apps/admin/src/app/_layout.tsx` (Root Stack layout)
  - `(tabs)/_layout.tsx` (TabLayout using `<AppTabs />`)
    - `index.tsx` (Translation editor)
    - `upload-audios.tsx` (Mockup audio upload page)
  - `login.tsx` (Unauthenticated screen)

## Theme & Styling

- Share same color variables as the mobile app via `src/constants/theme.ts`.
- Replicate `useColorScheme` and `useThemeColors` hooks to handle the theme state.
- Tab Buttons use `SymbolView` from `expo-symbols` for icons.
