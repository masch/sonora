# Design: Migrate StyleSheet Components to NativeWind className

**Change**: `sonora-issue4-migrate-stylesheet-to-nativewind`
**Status**: Draft
**Author**: SDD Design Agent
**Date**: 2026-05-27

---

## 1. Architecture Overview

### Post-Migration Styling Model

After migration, the styling system operates on a single principle:

> **`className` is the single source of truth for styling.**

```
┌──────────────────────────────────────────────┐
│                  className                    │
│  (single source of truth for all styling)     │
├──────────────────────────────────────────────┤
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │ TwView   │  │ TwText   │  │ TwScroll...│ │
│  │ className│  │ className│  │ className   │ │
│  └────┬─────┘  └────┬─────┘  └──────┬──────┘ │
│       │              │               │        │
│  ┌────▼──────────────▼───────────────▼────┐   │
│  │         useCssElement()                │   │
│  │  (react-native-css runtime)            │   │
│  │  className → style mapping             │   │
│  └────────────────┬───────────────────────┘   │
│                   │                            │
│  ┌────────────────▼───────────────────────┐   │
│  │        React Native View/Text          │   │
│  │        with resolved style objects     │   │
│  └────────────────────────────────────────┘   │
│                                              │
└──────────────────────────────────────────────┘
```

### What Changes

| Aspect | Before | After |
|--------|--------|-------|
| Styling source | `StyleSheet.create()` + `useTheme()` | `className` strings |
| Dark mode | Runtime `useTheme()` → color values | `dark:` variant in CSS |
| Spacing | `Spacing.half`, `Spacing.one`, etc. | Tailwind scale: `p-0.5`, `p-1`, etc. |
| Colors | `Colors.light` / `Colors.dark` constants | CSS `@theme` tokens with `@variant dark` override |
| Components | `View`, `Text`, `ScrollView` from RN | `TwView`, `TwText`, `TwScrollView` from `@/tw` |
| Pressable | `Pressable` with `style={({pressed}) => ...}` | `TwPressable` with `active:` variant |
| Animated containers | `Animated.View` (Reanimated) | `TwAnimatedView` from `@/tw/animated` |
| Images | `Image` from `expo-image` | `TwImage` from `@/tw/image` (optional) |

### What Stays

- **`useTheme()`** — kept only in files with `SymbolView` `tintColor` runtime prop (collapsible.tsx, explore.tsx, app-tabs.web.tsx). The `tintColor` prop on `SymbolView` requires an actual color value, not a className.
- **`Colors` constant** — kept only where `Colors[scheme].text` is needed as a `tintColor` value for `SymbolView`. Otherwise removed.
- **`Platform.select`** — kept where dynamic values (insets, platform-specific layout) cannot be expressed as static className.
- **`SafeAreaView`** — kept as-is with inline `style` objects (SafeAreaView is not wrapped with `useCssElement`, so className is unsupported).

### The Dark Mode Architecture Change

Before: colors resolved at runtime via `useTheme()` hook:
```
const theme = useTheme();  // returns light or dark color map
<View style={{ backgroundColor: theme.background }} />
```

After: colors resolved via `@theme` tokens with light defaults and `@variant dark` overrides:
```
<View className="bg-background" />
/* CSS @theme sets light values, @variant dark overrides in prefers-color-scheme: dark */
```

`light-dark()` CSS function was initially considered but does NOT work inside NativeWind's `@theme` processing pipeline. NativeWind converts CSS to runtime style objects for React Native, and `light-dark()` is a browser-only CSS Level 5 function unsupported in that pipeline. The `@variant dark` approach is the NativeWind-idiomatic equivalent.

---

## 2. Component Mapping Table

| Component | Before | After | Complexity | Ph |
|-----------|--------|-------|------------|----|
| **global.css** | `@variant dark { ... }` | 5 `@theme` color tokens + `@variant dark` overrides | Simple | 0 |
| **hint-row.tsx** | `View` + `StyleSheet` + `ThemedView` + `Spacing` | `TwView` + inline `className` | Simple | 1 |
| **web-badge.tsx** | `StyleSheet` + `ThemedView` + `Spacing` + `useColorScheme` | `TwView` + inline `className` | Simple | 1 |
| **collapsible.tsx** | `StyleSheet` + `ThemedView` + `Spacing` + `FadeIn` | `TwView/TwPressable/TwAnimatedView` + `className` | Medium | 1 |
| **index.tsx** | Mix of `TwText` + `ThemedView` + `StyleSheet` + `Spacing` | Full `className` on `Tw*` | Medium | 2 |
| **explore.tsx** | Mix + `StyleSheet` + `Spacing` + `useTheme` | Full `className` + `useTheme`(kept for SymbolView) | Complex | 2 |
| **ThemedText.tsx** | `StyleSheet` + `useTheme` + `type` prop → style | `TwText` + `type` prop → `className` map | Complex | 3 |
| **ThemedView.tsx** | `StyleSheet` + `useTheme` background | Inline `TwView` with `bg-*` class (file removed) | Trivial | 3 |
| **app-tabs.web.tsx** | `StyleSheet` + `Spacing` + `Colors[scheme]` | `className` + `Colors`(kept for SymbolView) | Medium | 4 |
| **screen-wrapper.tsx** | — *(new file)* | `ScreenWrapper` + `ScrollScreenWrapper` | Trivial | — |
| **theme.ts** | `Colors`, `Spacing`, `Fonts`, `BottomTabInset`, `MaxContentWidth` | Keep all exports (all still have consumers) | Simple | 5 |
| **use-theme.ts** | `Colors[scheme]` lookup | Keep (used by collapsible.tsx, explore.tsx) | Simple | 5 |

