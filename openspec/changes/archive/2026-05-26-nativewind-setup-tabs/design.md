# Design: NativeWind Tabs Setup

## Technical Approach

Add NativeWind v5 preview (Tailwind CSS v4, CSS-first, no Babel) incrementally: install deps, wrap Metro config, replace `global.css` with Tailwind imports, create `src/tw/` CSS-wrapped component wrappers, and demonstrate with a 3rd Settings tab className across all 3 screens.

## Architecture Decisions

### Metro Config Wrapping

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `withNativewind(config, { input })` | v5 preview — minimal options, CSS input path only | **Use it** — matches v5 API |
| Custom transformer | Overcomplicates, bypasses Expo defaults | Rejected |

Uses `withNativewind` from `nativewind/metro`, pointing `input` at `src/global.css`.

### CSS Strategy — Existing global.css

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Replace with `@import "tailwindcss"` | Inline font vars via `@theme` | **Replace** — v5 CSS-first requires this |
| Import both files | Double CSS, unclear ownership | Rejected |

Replace `src/global.css` with Tailwind v4 `@import "tailwindcss"` + `@theme` block preserving the 4 font families from the current file. The existing `import '@/global.css'` in `theme.ts` stays — it's what makes CSS custom properties work on web.

### CSS-Wrapped Components — `src/tw/`

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `src/tw/index.tsx` + `image.tsx` + `animated.tsx` | Central re-export, one import for all className-able components | **Use it** — convention from proposal |
| Inline `css()` in each component | Repetition, hard to audit | Rejected |

Each file uses `css()` from `react-native-css` wrapping the RN primitive:

```tsx
// src/tw/index.tsx
import { css } from "react-native-css";
import { View, Text, ScrollView, Pressable, TextInput } from "react-native";

export const TwView = css(View);
export const TwText = css(Text);
export const TwScrollView = css(ScrollView);
export const TwPressable = css(Pressable);
export const TwTextInput = css(TextInput);
```

Naming: `Tw` prefix avoids collision with existing `ThemedView`/`ThemedText`.

### Tab Architecture — Adding 3rd Trigger

| Platform | File | Change |
|----------|------|--------|
| Native | `app-tabs.tsx` | Add `<NativeTabs.Trigger name="settings">` — same pattern as existing Home/Explore |
| Web | `app-tabs.web.tsx` | Add `<TabTrigger name="settings" href="/settings">` — same pattern, route `/settings` |

New route: `src/app/settings.tsx` — no nested directory, keeps flat route structure.

### Fonts in `@theme`

Map existing platform-conditional fonts to Tailwind theme:

```css
@theme {
  --font-display: "Spline Sans", Inter, ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace;
  --font-rounded: "SF Pro Rounded", "Hiragino Maru Gothic ProN", Meiryo, "MS PGothic", sans-serif;
  --font-serif: Georgia, "Times New Roman", serif;
}
```

Web uses CSS variables inherited from these. iOS/Android fall through to system fonts via the Tailwind default `font-family` cascade. The existing `Fonts` constant in `theme.ts` is untouched (out of scope for migration).

### Dark Mode

Use Tailwind v4's native `@variant dark` support. Reference CSS custom properties for theming:

```css
@variant dark {
  :root { --color-bg: #000; --color-text: #fff; }
}
```

This lets `dark:bg-zinc-900` or `dark:text-white` work via className. The existing `useTheme()` hook and `ThemeProvider` remain active — dark mode classes are additive, not a replacement.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | Add `nativewind@preview`, `react-native-css`, `tailwindcss`, `@tailwindcss/postcss`, `postcss`; add `overrides` for `lightningcss@1.30.1` |
| `metro.config.js` | Create | Export `withNativewind(getDefaultConfig(__dirname), { input: "./src/global.css" })` |
| `postcss.config.mjs` | Create | ES module PostCSS config with `@tailwindcss/postcss` |
| `src/global.css` | Replace | `@import "tailwindcss"`, `@theme` block with fonts, `@variant dark` with CSS vars |
| `src/tw/index.tsx` | Create | Wrapped View, Text, ScrollView, Pressable, TextInput |
| `src/tw/image.tsx` | Create | `css(Image)` from `expo-image` |
| `src/tw/animated.tsx` | Create | `css()` wrappers for Reanimated `Animated.View`, `Animated.Text` |
| `src/app/settings.tsx` | Create | 3rd route — Settings screen with className throughout |
| `src/components/app-tabs.tsx` | Modify | Add `<NativeTabs.Trigger name="settings">` with icon |
| `src/components/app-tabs.web.tsx` | Modify | Add `<TabTrigger name="settings" href="/settings">` |
| `src/app/index.tsx` | Modify | Home header uses `TwText className="text-3xl font-bold"` |
| `src/app/explore.tsx` | Modify | Explore header uses `TwText className="text-3xl font-bold"` |
| `nativewind-env.d.ts` | Create | NativeWind type declarations (re-export from `nativewind/types`) |

## Interfaces / Contracts

```tsx
// CSS-wrapped component pattern
import { TwView, TwText } from "@/tw";

// Usage
<TwView className="flex-1 bg-white dark:bg-black">
  <TwText className="text-lg font-semibold">Hello</TwText>
</TwView>
```

Settings screen follows the same route pattern as `explore.tsx` — default export function component with `SafeAreaView`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | CSS-wrapped components render with className | Render `<TwText className="font-bold">` with testing-library, verify style output |
| Unit | 3 tabs render on native | Shallow render `app-tabs.tsx`, assert 3 `NativeTabs.Trigger` children |
| Unit | 3 tabs render on web | Shallow render `app-tabs.web.tsx`, assert 3 `TabTrigger` children |
| Visual | Settings screen className renders on real device | Manual — run `bun start` on each platform |

Note: NativeWind CSS runtime may need `setupFiles` in jest config for tests to pass. Add `require("react-native-css/jest")` to jest setup if needed.

## Open Questions

- [ ] Exact latest `nativewind@preview` version — verify with `npm info nativewind versions --json` before install
- [ ] Does LightningCSS `1.30.1` match Expo SDK 56 bundled version? Check `node_modules/lightningcss/package.json` after install
- [ ] Does `react-native-css/jest` exist or do we need a mock for test setup?
- [ ] Web fonts via `@theme` — verify `font-display` className resolves to the CSS custom property on web
