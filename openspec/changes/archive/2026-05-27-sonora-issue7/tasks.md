# Tasks: Native Icon Systems

**Change**: `sonora-issue7`

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~68 (52 additions + 16 deletions, 9 PNG files removed) |
| Largest single phase | Phase 3 (Web Tabs, ~25 lines) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | ask-on-risk |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

**Rationale**: ~68 changed lines (52 added, 16 removed) across 4 source files + 9 binary PNG deletions is well within the 400-line review budget. No shared files, no integration risk — a single PR is the obvious approach. All tasks are marked COMPLETED (implementation merged in PR #13).

---

## Phase 1: Icon Component — Foundation ✅

**Scope**: Create the reusable `Icon` wrapper around `expo-symbols` `SymbolView`. This is consumed by web tabs and available for future Icon consumers.

**Files**: `src/components/icon.tsx`

- [x] Create `src/components/icon.tsx` with `Icon` component wrapping `SymbolView`
- [x] Define `IconProps` type: `ios: SFSymbol` (required), `android?: AndroidSymbol`, `web?: AndroidSymbol`, `size?: number`, `tintColor?: string`
- [x] Forward props to `<SymbolView name={{ ios, android, web }} size={size} tintColor={tintColor} />`
- [x] Re-export types `SFSymbol`, `AndroidSymbol` from `expo-symbols` transparently

**Estimated lines**: 14 (all new)

**Dependencies**: None

**Verification**:
- [x] `make typecheck` — no errors
- [x] Typing: `ios` is required, `android`/`web` optional per spec scenario
- [x] Default `size` of 24 matches design spec

---

## Phase 2: Native Tabs — Ionicons ✅

**Scope**: Replace PNG `require(...)` calls with `NativeTabs.Trigger.VectorIcon` using Ionicons family.

**Files**: `src/components/app-tabs.tsx`

- [x] Add import `Ionicons from '@expo/vector-icons/Ionicons'`
- [x] Remove all `require('@/assets/images/tabIcons/*.png')` Image source references
- [x] Define `iconProps = { renderingMode: 'template' as const }` for theme-aware tinting
- [x] Replace each `NativeTabs.Trigger.Icon` `src` prop with `<NativeTabs.Trigger.VectorIcon family={Ionicons} name="home-outline" />` (and `compass-outline`, `settings-outline`)
- [x] Wire `renderingMode: "template"` via `{...iconProps}` spread on each `NativeTabs.Trigger.Icon`

**Estimated lines**: ~15 changed (9 added, 6 removed)

**Dependencies**: Phase 1 (no — Icon component is web-only, native uses VectorIcon directly)

**Verification**:
- [x] `make typecheck` — no errors
- [x] Three tab triggers render with Ionicons: home-outline, compass-outline, settings-outline
- [x] `renderingMode: "template"` inherits parent tint color

---

## Phase 3: Web Tabs — SymbolView + Icon ✅

**Scope**: Wire the new `Icon` component into web tab bar with platform-discriminated names. Add `TabButton` wrapper for focused/unfocused icon styling.

**Files**: `src/components/app-tabs.web.tsx`

- [x] Add import `{ Icon }` from `./icon`
- [x] Define `IconSymbols` type: `{ ios: SFSymbol; android: AndroidSymbol; web: AndroidSymbol }`
- [x] Create `TabButton` component accepting `icon: IconSymbols` + `TabTriggerSlotProps`
- [x] Replace PNG placeholder image references with `<Icon ios={...} android={...} web={...} size={14} tintColor={...} />`
- [x] Platform icon names per spec:
  - Home: `{ ios: 'house', android: 'home', web: 'home' }`
  - Explore: `{ ios: 'compass.drawing', android: 'explore', web: 'explore' }`
  - Settings: `{ ios: 'gear', android: 'settings', web: 'settings' }`
- [x] `tintColor` conditional on `isFocused`: focused `'rgb(107 114 128)'`, unfocused `'rgb(156 163 175)'`

**Estimated lines**: ~25 changed (20 added, 5 removed)

**Dependencies**: Phase 1 (`Icon` component must exist)

**Verification**:
- [x] `make typecheck` — no errors
- [x] Three tab slugs (home, explore, settings) render with platform-discriminated Icon
- [x] Focused vs unfocused tintColor differs
- [x] `SymbolView` receives all three name keys on web

---

## Phase 4: Dependencies & Cleanup ✅

**Scope**: Add `@expo/vector-icons` dependency, delete all PNG assets from `assets/images/tabIcons/`.

**Files**: `package.json`, `bun.lock`, `assets/images/tabIcons/` (9 files)

- [x] Add `@expo/vector-icons` to `package.json` dependencies
- [x] Run `bun install` → lockfile update (bun.lock)
- [x] Delete `assets/images/tabIcons/home.png`, `home@2x.png`, `home@3x.png`
- [x] Delete `assets/images/tabIcons/explore.png`, `explore@2x.png`, `explore@3x.png`
- [x] Delete `assets/images/tabIcons/settings.png`, `settings@2x.png`, `settings@3x.png`
- [x] Confirm no stale `require('@/assets/images/tabIcons/*')` remains in codebase

**Estimated lines**: ~14 changed (package.json + bun.lock), 9 binary files deleted

**Dependencies**: Phases 2-3 (remove require imports before deleting PNGs)

**Verification**:
- [x] `make validate` — all checks pass
- [x] `grep -r 'tabIcons' src/` — zero results
- [x] Project builds without errors

---

## Implementation Order

```
Phase 1 (Icon) ──► Phase 3 (Web Tabs) ──► Phase 2 (Native Tabs)
                                              │
                           Phase 4 (Cleanup) ◄─┘
```

Phase 1 has no dependencies. Phase 3 depends on Phase 1. Phases 2 and 4 are independent of Phase 1/3 (native tabs use VectorIcon, not the Icon component). Phase 4 must wait until Phase 2 removes `require(...)` calls and Phase 3 removes PNG image refs before the files can be deleted. In practice, a single commit handled all phases atomically.

---

## Verification Checklist (Final)

- [x] `make typecheck` — zero type errors
- [x] `bun run test` — all tests pass
- [x] `grep -r 'tabIcons' src/` — zero results (no stale imports)
- [x] Web: three tabs render with SymbolView icons, focused/unfocused tint works
- [x] Native: three tabs render with Ionicons, `renderingMode: "template"` inherits tint
- [x] `assets/images/tabIcons/` directory no longer exists