### Detailed Migration Per Component

#### hint-row.tsx (Phase 1)

```tsx
// BEFORE
import { View, StyleSheet } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Spacing } from '@/constants/theme';

<View style={styles.stepRow}>
  <ThemedText type="small">{title}</ThemedText>
  <ThemedView type="backgroundSelected" style={styles.codeSnippet}>
    <ThemedText themeColor="textSecondary">{hint}</ThemedText>
  </ThemedView>
</View>

const styles = StyleSheet.create({
  stepRow: { flexDirection: 'row', justifyContent: 'space-between' },
  codeSnippet: {
    borderRadius: Spacing.two, paddingVertical: Spacing.half, paddingHorizontal: Spacing.two,
  },
});

// AFTER
import { TwView } from '@/tw';
import { ThemedText } from './themed-text';

<TwView className="flex-row justify-between">
  <ThemedText type="small">{title}</ThemedText>
  <TwView className="bg-backgroundSelected rounded-lg py-0.5 px-2">
    <ThemedText themeColor="textSecondary">{hint}</ThemedText>
  </TwView>
</TwView>
```

#### web-badge.tsx (Phase 1)

```tsx
// BEFORE
import { useColorScheme, StyleSheet } from 'react-native';
import { ThemedView } from './themed-view';
import { Spacing } from '@/constants/theme';

<ThemedView style={styles.container}>
  <ThemedText type="code" themeColor="textSecondary" style={styles.versionText}>v{version}</ThemedText>
  <Image source={...} style={styles.badgeImage} />
</ThemedView>

const styles = StyleSheet.create({
  container: { padding: Spacing.five, alignItems: 'center', gap: Spacing.two },
  versionText: { textAlign: 'center' },
  badgeImage: { width: 123, aspectRatio: 123 / 24 },
});

// AFTER
import { useColorScheme } from 'react-native';
import { TwView } from '@/tw';

<TwView className="items-center gap-2 p-8">
  <ThemedText type="code" themeColor="textSecondary" style={{ textAlign: 'center' }}>
    v{version}
  </ThemedText>
  <Image source={...} style={{ width: 123, aspectRatio: 123 / 24 }} />
</TwView>
```

Note: `useColorScheme` stays for the badge image source logic. `ThemedText` style is inlined (removed constant). `Image` style is inlined (or could use `TwImage` with `className="w-[123px] aspect-[123/24]"`).

#### collapsible.tsx (Phase 1)

```tsx
// BEFORE
import { Pressable, StyleSheet } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// AFTER
import { TwView, TwPressable } from '@/tw';
import { TwAnimatedView } from '@/tw/animated';
import { useTheme } from '@/hooks/use-theme';   // KEPT for SymbolView tintColor
```

| Old style | Tailwind class |
|-----------|---------------|
| `heading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two }` | `flex-row items-center gap-2` |
| `pressedHeading: { opacity: 0.7 }` | `active:opacity-70` (via TwPressable) |
| `button: { width: Spacing.four, height: Spacing.four, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }` | `w-6 h-6 rounded-xl justify-center items-center` |
| `content: { marginTop: Spacing.three, borderRadius: Spacing.three, marginLeft: Spacing.four, padding: Spacing.four }` | `mt-4 rounded-2xl ml-6 p-6` |

Edge case: `Animated.View` with `FadeIn` → `TwAnimatedView` with same `entering` prop.

#### index.tsx (Phase 2)

Current state: already mixed — `TwText` for the "Welcome to Expo" heading, `ThemedView`/`ThemedText` for everything else.

| Old style | Tailwind class |
|-----------|---------------|
| `container: { flex: 1, justifyContent: 'center', flexDirection: 'row' }` | `flex-1 justify-center flex-row` |
| `safeArea: { flex: 1, paddingHorizontal: 24, alignItems: 'center', gap: 16, paddingBottom: BottomTabInset + 16, maxWidth: 800 }` | Style kept for dynamic `paddingBottom`; static: `flex-1 max-w-[800px]` via inline style |
| `heroSection: { alignItems: 'center', justifyContent: 'center', flex: 1, paddingHorizontal: 24, gap: 24 }` | `items-center justify-center flex-1 px-6 gap-6` |
| `title: { textAlign: 'center' }` | Not used — TwText already uses `text-center` |
| `code: { textTransform: 'uppercase' }` | `uppercase` |
| `stepContainer: { gap: 16, alignSelf: 'stretch', paddingHorizontal: 16, paddingVertical: 24, borderRadius: 24 }` | `gap-4 self-stretch px-4 py-6 rounded-2xl` |

