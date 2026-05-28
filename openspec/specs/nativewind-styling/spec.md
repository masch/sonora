# nativewind-styling Specification

## Purpose

className-based component styling using Tailwind CSS v4 via NativeWind v5 preview across iOS, Android, and Web. This capability enables all future screens to use className instead of StyleSheet.create.

## Requirements

### Requirement: Build Infrastructure

The toolchain MUST configure Metro, PostCSS, and global CSS for NativeWind v5 compilation.

#### Scenario: Metro wraps with withNativewind
- GIVEN `metro.config.js`
- WHEN the app bundle compiles
- THEN the config MUST export `withNativewind()` wrapping the Expo config

#### Scenario: PostCSS applies tailwindcss/postcss
- GIVEN `postcss.config.mjs`
- WHEN PostCSS processes CSS
- THEN it MUST use the `@tailwindcss/postcss` plugin

#### Scenario: lightningcss is pinned
- GIVEN `package.json` overrides
- WHEN `bun install` completes
- THEN `lightningcss` MUST resolve to 1.30.1

#### Scenario: global.css imports Tailwind
- GIVEN `src/global.css`
- WHEN the app loads
- THEN it MUST include `@import "tailwindcss"`
- AND it MUST preserve the `@theme` block with Spline Sans, system-ui, ui-serif, ui-rounded, and ui-monospace font families
- AND `@theme` MUST define `--spacing-half` through `--spacing-six` tokens matching the Spacing constant values (2, 4, 8, 16, 24, 32, 64)
- AND web font `@import` statements MUST remain unchanged

### Requirement: Component Wrappers

The system MUST provide NativeWind-wrapped RN primitives for className prop support.

#### Scenario: Wrappers exist in src/tw/
- GIVEN `src/tw/` exports
- WHEN a screen imports from `src/tw/`
- THEN it MUST receive View, Text, ScrollView, Pressable, TextInput, and Image wrapped with `useCssElement`
- AND each MUST accept className and render with NativeWind styling

#### Scenario: TypeScript recognizes theme tokens
- GIVEN `nativewind-env.d.ts` exists
- WHEN TypeScript type-checks the project
- THEN custom colors, spacing, and fonts from the Tailwind `@theme` MUST be recognized

### Requirement: Tab Navigation

Three tabs MUST render on native and web platforms.

#### Scenario: Native tab bar shows 3 tabs
- GIVEN the app runs on iOS or Android
- WHEN the tab bar renders via `NativeTabs`
- THEN it MUST show Home, Explore, and Settings triggers

#### Scenario: Web tab bar shows 3 tabs
- GIVEN the app runs on web
- WHEN the tab bar renders via expo-router/ui
- THEN it MUST show Home, Explore, and Settings `TabTrigger` components

### Requirement: Dark Mode

The system MUST support NativeWind dark mode via `dark:` prefix classes.

#### Scenario: dark: classes apply in dark mode
- GIVEN a parent element has a `dark` class
- WHEN a child element uses `dark:text-white`
- THEN the child MUST render with the dark-mode text color

### Requirement: Settings Screen

The Settings screen MUST demonstrate className-only styling.

#### Scenario: Settings uses className exclusively
- GIVEN `src/app/settings.tsx`
- WHEN the screen renders
- THEN all visual styling MUST use className (no StyleSheet.create)
- AND the layout MUST be responsive across mobile and desktop widths

#### Scenario: Settings is navigable from tabs
- GIVEN the app is running with 3 tab triggers
- WHEN the user taps the Settings tab
- THEN route `/(tabs)/settings` MUST render
- AND the tab bar MUST indicate Settings as the active tab

### Requirement: Runtime Theme Removal

The system MUST NOT export `Colors`, `Fonts`, or `useTheme`. The only runtime color export SHALL be `RuntimeColors` (5 colors × 2 modes). Consumers MUST use `useColorScheme()` from `react-native` directly.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Colors removed | file imports `Colors` from `@/constants/theme` | `make typecheck` runs | fails with module-not-found |
| Fonts removed | file imports `Fonts` from `@/constants/theme` | `make typecheck` runs | fails with module-not-found |
| useTheme deleted | file imports `{ useTheme }` from `@/hooks/use-theme` | `make typecheck` runs | fails with module-not-found |
| use-color-scheme shim deleted | file imports from `@/hooks/use-color-scheme` | bundler resolves module on web | `.web.ts` SSR variant used; native resolves from `react-native` |

### Requirement: ThemeColor Type Migration

`ThemeColor` SHALL become a plain string union `'text' | 'textSecondary' | 'background' | 'backgroundElement' | 'backgroundSelected'`.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Valid string compiles | `<ThemedText themeColor="text">` | `make typecheck` runs | passes without error |
| Invalid string rejected | `<ThemedText themeColor="invalidColor">` | `make typecheck` runs | fails with type error |
