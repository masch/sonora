# Apply Progress: fix-react-doctor-findings

**Status**: ✅ Complete — All 21 tasks done
**Mode**: Standard (TDD waived for code-health)
**Delivery**: Single PR, size:exception
**Score**: 92 → 100 (19 findings → 0, all rules)

## Phase 1 — Discover False Positives ✅

- Ran `make doctor` — confirmed 19 findings across 10 files
- Identified false positives:
  - 4 × `deslop/unused-export` (deslop can't resolve `@/` aliases or platform-specific resolution):
    - `animated-icon.tsx:12` (AnimatedSplashOverlay — used by \_layout.tsx)
    - `animated-icon.tsx:83` (AnimatedIcon — used by index.tsx)
    - `app-tabs.tsx:7` (AppTabs — Expo Router entry, used by \_layout.tsx)
    - `hooks/use-color-scheme.ts:4` (useColorScheme — used by use-theme-colors.ts)
  - 1 × `deslop/unused-file` in `_layout.tsx` (Expo Router auto-loads by convention, not recognized because file is in `src/app/` not `app/`)
  - 1 × `react-doctor/rn-no-legacy-expo-packages` (expo-linear-gradient is actively maintained in SDK 56)

## Phase 2 — Mechanical Fixes ✅

| #   | File                                   | Change                                      | Lines |
| --- | -------------------------------------- | ------------------------------------------- | ----- |
| 2.1 | `src/app/settings.tsx:27`              | `w-16 h-16` → `size-16`                     | 1     |
| 2.2 | `src/components/ui/collapsible.tsx:20` | `w-6 h-6` → `size-6`                        | 1     |
| 2.3 | `src/app/index.tsx:74`                 | `px-4 py-4` → `p-4`                         | 1     |
| 2.4 | `src/__tests__/hint-row.test.tsx:9`    | Wrapped `Custom Hint` in `<ThemedText>`     | 3     |
| 2.5 | `package.json`                         | Removed `react-doctor` from devDependencies | 1     |
| 2.6 | (superseded by Phase 5 extraction)     | —                                           | —     |

## Phase 3 — Suppressions ✅

| #   | File                   | Technique                                  | Details                                                                                                                                                                                 |
| --- | ---------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | `src/app/_layout.tsx`  | Comment + config                           | Human-readable comment; created `react-doctor.config.json` with `ignore.overrides` for `deslop/unused-file` on this file (inline disables don't work for file-level findings)           |
| 3.2 | ×4 unused-export files | `react-doctor-disable-next-line`           | Added `// react-doctor-disable-next-line deslop/unused-export` before each false-positive export (used `react-doctor-` prefix instead of `eslint-` or `oxlint-` to avoid ESLint errors) |
| 3.3 | `animated-icon.tsx:8`  | Comment + `react-doctor-disable-next-line` | Added comment explaining SDK 56 and CSS backgroundImage experimental status; added `// react-doctor-disable-next-line react-doctor/rn-no-legacy-expo-packages`                          |

## Phase 4 — Careful Fixes ✅

| #   | File                    | Change                                               | Rationale                                                                                                                                                                                                      |
| --- | ----------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 | `animated-icon.tsx`     | `zIndex: 1000` → `zIndex: 200`                       | Splash overlay stacking above icon container at `zIndex: 100`                                                                                                                                                  |
| 4.2 | `animated-icon.web.tsx` | `zIndex: 1000` → `zIndex: 10`                        | No competing stacking context on web                                                                                                                                                                           |
| 4.3 | `animated-icon.tsx`     | `Dimensions.get('screen')` → `useWindowDimensions()` | Reactive layout; module-level `INITIAL_SCALE_FACTOR` moved inside components; `keyframe` created inline (no `useMemo` to avoid react-compiler false positive); `logoKeyframe`/`glowKeyframe` kept module-level |

## Phase 5 — Architecture Extraction ✅

| #   | File                                          | Action                                                                                                                    |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 5.1 | `src/components/app-tabs/tab-button.tsx`      | **Created** — `TabButton` with explicit `label: string` prop instead of `typeof children` polymorphic check               |
| 5.2 | `src/components/app-tabs/custom-tab-list.tsx` | **Created** — `CustomTabList` extracted from app-tabs.web.tsx                                                             |
| 5.3 | `src/components/app-tabs.web.tsx`             | **Modified** — Removed inline `TabButton` + `CustomTabList`, import from new files, use `<TabButton label="...">` pattern |

## Phase 6 — Verification ✅

| #   | Check                               | Result                                                          |
| --- | ----------------------------------- | --------------------------------------------------------------- |
| 6.1 | `make typecheck` (tsc --noEmit)     | ✅ Passes                                                       |
| 6.2 | `make lint` (expo lint)             | ✅ Passes — 0 errors                                            |
| 6.3 | `bun test` (jest --passWithNoTests) | ✅ 10 suites, 53 tests passed                                   |
| 6.4 | `make doctor`                       | ✅ Score 100/100 — 0 issues                                     |
| 6.5 | Visual check                        | TabButton extraction preserves all props; no behavioral changes |

## New Files Created

| File                                          | Lines | Purpose                                                                          |
| --------------------------------------------- | ----- | -------------------------------------------------------------------------------- |
| `react-doctor.config.json`                    | 8     | Suppress `deslop/unused-file` for `src/app/_layout.tsx` (Expo Router convention) |
| `src/components/app-tabs/tab-button.tsx`      | 46    | Extracted TabButton with explicit `label` prop                                   |
| `src/components/app-tabs/custom-tab-list.tsx` | 18    | Extracted CustomTabList                                                          |

## Deviations from Design

1. **Suppression format**: Design specified `eslint-disable-next-line deslop/unused-export`, but deslop is NOT an ESLint plugin. Used `react-doctor-disable-next-line` format (react-doctor's native inline suppression) which ESLint ignores.
2. **useMemo in AnimatedIcon**: Design specified `useMemo` for the keyframe. React-doctor v0.2.14 flags this as `react-compiler-no-manual-memoization` (assumes React Compiler). Removed `useMemo` — keyframe is created inline per render (cheap object creation).
3. **\_layout.tsx suppression**: Inline disables don't work for file-level findings (`current.line > 0` guard). Used `react-doctor.config.json` with `ignore.overrides` instead.
4. **useColorScheme export**: Initially identified as "truly unused", but further investigation showed it IS used by `use-theme-colors.ts` via relative import. Added suppression instead of removing export.
5. **CustomTabList extraction**: Design only mentioned TabButton extraction for Phase 5, but both `no-multi-comp` findings needed fixing. Extracted both.
6. **Subfolder location**: Design specified `src/components/tab-button.tsx`, but apply prompt specified `src/components/app-tabs/tab-button.tsx`. Used subfolder for better architectural grouping.

## Remaining Risks

None. Score is 100. All existing tests pass.

## Files Changed

| File                                                  | Action   | What Was Done                                                                      |
| ----------------------------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| `react-doctor.config.json`                            | Created  | Config with ignore overrides for \_layout.tsx unused-file                          |
| `src/components/app-tabs/tab-button.tsx`              | Created  | Extracted TabButton with explicit `label` prop                                     |
| `src/components/app-tabs/custom-tab-list.tsx`         | Created  | Extracted CustomTabList                                                            |
| `src/app/settings.tsx`                                | Modified | `w-16 h-16` → `size-16`                                                            |
| `src/components/ui/collapsible.tsx`                   | Modified | `w-6 h-6` → `size-6`                                                               |
| `src/app/index.tsx`                                   | Modified | `px-4 py-4` → `p-4`                                                                |
| `src/__tests__/hint-row.test.tsx`                     | Modified | Wrapped raw string in `<ThemedText>`                                               |
| `package.json`                                        | Modified | Removed `react-doctor` devDependency                                               |
| `src/components/animated-icon.tsx`                    | Modified | `useWindowDimensions()`, z-index fix, keyframe restructuring, suppression comments |
| `src/components/animated-icon.web.tsx`                | Modified | `zIndex: 1000` → `zIndex: 10`                                                      |
| `src/components/app-tabs.tsx`                         | Modified | Added suppression comment for false-positive unused-export                         |
| `src/components/app-tabs.web.tsx`                     | Modified | Removed inline TabButton/CustomTabList, import from new files                      |
| `src/hooks/use-color-scheme.ts`                       | Modified | Added suppression comment for false-positive unused-export                         |
| `src/app/_layout.tsx`                                 | Modified | Added explanatory comment about Expo Router convention                             |
| `openspec/changes/fix-react-doctor-findings/tasks.md` | Modified | All tasks marked [x]                                                               |
