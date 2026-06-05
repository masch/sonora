# Delta for nativewind-styling

## MODIFIED Requirements

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
- AND it MUST preserve the `@theme` block with Caveat, system-ui, ui-serif, ui-rounded, and ui-monospace font families
- AND `@theme` MUST define `--spacing-half` through `--spacing-six` tokens matching the Spacing constant values (2, 4, 8, 16, 24, 32, 64)
- AND web font `@import` statements MUST remain unchanged

(Previously: The `@theme` block referenced Spline Sans instead of Caveat.)