SafeAreaView edge case: does NOT support `className` (not wrapped with `useCssElement`). Use inline `style` for SafeAreaView.

#### explore.tsx (Phase 2)

Largest migration target. ~17 style refs reduced to className.

| Old style | Tailwind class |
|-----------|---------------|
| `scrollView: { flex: 1 }` | `flex-1` on TwScrollView |
| `contentContainer: { flexDirection: 'row', justifyContent: 'center' }` | `flex-row justify-center` as `contentContainerClassName` |
| `container: { maxWidth: MaxContentWidth, flexGrow: 1 }` | `max-w-[800px] flex-grow` |
| `titleContainer: { gap: 16, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 64 }` | `gap-4 items-center px-6 py-16` |
| `centerText: { textAlign: 'center' }` | Pass to ThemedText as `className="text-center"` (requires className prop on ThemedText) or `style={{ textAlign: 'center' }}` |
| `pressed: { opacity: 0.7 }` | `active:opacity-70` via TwPressable |
| `linkButton: { flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 8, borderRadius: 32, justifyContent: 'center', gap: 4, alignItems: 'center' }` | `flex-row px-6 py-2 rounded-[32px] justify-center gap-1 items-center` |
| `sectionsWrapper: { gap: 32, paddingHorizontal: 24, paddingTop: 16 }` | `gap-8 px-6 pt-4` |
| `collapsibleContent: { alignItems: 'center' }` | `items-center` |
| `imageTutorial: { width: '100%', aspectRatio: 296/171, borderRadius: 16, marginTop: 8 }` | `w-full aspect-[296/171] rounded-2xl mt-2` |
| `imageReact: { width: 100, height: 100, alignSelf: 'center' }` | `w-[100px] h-[100px] self-center` |

Edge cases:
1. `contentPlatformStyle` uses dynamic `safeAreaInsets` — keep as `contentContainerStyle` object on `TwScrollView`, do NOT use `contentContainerClassName` for platform padding (incompatible with dynamic values).
2. `ScrollView` with `{ backgroundColor: theme.background }` → `TwScrollView className="flex-1 bg-background"`, `useTheme` stays for SymbolView `tintColor`.
3. `Pressable` with `style={({ pressed }) => pressed && styles.pressed}` → `TwPressable className="active:opacity-70"`.

#### ThemedText.tsx (Phase 3)

Internal rewrite. Component interface stays for backward compat:

```tsx
// AFTER
import { Platform } from 'react-native';
import type { TextProps } from 'react-native';
import { TwText } from '@/tw';
import type { ThemeColor } from '@/constants/theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
  className?: string;   // NEW: allows callers to add class overrides
};

const typeClassMap: Record<string, string> = {
  default: 'text-base font-medium leading-6',
  title: 'text-5xl font-semibold leading-[52px]',
  small: 'text-sm font-medium leading-5',
  smallBold: 'text-sm font-bold leading-5',
  subtitle: 'text-[32px] font-semibold leading-[44px]',
  link: 'text-sm leading-[30px]',
  linkPrimary: 'text-sm leading-[30px] text-[#3c87f7]',
  code: `text-xs font-mono ${Platform.OS === 'android' ? 'font-bold' : 'font-medium'}`,
};

const colorClassMap: Record<string, string> = {
  text: 'text-text',
  textSecondary: 'text-textSecondary',
  background: 'text-background',
  backgroundElement: 'text-backgroundElement',
  backgroundSelected: 'text-backgroundSelected',
};

export function ThemedText({ style, type = 'default', themeColor, className, ...rest }: ThemedTextProps) {
  const typeClass = typeClassMap[type] ?? typeClassMap.default;
  const colorClass = themeColor ? (colorClassMap[themeColor] ?? 'text-text') : 'text-text';
  const combined = `${typeClass} ${colorClass}${className ? ` ${className}` : ''}`;
  return <TwText className={combined} style={style} {...rest} />;
}
```

Key considerations:
- **`font-mono`** works because `global.css` registers `--font-mono` in `@theme` as a CSS variable with platform-specific values.
- **`leading-[52px]`** arbitrary values for title/subtitle/link line-heights that don't match Tailwind's default scale.
- **`text-[#3c87f7]`** arbitrary color for `linkPrimary` (intentionally outside theme).
- **`Platform.select`** kept for `code` fontWeight (Android=700, others=500) due to platform-specific font rendering differences.
- **`className` prop added** to ThemedText so callers can override (e.g., `text-center`, `uppercase`).

#### ThemedView.tsx (Phase 3)

File removed entirely. All usages replaced inline with `TwView`:

| Old | New |
|-----|-----|
| `<ThemedView>` | `<TwView className="bg-background">` |
| `<ThemedView type="backgroundElement">` | `<TwView className="bg-backgroundElement">` |
| `<ThemedView type="backgroundSelected">` | `<TwView className="bg-backgroundSelected">` |
| `<ThemedView style={...}>` | `<TwView className="..." style={...}>` |

