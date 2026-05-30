# Tasks: NativeWind Tabs Setup

## Review Workload Forecast

| Field                   | Value       |
| ----------------------- | ----------- |
| Estimated changed lines | ~330        |
| 400-line budget risk    | Low         |
| Chained PRs recommended | No          |
| Suggested split         | Single PR   |
| Delivery strategy       | ask-on-risk |
| Chain strategy          | pending     |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                                     | Likely PR | Notes                                        |
| ---- | ---------------------------------------- | --------- | -------------------------------------------- |
| 1    | Complete NativeWind infra + tabs + tests | PR 1      | Single PR — under 400 lines, no split needed |

## Phase 1: Infrastructure

- [x] 1.1 Add `nativewind@preview`, `react-native-css`, `tailwindcss@4`, `@tailwindcss/postcss`, `postcss` deps + `lightningcss@1.30.1` override to `package.json`; run `bun install`
- [x] 1.2 Create `metro.config.js` — export `withNativewind(getDefaultConfig(__dirname), { input: "./src/global.css" })`
- [x] 1.3 Create `postcss.config.mjs` — default export with `@tailwindcss/postcss` plugin
- [x] 1.4 Replace `src/global.css` — `@import "tailwindcss/theme.css"`, `@import "tailwindcss/preflight.css"`, `@import "tailwindcss/utilities.css"`, `@import "nativewind/theme"`, `@theme` with 4 font families, `@variant dark`
- [x] 1.5 Create `nativewind-env.d.ts` — triple-slash directive for `nativewind/types`

## Phase 2: CSS-Wrapped Components

- [x] 2.1 Create `src/tw/index.tsx` — export `TwView`, `TwText`, `TwScrollView`, `TwPressable`, `TwTextInput` via `useCssElement` from `react-native-css`
- [x] 2.2 Create `src/tw/image.tsx` — export `TwImage` wrapping `Image` from `expo-image` with `useCssElement`
- [x] 2.3 Create `src/tw/animated.tsx` — export `TwAnimatedView` using Reanimated `Animated.View` wrapped with `useCssElement`

## Phase 3: Tabs + Demo Screen

- [x] 3.1 Add `<NativeTabs.Trigger name="settings">` to `src/components/app-tabs.tsx` with label "Settings"
- [x] 3.2 Add `<TabTrigger name="settings" href="/settings">` to `src/components/app-tabs.web.tsx`
- [x] 3.3 Create `src/app/settings.tsx` — route using Tw components, className-only styling, responsive layout, dark mode classes
- [x] 3.4 Update `src/app/index.tsx` header to use TwText with className (minimal)
- [x] 3.5 Update `src/app/explore.tsx` header to use TwText with className (minimal)

## Phase 4: Testing

- [x] 4.1 Test: CSS-wrapped components render with className prop
- [x] 4.2 Test: Native tab bar renders 3 triggers
- [x] 4.3 Test: Web tab bar renders 3 triggers
- [x] 4.4 Verify `bun install` succeeded with lightningcss override; run `make validate` (test + tsc pass; pre-existing lint error in `use-color-scheme.web.ts`)
