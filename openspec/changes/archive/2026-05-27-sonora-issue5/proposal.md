# Proposal: Migrate Custom Theme to Tailwind v4 @theme (Issue #5)

## Intent

Colors and Fonts are duplicated in `src/constants/theme.ts` and `src/global.css` (`@theme` + `@variant dark`). The runtime exports are dead code except for 3 files that need runtime color strings for native-only props (`SymbolView` tintColor, `NativeTabs` props). Eliminating this dual-source-of-truth reduces imports, removes unused hooks, and centralizes all design tokens in one CSS file.

## Scope

### In Scope

- Replace `Colors` export with a minimal `RuntimeColors` map (5 colors × 2 modes) for the 3 native runtime consumers
- Remove `Fonts` export entirely — zero imports, already live in `@theme`
- Delete `use-theme.ts` — replace with inline `RuntimeColors[scheme]` lookups
- Delete `use-color-scheme.ts` (re-export shim) — keep `.web.ts` for SSR hydration
- Convert `ThemedText` to not depend on `ThemeColor` type (plain string union)
- Add `--spacing-*` tokens to `@theme` in global.css
- Migrate `Spacing.*` style props to Tailwind classes in `index.tsx` and `explore.tsx`

### Out of Scope

- Removing `use-color-scheme.web.ts` (needed for web SSR hydration)
- New features, behavioral changes, or UI redesign
- BottomTabInset + TabBottomPadding computed expression (remains as style prop because BottomTabInset is platform-dependent)

## Capabilities

**New**: None — pure refactor, no new capabilities.
**Modified**: `nativewind-styling` — aligns with existing spec (tokens already in `@theme`).

## Approach

1. Add `--spacing-*` tokens in `@theme` (maps Spacing values to Tailwind spacing scale)
2. Replace `Colors` with a minimal inline `RuntimeColors` map at the bottom of `theme.ts` (3 consumer files only)
3. Remove `Fonts` — all fonts already in `@theme` via platform media queries
4. Delete `use-theme.ts` — inline `RuntimeColors[scheme]` where used (collapsible, explore)
5. Delete `use-color-scheme.ts` — all consumers import from `react-native` directly
6. Convert `ThemeColor` in ThemedText to a plain `'text' | 'textSecondary' | 'background' | 'backgroundElement' | 'backgroundSelected'` union
7. Convert `Spacing.*` style props to Tailwind classes in `index.tsx` and `explore.tsx` (keep computed `BottomTabInset + Spacing.three` as style)

## Affected Areas

| Area                                | Impact   | Description                                            |
| ----------------------------------- | -------- | ------------------------------------------------------ |
| `src/global.css`                    | Modified | Add spacing tokens to @theme                           |
| `src/constants/theme.ts`            | Modified | Remove Colors/Fonts, add RuntimeColors, remove Spacing |
| `src/hooks/use-theme.ts`            | Removed  | Inline into consumers                                  |
| `src/hooks/use-color-scheme.ts`     | Removed  | Unused re-export shim                                  |
| `src/components/themed-text.tsx`    | Modified | ThemeColor → string union                              |
| `src/components/app-tabs.tsx`       | Modified | Colors → RuntimeColors                                 |
| `src/components/app-tabs.web.tsx`   | Modified | Colors → RuntimeColors                                 |
| `src/components/ui/collapsible.tsx` | Modified | useTheme → direct lookup                               |
| `src/app/explore.tsx`               | Modified | useTheme → direct lookup; Spacing → className          |
| `src/app/index.tsx`                 | Modified | Spacing → className                                    |

## Risks

| Risk                                      | Likelihood | Mitigation                                         |
| ----------------------------------------- | ---------- | -------------------------------------------------- |
| RuntimeColors out of sync with @theme     | Low        | Single source in theme.ts, comment pointing to CSS |
| use-color-scheme.ts delete breaks web SSR | Med        | Keep `.web.ts`, test web build before merge        |
| Missed Colors import                      | Low        | `make typecheck` catches dead imports              |

## Rollback Plan

Revert the PR commit. No schema, data, or API changes — purely a codebase refactor.

## Dependencies

- Tailwind v4 + NativeWind v5 already configured and proven
- `nativewind-env.d.ts` auto-generates types for new `@theme` tokens

## Success Criteria

- [ ] `make typecheck` and `make lint` pass
- [ ] Light + dark mode rendering identical on iOS, Android, Web
- [ ] Zero imports of `Colors`, `Fonts`, `useTheme`, `use-color-scheme` (the shim)
- [ ] No `ThemeColor` type exported from `theme.ts`