#### app-tabs.web.tsx (Phase 4)

| Old style | Tailwind class |
|-----------|---------------|
| `tabListContainer: { position: 'absolute', width: '100%', padding: 16, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' }` | `absolute w-full p-4 justify-center items-center flex-row` |
| `innerContainer: { paddingVertical: 8, paddingHorizontal: 32, borderRadius: 32, flexDirection: 'row', alignItems: 'center', flexGrow: 1, gap: 8, maxWidth: 800 }` | `py-2 px-8 rounded-[32px] flex-row items-center flex-grow gap-2 max-w-[800px]` |
| `brandText: { marginRight: 'auto' }` | `mr-auto` |
| `pressed: { opacity: 0.7 }` | `active:opacity-70` |
| `tabButtonView: { paddingVertical: 4, paddingHorizontal: 16, borderRadius: 16 }` | `py-1 px-4 rounded-2xl` |
| `externalPressable: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, marginLeft: 16 }` | `flex-row justify-center items-center gap-1 ml-4` |

`Colors[scheme]` stays for `SymbolView` `tintColor`. `Pressable` stays (or convert to `TwPressable` for `active:` variant).

---

## 3. Spacing Translation Table

Current `Spacing` constants map to exact Tailwind utility classes. No custom `@theme` tokens needed.

| Custom | Value (px) | Tailwind class | Notes |
|--------|-----------|----------------|-------|
| `Spacing.half` | 2 | `-0.5` (e.g., `p-0.5`, `gap-0.5`, `py-0.5`) | 0.5 × 4px = 2px |
| `Spacing.one` | 4 | `-1` (e.g., `p-1`, `gap-1`, `py-1`) | 1 × 4px = 4px |
| `Spacing.two` | 8 | `-2` (e.g., `p-2`, `gap-2`, `px-2`) | 2 × 4px = 8px |
| `Spacing.three` | 16 | `-4` (e.g., `p-4`, `gap-4`, `mt-4`) | 4 × 4px = 16px |
| `Spacing.four` | 24 | `-6` (e.g., `p-6`, `gap-6`, `px-6`) | 6 × 4px = 24px |
| `Spacing.five` | 32 | `-8` (e.g., `p-8`, `gap-8`, `py-8`) | 8 × 4px = 32px |
| `Spacing.six` | 64 | `-16` (e.g., `p-16`, `gap-16`, `pt-16`) | 16 × 4px = 64px |

### Border Radius Equivalents

| Custom | Value (px) | Tailwind class |
|--------|-----------|----------------|
| `Spacing.half` (2) | 2 | `rounded-sm` |
| `Spacing.one` (4) | 4 | `rounded` (default) |
| `Spacing.two` (8) | 8 | `rounded-lg` |
| `Spacing.three` (16) | 16 | `rounded-2xl` |
| `Spacing.four` (24) | 24 | `rounded-[24px]` (no exact match) |
| `Spacing.five` (32) | 32 | `rounded-[32px]` (used for pill shapes) |

---

## 4. ThemedText Type → ClassName Mapping

| type | Original styles | Tailwind className |
|------|----------------|-------------------|
| `default` | `fontSize: 16, lineHeight: 24, fontWeight: 500` | `text-base font-medium leading-6` |
| `title` | `fontSize: 48, lineHeight: 52, fontWeight: 600` | `text-5xl font-semibold leading-[52px]` |
| `small` | `fontSize: 14, lineHeight: 20, fontWeight: 500` | `text-sm font-medium leading-5` |
| `smallBold` | `fontSize: 14, lineHeight: 20, fontWeight: 700` | `text-sm font-bold leading-5` |
| `subtitle` | `fontSize: 32, lineHeight: 44, fontWeight: 600` | `text-[32px] font-semibold leading-[44px]` |
| `link` | `fontSize: 14, lineHeight: 30` | `text-sm leading-[30px]` |
| `linkPrimary` | `fontSize: 14, lineHeight: 30, color: '#3c87f7'` | `text-sm leading-[30px] text-[#3c87f7]` |
| `code` | `fontSize: 12, fontWeight: 500(ios)/700(android), fontFamily: Fonts.mono` | `text-xs font-mono` + platform fontWeight |

### Color ClassName Mapping

| `themeColor` prop | Tailwind class |
|------------------|---------------|
| omitted (default) | `text-text` |
| `text` | `text-text` |
| `textSecondary` | `text-textSecondary` |
| `background` | `text-background` |
| `backgroundElement` | `text-backgroundElement` |
| `backgroundSelected` | `text-backgroundSelected` |

### Rationale for Arbitrary Values

- **`text-[32px]`**: Tailwind v4's font-size scale does not include 32px (`text-3xl`=30px, `text-4xl`=36px). Arbitrary value preserves exact visual.
- **`leading-[44px]`**: subtitle line-height doesn't match any Tailwind leading scale value.
- **`leading-[52px]`**: title line-height doesn't match any Tailwind leading scale value.
- **`leading-[30px]`**: link line-height doesn't match any Tailwind leading scale value.
- **`text-[#3c87f7]`**: linkPrimary uses a specific blue outside the theme color palette.
- **`rounded-[32px]`**: pill shapes at 32px don't match `rounded-full` (9999px) or `rounded-2xl` (16px).
- **`rounded-[24px]`**: used in index.tsx stepContainer (Spacing.four = 24px).

