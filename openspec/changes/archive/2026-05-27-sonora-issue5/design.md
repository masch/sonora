# Design: Migrate Custom Theme to Tailwind v4 @theme

## Technical Approach

Eliminate the dual-source-of-truth between `src/constants/theme.ts` and `src/global.css` by moving all design tokens into Tailwind's `@theme` block. The runtime JS exports (`Colors`, `Fonts`, `Spacing`) become either a minimal `RuntimeColors` bridge or are removed entirely. Three native-only props (SymbolView `tintColor`, NativeTabs `backgroundColor`/`indicatorColor`/`labelStyle`) are the only reason any runtime color map exists — the rest of the app reads tokens from CSS classes via NativeWind.

## Architecture Decisions

### Decision: Keep RuntimeColors as Minimal Bridge

| Option                                                   | Tradeoff                                                                  | Decision   |
| -------------------------------------------------------- | ------------------------------------------------------------------------- | ---------- |
| Remove Colors entirely, hardcode hex values in consumers | DRY violation — 3 files repeat hex values                                 | Rejected   |
| Replace Colors with RuntimeColors (5 colors × 2 modes)   | 3 consumer files use same lookup pattern; one source of truth still in JS | **Chosen** |
| Use CSS custom properties read via `getComputedStyle`    | Native platforms can't read CSS vars at runtime                           | Rejected   |

**Rationale**: 3 native-only props (`NativeTabs` container props, `SymbolView` tintColor) require runtime color _strings_ — CSS classes can't pass a `tintColor` string prop. `RuntimeColors` mirrors the `Colors` shape so the lookup pattern `Color[scheme]` → `RuntimeColors[scheme]` is a find-and-replace.

### Decision: Remove Spacing Export, Inline Values

| Option                                                           | Tradeoff                                                            | Decision                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------- |
| Keep Spacing export                                              | Dual source of truth continues                                      | Rejected                         |
| Inline hardcoded numbers where Spacing was used in style objects | Simple, one-time cost                                               | **Chosen**                       |
| Convert all style objects to className                           | `SafeAreaView` isn't in `src/tw/` — requires wrapping or style prop | Rejected (for non-Tw components) |

**Rationale**: `Spacing` was used in two places: `index.tsx` (SafeAreaView style object) and `explore.tsx` (Platform.select style object). Neither can use Tailwind classes because they're on components without className support or in computed style objects. Inlining the numeric values is the simplest path.

### Decision: Delete use-theme.ts, Inline Lookup

| Option                                              | Tradeoff                       | Decision   |
| --------------------------------------------------- | ------------------------------ | ---------- |
| Keep use-theme.ts                                   | Hides one RuntimeColors lookup | Rejected   |
| Inline `useColorScheme()` + `RuntimeColors[scheme]` | 2 consumers add 3 lines each   | **Chosen** |

**Rationale**: After removing `Colors` (the old source), `useTheme` becomes a 3-line wrapper around `RuntimeColors` + `useColorScheme`. That's not worth a hook file. The two consumers (collapsible, explore) each add a `useColorScheme()` call and a `RuntimeColors[scheme]` lookup.

### Decision: Add TabBottomPadding Constant

| Option                                          | Tradeoff                         | Decision   |
| ----------------------------------------------- | -------------------------------- | ---------- |
| Inline `16` in `BottomTabInset + 16` expression | Magic number                     | Rejected   |
| Keep `Spacing.three`                            | Can't — Spacing is removed       | Rejected   |
| Add `export const TabBottomPadding = 16`        | Named constant documents purpose | **Chosen** |

**Rationale**: The `BottomTabInset + Spacing.three` expression must stay as a style prop (computed platform value). Extracting `16` into `TabBottomPadding` replaces the named reference while documenting intent.

### Decision: ThemeColor Type Moves to ThemedText

| Option                                    | Tradeoff                              | Decision   |
| ----------------------------------------- | ------------------------------------- | ---------- |
| Keep ThemeColor in theme.ts               | Exists only for 1 consumer            | Rejected   |
| Define string union locally in ThemedText | Colocated with use, no imports needed | **Chosen** |

**Rationale**: `ThemeColor` only existed because it was derived from `keyof typeof Colors`. With `Colors` removed, the type has no home in `theme.ts`. Moving it to `themed-text.tsx` as a plain union keeps the type where it's used.

## Data Flow (After Migration)

```
global.css (@theme + @variant dark)
  │
  ├── NativeWind className ──→ All TwX components (views, text, buttons, etc.)
  │                              Runtime CSS → platform-native styles
  │
  └── RuntimeColors export ──→ useColorScheme() from react-native
                                  │
                                  ├── app-tabs.tsx (NativeTabs bg/indicator/label)
                                  ├── app-tabs.web.tsx (SymbolView tintColor)
                                  └── collapsible.tsx (SymbolView tintColor)

use-color-scheme.web.ts ──→ Web SSR hydration (kept, not deleted)

BottomTabInset + TabBottomPadding ──→ computed style prop in index.tsx, explore.tsx
```

## File Changes

