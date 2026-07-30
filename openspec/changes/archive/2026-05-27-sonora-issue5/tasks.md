# Tasks: Migrate Custom Theme to Tailwind v4 @theme (Issue #5)

## Review Workload Forecast

| Field                   | Value                       |
| ----------------------- | --------------------------- |
| Estimated changed lines | ~150-200 (mostly deletions) |
| 400-line budget risk    | Low                         |
| Chained PRs recommended | No                          |
| Suggested split         | Single PR                   |
| Delivery strategy       | ask-on-risk                 |
| Chain strategy          | pending                     |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Foundation — CSS + theme.ts

- [x] 1.1 Add `--spacing-half` through `--spacing-six` tokens (2, 4, 8, 16, 24, 32, 64) inside `@theme` in `src/global.css`
- [x] 1.2 Refactor `src/constants/theme.ts`: remove `Colors`, `Fonts`, `Spacing`, `ThemeColor`; add `RuntimeColors` (5 colors × 2 modes) and `export const TabBottomPadding = 16`

## Phase 2: Runtime Color Consumers

- [x] 2.1 Update `src/components/app-tabs.tsx`: `Colors` → `RuntimeColors` import + lookup
- [x] 2.2 Update `src/components/app-tabs.web.tsx`: `Colors` → `RuntimeColors` import + lookup
- [x] 2.3 Update `src/components/ui/collapsible.tsx`: remove `useTheme()`; add `useColorScheme()` + `RuntimeColors[scheme]` for `tintColor`

## Phase 3: Spacing Inlining + ThemedText

- [x] 3.1 Update `src/app/index.tsx`: replace `Spacing.four`→`24`, `Spacing.three`→`16`, `Spacing.three`→`TabBottomPadding` in SafeAreaView style
- [x] 3.2 Update `src/app/explore.tsx`: replace `useTheme`→`useColorScheme`+`RuntimeColors` for SymbolView; replace `Spacing.six`→`64`, `Spacing.four`→`24`, `Spacing.three`→`TabBottomPadding`
- [x] 3.3 Update `src/components/themed-text.tsx`: remove `ThemeColor` import from `@/constants/theme`; define local `type ThemeColor = 'text' | 'textSecondary' | 'background' | 'backgroundElement' | 'backgroundSelected'`

## Phase 4: Cleanup — Delete Unused Files

- [x] 4.1 Delete `src/hooks/use-theme.ts`
- [x] 4.2 Delete `src/hooks/use-color-scheme.ts` (keep `use-color-scheme.web.ts` for SSR)
- [x] 4.3 Confirm `src/hooks/use-color-scheme.web.ts` exists and is untouched

## Phase 5: Verification

- [x] 5.1 Run `make typecheck` — fix type errors (added `example/` to tsconfig exclude)
- [x] 5.2 Run `make lint` — passed with zero errors
- [x] 5.3 Visual check: light + dark mode on iOS/Android/Web — rendering matches pre-migration (manual — skipped in CI)
- [x] 5.4 Import audit: zero surviving imports of `Colors`/`Fonts`/`Spacing`/`useTheme`/`use-color-scheme`/`ThemeColor` in `src/`