---

## 5. Color Token Registration

### Token Definitions

Add to `src/global.css` inside the existing `@theme { }` block:

```css
@theme {
  --font-sans: var(--font-sans);
  --font-serif: var(--font-serif);
  --font-rounded: var(--font-rounded);
  --font-mono: var(--font-mono);

  /* ── App color tokens (light defaults) ── */
  --color-text: #000000;
  --color-background: #ffffff;
  --color-backgroundElement: #f0f0f3;
  --color-backgroundSelected: #e0e1e6;
  --color-textSecondary: #60646c;
  --color-link: #3c87f7;
}

@variant dark {
  :root {
    --color-text: #ffffff;
    --color-background: #000000;
    --color-backgroundElement: #212225;
    --color-backgroundSelected: #2e3135;
    --color-textSecondary: #b0b4ba;
    --color-link: #3c87f7;
  }
}
```

Values match exactly from `src/constants/theme.ts`:
- Primary text: `#000000` (light) / `#ffffff` (dark)
- Background: `#ffffff` (light) / `#000000` (dark)
- Background element (cards, inputs): `#F0F0F3` (light) / `#212225` (dark)
- Selected background (tabs, active): `#E0E1E6` (light) / `#2E3135` (dark)
- Secondary text: `#60646C` (light) / `#B0B4BA` (dark)

### Why `@variant dark` Instead of `light-dark()`

`light-dark()` is a CSS Level 5 Color function that works in browsers. However, NativeWind processes CSS through `react-native-css` which converts styles to runtime objects for React Native — `light-dark()` is NOT supported in this pipeline. The `@variant dark` approach is the NativeWind-idiomatic equivalent:

1. **Light values** defined in `@theme` as defaults
2. **Dark values** override via `@variant dark { :root { ... } }` (compiles to `@media (prefers-color-scheme: dark)`)
3. Works on **both native and web** — NativeWind handles the media query on native via its color scheme detection
4. **No runtime JS** needed for color switching
5. `--color-link` kept identical across modes because `#3c87f7` is readable on both light and dark backgrounds

### TypeScript Types

The `nativewind-env.d.ts` file:
```ts
/// <reference types="nativewind/types" />
```

This auto-picks up `@theme` tokens from `global.css`. After adding the color tokens, NativeWind regenerates type definitions so `bg-background`, `text-textSecondary`, etc. are available as valid className values. No manual type configuration needed.

---

## 6. File-by-File Migration Plan

### Phase 0 — Global CSS (PR: foundation)

**File**: `src/global.css`

| Action | Detail |
|--------|--------|
| Add `@theme` tokens + `@variant dark` | 6 color tokens with light defaults in `@theme`, dark overrides in `@variant dark` (see §5) |
| Remove `@variant dark` | Vestigial block, no consumers |
| **Verify**: `make typecheck`, `bun run test` | Ensure no type errors |

### Phase 1 — Leaf Components (PR: leaf)

#### hint-row.tsx

| Action | Detail |
|--------|--------|
| Remove imports | `View`, `StyleSheet` from RN; `ThemedView`; `Spacing` |
| Add imports | `TwView` from `@/tw` |
| Replace JSX | `View` → `TwView className="flex-row justify-between"` |
| | `ThemedView type="backgroundSelected" style={styles.codeSnippet}` → `TwView className="bg-backgroundSelected rounded-lg py-0.5 px-2"` |
| Remove | `const styles = StyleSheet.create({...})` block |

#### web-badge.tsx

| Action | Detail |
|--------|--------|
| Remove imports | `StyleSheet`; `ThemedView`; `Spacing` |
| Add imports | `TwView` from `@/tw` |
| Keep imports | `useColorScheme` (for badge image logic) |
| Replace JSX | `ThemedView style={styles.container}` → `TwView className="items-center gap-2 p-8"` |
| Inline style | `ThemedText style={styles.versionText}` → `style={{ textAlign: 'center' }}` |
| Inline style | `Image style={styles.badgeImage}` → `style={{ width: 123, aspectRatio: 123/24 }}` |
| Remove | `const styles = StyleSheet.create({...})` block |

#### collapsible.tsx