| File                                | Action | Description                                                                                                    |
| ----------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| `src/global.css`                    | Modify | Add `--spacing-half` through `--spacing-six` tokens to `@theme`                                                |
| `src/constants/theme.ts`            | Modify | Remove `Colors`, `Fonts`, `Spacing`, `ThemeColor`; add `RuntimeColors`, `TabBottomPadding`                     |
| `src/hooks/use-theme.ts`            | Delete | Inline into `collapsible.tsx` and `explore.tsx`                                                                |
| `src/hooks/use-color-scheme.ts`     | Delete | Re-export shim, zero consumers after `use-theme.ts` removed                                                    |
| `src/components/themed-text.tsx`    | Modify | Import `ThemeColor` type locally as string union; remove `theme.ts` dependency                                 |
| `src/components/app-tabs.tsx`       | Modify | `Colors` → `RuntimeColors`                                                                                     |
| `src/components/app-tabs.web.tsx`   | Modify | `Colors` → `RuntimeColors`                                                                                     |
| `src/components/ui/collapsible.tsx` | Modify | Remove `useTheme`; add `useColorScheme` + `RuntimeColors`                                                      |
| `src/app/explore.tsx`               | Modify | Remove `useTheme`, `Spacing`; add `useColorScheme`, `RuntimeColors`, `TabBottomPadding`; inline spacing values |
| `src/app/index.tsx`                 | Modify | Remove `Spacing`; inline spacing values; use `TabBottomPadding`                                                |

## Interfaces / Contracts

### RuntimeColors (replaces Colors)

```ts
// src/constants/theme.ts
export const RuntimeColors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;
```

### theme.ts Final Exports

```ts
export { RuntimeColors };
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const TabBottomPadding = 16;
export const MaxContentWidth = 800;
```

### ThemeColor (local to ThemedText)

```ts
// src/components/themed-text.tsx
type ThemeColor =
  'text' | 'textSecondary' | 'background' | 'backgroundElement' | 'backgroundSelected';
```

### @theme Spacing Tokens Added to global.css

```css
@theme {
  /* existing tokens */
  --spacing-half: 2;
  --spacing-one: 4;
  --spacing-two: 8;
  --spacing-three: 16;
  --spacing-four: 24;
  --spacing-five: 32;
  --spacing-six: 64;
}
```

## Spacing Token Mapping

The `Spacing` constants map to both Tailwind standard classes and custom `--spacing-*` tokens:

| Constant        | Value | Standard Tailwind Class | Custom `--spacing-*` Token |
| --------------- | ----- | ----------------------- | -------------------------- |
| `Spacing.half`  | 2     | `p-0.5`, `gap-0.5`      | `--spacing-half: 2`        |
| `Spacing.one`   | 4     | `p-1`, `gap-1`          | `--spacing-one: 4`         |
| `Spacing.two`   | 8     | `p-2`, `gap-2`          | `--spacing-two: 8`         |
| `Spacing.three` | 16    | `p-4`, `gap-4`          | `--spacing-three: 16`      |
| `Spacing.four`  | 24    | `p-6`, `gap-6`          | `--spacing-four: 24`       |
| `Spacing.five`  | 32    | `p-8`, `gap-8`          | `--spacing-five: 32`       |
| `Spacing.six`   | 64    | `p-16`, `gap-16`        | `--spacing-six: 64`        |

## Spacing Inline Values in index.tsx and explore.tsx

### index.tsx (SafeAreaView style — must stay as style object)

```tsx
// Before                                    // After
paddingHorizontal: Spacing.four,  // 24  →  paddingHorizontal: 24,
gap: Spacing.three,               // 16  →  gap: 16,
paddingBottom: BottomTabInset               paddingBottom: BottomTabInset
  + Spacing.three,                 // 16  →   + TabBottomPadding,
maxWidth: MaxContentWidth,                   maxWidth: MaxContentWidth,
```

### explore.tsx (contentPlatformStyle — must stay as style object)

```tsx
// Before (web branch)                      // After (web branch)
paddingTop: Spacing.six,     // 64  →  paddingTop: 64,
paddingBottom: Spacing.four, // 24  →  paddingBottom: 24,
```

### explore.tsx (insets.bottom — computed expression)

```ts
// Before                               // After
bottom: safeAreaInsets.bottom            bottom: safeAreaInsets.bottom
  + BottomTabInset + Spacing.three, // → + BottomTabInset + TabBottomPadding,
```

## Consumer Lookup Patterns

Every consumer that needs runtime colors uses the same pattern:

```ts
import { useColorScheme } from 'react-native';
import { RuntimeColors } from '@/constants/theme';

const scheme = useColorScheme();
const colors = RuntimeColors[scheme === 'unspecified' ? 'light' : scheme];
// Use colors.text, colors.background, etc.
```

This replaces:

- `useTheme()` returning `Colors[scheme]` (collapsible.tsx, explore.tsx)
- `Colors[scheme === 'unspecified' ? 'light' : scheme]` (app-tabs.tsx, app-tabs.web.tsx)

## Testing Strategy

| Layer        | What to Test                                                  | Approach                      |
| ------------ | ------------------------------------------------------------- | ----------------------------- |
| TypeScript   | No imports of removed exports compile                         | `make typecheck`              |
| Visual       | Light + dark mode renders identically on iOS, Android, Web    | Manual comparison screenshots |
| Visual       | BottomTabInset + TabBottomPadding layout unchanged            | Manual scroll-to-bottom check |
| Import audit | Zero `Colors`, `Fonts`, `useTheme`, `Spacing` imports survive | `rg` search before merge      |

## Migration / Rollout

No migration required. This is a pure codebase refactor — no data, schema, or API changes. Rollback: revert the PR commit.

## Open Questions

- None. All decisions are captured above.

## Delivery Strategy Forecast

- **Decision needed before apply**: No
- **Chained PRs recommended**: No
- **400-line budget risk**: Low — ~200 lines changed total (mostly deletions)
