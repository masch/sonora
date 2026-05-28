# Delta for nativewind-styling

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Build Infrastructure

The toolchain MUST configure Metro, PostCSS, and global CSS for NativeWind v5 compilation.
(Previously: only color and font tokens in @theme; now also spacing tokens)

#### Scenario: global.css imports Tailwind
- GIVEN `src/global.css`
- WHEN the app loads
- THEN it MUST include `@import "tailwindcss"`
- AND it MUST preserve the `@theme` block with Spline Sans, system-ui, ui-serif, ui-rounded, and ui-monospace font families
- AND `@theme` MUST define `--spacing-half` through `--spacing-six` tokens matching the Spacing constant values (2, 4, 8, 16, 24, 32, 64)
- AND web font `@import` statements MUST remain unchanged

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

### Requirement: Component Wrappers

The system MUST provide NativeWind-wrapped RN primitives for className prop support.
(Previously: only color and font tokens autocomplete; now also spacing tokens)

#### Scenario: Wrappers exist in src/tw/
- GIVEN `src/tw/` exports
- WHEN a screen imports from `src/tw/`
- THEN it MUST receive View, Text, ScrollView, Pressable, TextInput, and Image wrapped with `useCssElement`
- AND each MUST accept className and render with NativeWind styling

#### Scenario: TypeScript recognizes theme tokens
- GIVEN `nativewind-env.d.ts` exists
- WHEN TypeScript type-checks the project
- THEN custom colors, spacing, and fonts from the Tailwind `@theme` MUST be recognized

## REMOVED Requirements

(No requirements removed from the nativewind-styling spec.)

## Acceptance Criteria

- [ ] `make typecheck` and `make lint` pass with zero errors
- [ ] Light + dark mode rendering identical on iOS, Android, and Web
- [ ] Zero imports of `Colors`, `Fonts`, `useTheme`, `use-color-scheme` (the shim)
- [ ] No `ThemeColor` type exported from `src/constants/theme.ts`
- [ ] `--spacing-half` through `--spacing-six` resolve in className on all platforms
- [ ] `BottomTabInset + Spacing.three` style prop expression is unchanged