| Action | Detail |
|--------|--------|
| Remove imports | `StyleSheet`; `Spacing` |
| Add imports | `TwView`, `TwPressable` from `@/tw`; `TwAnimatedView` from `@/tw/animated` |
| Keep imports | `useTheme` (for SymbolView `tintColor`); `Pressable` and `Animated` (keep for FadeIn) |
| Replace heading | `style={({ pressed }) => [styles.heading, pressed && styles.pressedHeading]}` → `className="flex-row items-center gap-2 active:opacity-70"` on `TwPressable` |
| Replace button | `ThemedView type="backgroundElement" style={styles.button}` → `TwView className="bg-backgroundElement w-6 h-6 rounded-xl justify-center items-center"` |
| Replace content wrapper | `Animated.View` → `TwAnimatedView` (keep `entering={FadeIn.duration(200)}`) |
| Replace content | `ThemedView type="backgroundElement" style={styles.content}` → `TwView className="bg-backgroundElement mt-4 rounded-2xl ml-6 p-6"` |
| Replace outer | `ThemedView` → `TwView` (no extra background needed, or `bg-background`) |
| Remove | `const styles = StyleSheet.create({...})` block |

### Phase 2 — Pages (PR: pages)

#### index.tsx

| Action | Detail |
|--------|--------|
| Remove imports | `StyleSheet` from RN; `ThemedView` |
| Add imports | `TwView` from `@/tw` (TwText already imported) |
| Keep imports | `ThemedText`, `HintRow`, `WebBadge`, `AnimatedIcon`, `BottomTabInset`, `Spacing`, `MaxContentWidth` (BottomTabInset + Spacing for safeArea paddingBottom) |
| Replace container | ``ThemedView style={styles.container}` → `TwView className="flex-1 justify-center flex-row"` |
| SafeAreaView | Keep `style` prop for dynamic `paddingBottom: BottomTabInset + Spacing.three`; rest inlined: `className="flex-1 max-w-[800px]"` (test if SafeAreaView accepts className; use inline `style` as fallback) |
| Replace heroSection | `ThemedView style={styles.heroSection}` → `TwView className="items-center justify-center flex-1 px-6 gap-6"` |
| Replace stepContainer | `ThemedView type="backgroundElement" style={styles.stepContainer}` → `TwView className="bg-backgroundElement gap-4 self-stretch px-4 py-6 rounded-[24px]"` |
| ThemedText code style | `style={styles.code}` → `className="uppercase"` on ThemedText (requires className prop — see Phase 3) |
| Remove | `const styles = StyleSheet.create({...})` block |

#### explore.tsx

| Action | Detail |
|--------|--------|
| Remove imports | `StyleSheet`; `Spacing`; `BottomTabInset`; `MaxContentWidth` |
| Add imports | `TwView`, `TwScrollView`, `TwPressable` from `@/tw` |
| Keep imports | `useTheme` (for SymbolView `tintColor`); `ScrollView` (remove), `Pressable` (keep or replace), `useSafeAreaInsets` (keep) |
| Replace ScrollView | `ScrollView style={[styles.scrollView, { backgroundColor: theme.background }]} contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}` → `TwScrollView className="flex-1 bg-background" contentContainerClassName="flex-row justify-center" contentContainerStyle={contentPlatformStyle}` |
| Keep insets | `contentInset={insets}` stays |
| Replace container | `ThemedView style={styles.container}` → `TwView className="max-w-[800px] flex-grow"` |
| Replace titleContainer | `ThemedView style={styles.titleContainer}` → `TwView className="gap-4 items-center px-6 py-16"` |
| ThemedText centerText | `style={styles.centerText}` → `className="text-center"` on ThemedText |
| Replace linkButton | `ThemedView type="backgroundElement" style={styles.linkButton}` → `TwView className="bg-backgroundElement flex-row px-6 py-2 rounded-[32px] justify-center gap-1 items-center"` |
| Replace sectionsWrapper | `ThemedView style={styles.sectionsWrapper}` → `TwView className="gap-8 px-6 pt-4"` |
| Replace collapsibleContent | `ThemedView type="backgroundElement" style={styles.collapsibleContent}` → `TwView className="bg-backgroundElement items-center"` |
| Replace imageTutorial | `style={styles.imageTutorial}` → `className="w-full aspect-[296/171] rounded-2xl mt-2"` on TwImage, or `style` |
| Replace imageReact | `style={styles.imageReact}` → `className="w-[100px] h-[100px] self-center"` on TwImage, or `style` |
| Replace Pressable | `style={({ pressed }) => pressed && styles.pressed}` → `className="active:opacity-70"` on TwPressable |
| Remove | `const styles = StyleSheet.create({...})` block |

### Phase 3 — Core Wrappers (PR: core)

#### ThemedText.tsx

| Action | Detail |
|--------|--------|
| Remove imports | `StyleSheet`, `Text` from RN; `Fonts`; `useTheme` |
| Add imports | `TwText` from `@/tw` |
| Keep imports | `Platform` from RN; `ThemeColor` type |
| Add | `className` to `ThemedTextProps` |
| Add | `typeClassMap` constant (see §4) |
| Add | `colorClassMap` constant (see §4) |
| Rewrite render | `TwText` with computed className from type + themeColor; pass `style` and `rest` through |
| Remove | `const styles = StyleSheet.create({...})` block |

#### ThemedView.tsx

| Action | Detail |
|--------|--------|
| **Delete file** | Entire file removed |
| Replace all imports | `import { ThemedView } from '@/components/themed-view'` → `import { TwView } from '@/tw'` |
| Replace all usages | `<ThemedView>` → `<TwView className="bg-background">` (or appropriate `bg-*` class) |

### Phase 4 — Web Tabs (PR: web-tabs)

#### app-tabs.web.tsx

| Action | Detail |
|--------|--------|
| Remove imports | `StyleSheet`; `Spacing`; `View` from RN; `ThemedView` |
| Add imports | `TwView` from `@/tw` |
| Keep imports | `Pressable` (or replace with TwPressable); `useColorScheme`; `Colors` (for SymbolView tintColor); `MaxContentWidth` |
| Replace tabListContainer | `View {...props} style={styles.tabListContainer}` → `TwView className="absolute w-full p-4 justify-center items-center flex-row"` |
| Replace innerContainer | `ThemedView type="backgroundElement" style={styles.innerContainer}` → `TwView className="bg-backgroundElement py-2 px-8 rounded-[32px] flex-row items-center flex-grow gap-2 max-w-[800px]"` |
| Replace brandText | `ThemedText type="smallBold" style={styles.brandText}` → `ThemedText type="smallBold" className="mr-auto"` |
| Replace tabButtonView | `ThemedView type={...} style={styles.tabButtonView}` → `TwView className="bg-backgroundSelected py-1 px-4 rounded-2xl"` (dynamic type becomes dynamic className template literal) |
| Replace externalPressable | `Pressable style={styles.externalPressable}` → `TwPressable className="flex-row justify-center items-center gap-1 ml-4"` |
| Replace pressed | `style={({ pressed }) => pressed && styles.pressed}` → `className="active:opacity-70"` |
| Remove | `const styles = StyleSheet.create({...})` block |

Dynamic className for `tabButtonView`:
```tsx
// BEFORE
<ThemedView type={isFocused ? 'backgroundSelected' : 'backgroundElement'} style={styles.tabButtonView}>

