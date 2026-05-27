# Migration Spec: StyleSheet → NativeWind className

## Purpose

Eliminate dual styling (StyleSheet + className) by migrating remaining `StyleSheet.create()` components to NativeWind className across 10 files. Pure refactor — no behavior or visual changes.

## Requirements

### R0: Color Tokens in @theme (Phase 0)

Five color tokens MUST be registered in `src/global.css` `@theme` block before any component migration.

| Token | Light | Dark |
|-------|-------|------|
| `--color-background` | #ffffff | #000000 |
| `--color-text` | #000000 | #ffffff |
| `--color-backgroundElement` | #F0F0F3 | #212225 |
| `--color-backgroundSelected` | #E0E1E6 | #2E3135 |
| `--color-textSecondary` | #60646C | #B0B4BA |

#### Scenario: R0 tokens resolve with light-dark()

- GIVEN `src/global.css` with `@theme { --color-text: light-dark(#000000, #ffffff); ... }`
- WHEN a component uses `className="text-text"`
- THEN it renders as #000000 in light mode and #ffffff in dark mode

### R1: Leaf Component Migration (Phase 1)

`hint-row.tsx`, `web-badge.tsx`, `collapsible.tsx` MUST replace `StyleSheet.create()` with `className` on `TwView`/`TwText` equivalents, preserving layout and spacing.

#### Scenario: hint-row renders identically

- GIVEN `src/components/hint-row.tsx`
- WHEN migrated to `TwView` and `TwText` with className
- THEN `stepRow` flexDirection `row` and `justifyContent` `space-between` MUST render as before
- AND `codeSnippet` borderRadius `rounded-lg` (8px), padding `px-2 py-0.5` MUST match original

#### Scenario: web-badge preserves image aspect ratio

- GIVEN `src/components/web-badge.tsx`
- WHEN migrated
- THEN badge image MUST have exact `w-[123px] aspect-[123/24]` dimensions
- AND `container` gap MUST be `gap-2`

#### Scenario: collapsible animated content still fades in

- GIVEN `src/components/ui/collapsible.tsx`
- WHEN the user taps the heading
- THEN `FadeIn.duration(200)` animation MUST still play on the `Animated.View` wrapper
- AND `pressedHeading` opacity 0.7 MUST apply via `active:opacity-70` on `TwPressable`
- AND the chevron `SymbolView` tintColor MUST still come from `useTheme()`

### R2: Page Migration (Phase 2)

`src/app/index.tsx` and `src/app/explore.tsx` MUST replace StyleSheet with className on `TwView`/`TwText`. The `contentInset` + safe area logic in explore.tsx MUST stay unchanged.

#### Scenario: index.tsx layout matches before

- GIVEN `src/app/index.tsx`
- WHEN migrated
- THEN `container` MUST use `flex-1 flex-row justify-center`
- AND `safeArea` MUST preserve `max-w-[800px]` and `pb-[calc(80+16)}` equivalent (BottomTabInset + Spacing.three)
- AND `heroSection` MUST use `flex-1 items-center justify-center`

#### Scenario: explore.tsx preserves contentInset

- GIVEN `src/app/explore.tsx`
- WHEN migrated
- THEN `ScrollView` `contentInset` and per-platform `contentContainerStyle` MUST remain as JavaScript props
- AND `collapsibleContent` borderRadius MUST be `rounded-2xl` (Spacing.three = 16px)

### R3: ThemedText Internal Refactor (Phase 3)

`ThemedText` MUST keep its exported props interface but replace internal `StyleSheet` with className mapping per `type`. `ThemedView` MUST become an inline `TwView` — the component is removed.

#### Scenario: ThemedText type maps to correct className

- GIVEN a `<ThemedText type="title">` renders
- THEN it MUST use `className="text-5xl font-semibold leading-[52px]"` (48px, 600 weight, 52px line-height)
- AND `type="small"` → `text-sm font-medium leading-5`
- AND `type="code"` → `font-mono text-xs android:font-bold font-medium` (platform-aware weight)

#### Scenario: ThemedText themeColor works dynamically

- GIVEN `<ThemedText themeColor="textSecondary">`
- WHEN color scheme changes
- THEN the text color MUST change dynamically via `useTheme()` runtime value
- AND `style` prop merging overrides both className and themeColor

#### Scenario: ThemedView removed, consumers use TwView

- GIVEN all files that import ThemedView
- WHEN migrated
- THEN `ThemedView` component file MUST be deleted
- AND consumers render `TwView` with `className="bg-background"` or `dark:bg-black`

### R4: Web Tabs Migration (Phase 4)

`app-tabs.web.tsx` layout styles MUST use className. `Colors` import stays for `SymbolView` tintColor.

#### Scenario: TabList preserves layout

- GIVEN `app-tabs.web.tsx`
- WHEN migrated
- THEN `tabListContainer` MUST use `absolute w-full p-3 flex-row justify-center items-center`
- AND `innerContainer` MUST use `max-w-[800px]` with `flex-row items-center gap-2`

#### Scenario: TabButton uses dynamic className

- GIVEN `<TabButton isFocused={true}>`
- WHEN rendered
- THEN the button MUST use `className="bg-backgroundSelected"` (vs `bg-backgroundElement` when unfocused)
- AND `isFocused` determines `text-text` vs `text-textSecondary` on ThemedText themeColor

### R5: Cleanup (Phase 5)

Unused exports from `src/constants/theme.ts` MUST be removed. `useTheme` import MUST be removed from migrated files.

#### Scenario: theme.ts exports pruned

- GIVEN `src/constants/theme.ts`
- WHEN `Fonts`, `Spacing`, `BottomTabInset`, `MaxContentWidth` are still used by non-migrated files
- THEN only `Colors` and `ThemeColor` type survive if referenced
- AND `Spacing` MUST be removed from every migrated file

## Non-goals

- `animated-icon.tsx` / `.web.tsx` — uses Keyframes, not in scope
- `app-tabs.tsx` (native) — NativeTabs runtime props, not in scope
- `external-link.tsx` — no StyleSheet, not in scope
- No new features, UI redesign, or behavior changes