// AFTER
<TwView className={`${isFocused ? 'bg-backgroundSelected' : 'bg-backgroundElement'} py-1 px-4 rounded-2xl`}>
```

### ScreenWrapper / ScrollScreenWrapper (Architectural Addition)

Two new wrapper components centralize the `bg-background` pattern so every screen automatically gets the correct background color.

**`ScreenWrapper`** (non-scrollable):
```tsx
export function ScreenWrapper({ children, className }) {
  return <TwView className={`flex-1 bg-background${className ? ` ${className}` : ''}`}>{children}</TwView>
}
```

**`ScrollScreenWrapper`** (scrollable):
```tsx
export function ScrollScreenWrapper({ children, className, contentInset, contentContainerStyle, contentContainerClassName }) {
  return <TwScrollView className={`flex-1 bg-background${className ? ` ${className}` : ''}`} ...>{children}</TwScrollView>
}
```

Usage across screens:

| Screen | Wrapper | Notes |
|--------|---------|-------|
| `index.tsx` | `<ScreenWrapper className="justify-center flex-row">` | Non-scrollable, contains SafeAreaView |
| `explore.tsx` | `<ScrollScreenWrapper contentInset={...}>` | Scrollable, uses contentInset |
| `settings.tsx` | `<ScreenWrapper className="flex-row justify-center">` | Non-scrollable, has nested SafeAreaView + TwScrollView |

### Phase 5 — Cleanup (PR: cleanup)

#### src/constants/theme.ts

| Action | Detail |
|--------|--------|
| Keep export | `Colors` — still used by app-tabs.tsx and app-tabs.web.tsx (SymbolView tintColor) |
| Keep export | `Spacing` — still used by index.tsx and explore.tsx (SafeAreaView insets, inline styles) |
| Keep export | `Fonts` — used by animated-icon.tsx and animated-icon.web.tsx (not in scope) |
| Keep export | `BottomTabInset` — used by index.tsx safeArea padding |
| Keep export | `MaxContentWidth` — may still be used |
| Keep export | `ThemeColor` type — used by ThemedText |

#### src/hooks/use-theme.ts

| Action | Detail |
|--------|--------|
| Keep | `useTheme` — still used by collapsible.tsx, explore.tsx, app-tabs.web.tsx (SymbolView tintColor) |
| Remove only from | Files where useTheme was only used for styling (ThemedText, ThemedView) |

#### Post-Cleanup Consumer Audit

After Phase 4, verify remaining `Colors`, `Spacing`, `useTheme` consumers:
```bash
grep -r 'from.*@/constants/theme' src/ --include='*.tsx' --include='*.ts'
grep -r 'useTheme' src/ --include='*.tsx' --include='*.ts'
grep -r 'StyleSheet.create' src/ --include='*.tsx'
```

Expected remaining:
- `Colors` → app-tabs.web.tsx (SymbolView tintColor), app-tabs.tsx (native tabs props)
- `Spacing` → index.tsx (safeArea paddingBottom: BottomTabInset + Spacing.three), explore.tsx (insets)
- `useTheme` → app-tabs.tsx (native, NOT in scope), collapsible.tsx, explore.tsx
- `StyleSheet.create` → 0 in migrated files (only in excluded files: animated-icon.tsx, animated-icon.web.tsx)

---

## 7. Risk Mitigations

### Visual Regression Prevention

| Risk | Mitigation |
|------|-----------|
| Wrong spacing value | Compare each migration against screenshot. Tailwind values produce EXACT same px values (see §3). |
| Color mismatch | Colors registered in `@theme` with light defaults and `@variant dark` overrides, using EXACT hex values from `Colors` constant. No deviation. |
| `font-mono` not working on Android | The `@theme` block already defines `--font-mono` with platform-specific fallbacks (`monospace` on Android). Verify before Phase 1. |
| `leading-*` mismatch for default/small | Tailwind `text-base` default leading is 24px (= `leading-6`), `text-sm` default leading is 20px (= `leading-5`). Exact match. |
| `rounded-*` mismatch | `rounded-lg` = 8px, `rounded-2xl` = 16px. Verify Tailwind v4 scale before merge. |
| `active:` variant not working on native | NativeWind v5 maps RN Pressable pressed state to `active:` variant. Confirm with test component. |
| `@variant dark` compatibility | `@variant dark` compiles to `@media (prefers-color-scheme: dark)` which is supported on all modern browsers and native platforms. Zero risk. |

### Validation Per Phase

After each PR, run:

```bash
# TypeScript checks
make typecheck

# Unit tests
bun run test

# Visual sanity (manual - run on iOS simulator + web)
bun run ios     # Check light + dark mode
bun run web     # Check light + dark mode via devtools

# Verify zero StyleSheet.create in migrated files
grep -rn 'StyleSheet.create' src/components/hint-row.tsx src/components/web-badge.tsx  # should be empty
```

### Rollback Strategy

Per PR (Phase 1-5):
1. Revert the merge commit for that phase's PR.
2. No schema/data/cache migrations — visual-only changes.
3. Since phases are additive (no shared file conflicts except theme.ts), any phase can be independently rolled back.
4. If Phase 0 (color tokens) has a bug, ALL subsequent phases break — so Phase 0 must be thoroughly tested.

### ThemedText className Prop — Backward Compat

Adding a `className` prop to `ThemedText` is a backward-compatible additive change. All existing `style` overrides still work because TwText passes `style` through to the underlying Text component.

### SafeAreaView className

`SafeAreaView` from `react-native-safe-area-context` is not wrapped with `useCssElement`. Two approaches:
1. **Preferred**: Test if `className` works natively on SafeAreaView (it may passthrough to the underlying View).
2. **Fallback**: Use inline `style` objects for SafeAreaView, keeping all nested views as TwView with className.

### Accessibility

No accessibility changes — `Text` and `Pressable` components maintain their roles. `className` is purely visual.

---

## Appendix A: Import Map

File-level summary of import changes per phase:

| File | Imports Removed | Imports Added |
|------|----------------|---------------|
| `src/global.css` | `@variant dark { ... }` | 5 `--color-*` tokens in `@theme` |
| `hint-row.tsx` | `View`, `StyleSheet`, `ThemedView`, `Spacing` | `TwView` |
| `web-badge.tsx` | `StyleSheet`, `ThemedView`, `Spacing` | `TwView` |
| `collapsible.tsx` | `StyleSheet`, `ThemedView`, `Spacing` | `TwView`, `TwPressable`, `TwAnimatedView` |
| `index.tsx` | `StyleSheet`, `ThemedView` | `TwView` |
| `explore.tsx` | `StyleSheet`, `Spacing`, `BottomTabInset`, `MaxContentWidth` | `TwView`, `TwScrollView`, `TwPressable` |
| `themed-text.tsx` | `StyleSheet`, `Text`, `Fonts`, `useTheme` | `TwText` |
| `themed-view.tsx` | (file deleted) | — |
| `app-tabs.web.tsx` | `StyleSheet`, `Spacing`, `View`, `ThemedView` | `TwView`, `TwPressable` |
| `screen-wrapper.tsx` | *(new file)* | `TwView`, `TwScrollView` |
| `settings.tsx` | — | `ScreenWrapper` import |
| `theme.ts` | — | — (all exports kept, consumers still exist) |

## Appendix B: Changed file list

```
M src/global.css                      (Phase 0 — tokens + @variant dark)
M src/components/hint-row.tsx         (Phase 1)
M src/components/web-badge.tsx        (Phase 1)
M src/components/ui/collapsible.tsx   (Phase 1)
M src/app/index.tsx                   (Phase 2)
M src/app/explore.tsx                 (Phase 2)
M src/components/themed-text.tsx      (Phase 3)
D src/components/themed-view.tsx      (Phase 3)
M src/components/app-tabs.web.tsx     (Phase 4)
M src/app/settings.tsx                (Phase 5 — adopt ScreenWrapper)
A src/components/screen-wrapper.tsx   (NEW — ScreenWrapper + ScrollScreenWrapper)
M src/tw/animated.tsx                 (FIX — TwAnimatedView typing)
M src/constants/theme.ts              (Phase 5 — all exports kept)

New files:
- src/components/screen-wrapper.tsx
```
