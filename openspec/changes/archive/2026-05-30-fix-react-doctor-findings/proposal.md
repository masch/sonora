# Proposal: Fix react-doctor Findings

## Intent

Clean all 19 react-doctor findings (score 92→100) across 10 source files. These range from mechanical style fixes to architecture decisions about component extraction and dead code. No behavioral changes — pure code health.

## Scope

### In Scope

- Fix all 19 findings grouped by impact level (mechanical, careful, architecture)
- Remove 2 truly unused exports (`TabButton`, `CustomTabList` → internal only)
- Mark 4 false-positive exports as suppressed (deslop can't resolve Expo Router conventions or `@/` aliases)
- Delete unused `react-doctor` devDependency (runs via bunx)
- Suppress `deslop/unused-file` on `_layout.tsx` (Expo Router convention — loaded automatically)
- Extract `TabButton` + `CustomTabList` from `app-tabs.web.tsx` to own file
- Fix `no-polymorphic-children` via type assertion instead of `typeof children`

### Out of Scope

- Behavioral or functional changes
- Upgrade or remove `expo-linear-gradient` if no obvious replacement (needs investigation per SDK 56 docs)
- Refactoring beyond the 19 findings (other components, tests, architecture)

## Capabilities

### New Capabilities

None — pure code health pass, no spec-level behavior changes.

### Modified Capabilities

None — no existing requirements change behaviorally.

## Approach

Group into 3 PR chains for review safety:

**PR 1 — Mechanical (7 issues, ~80 lines):**

- `design-no-redundant-size-axes`: `w-16 h-16` → `size-16` (settings.tsx:27, collapsible.tsx:20)
- `design-no-redundant-padding-axes`: `px-4 py-4` → `p-4` (index.tsx:74)
- `rn-no-raw-text`: Wrap "Custom Hint" in `<ThemedText>` in test
- `unused-dev-dependency`: Remove `react-doctor` from devDependencies
- `unused-export` (2 truly unused): Remove `export` from `TabButton` + `CustomTabList`
- Add `eslint-disable` + deslop suppression comments for 4 false-positive exports

**PR 2 — Careful (6 issues, ~120 lines):**

- `no-z-index-9999`: Replace `zIndex: 1000` with calculated values based on stacking context
- `rn-no-dimensions-get`: Move `Dimensions.get('screen')` into component → use `useWindowDimensions()` hook; keyframes that depend on scale factor must be recreated inside component lifecycle
- `rn-no-legacy-expo-packages`: Investigate `expo-linear-gradient` replacement; if replacement exists, migrate; if not, add suppression with documented reason

**PR 3 — Architecture (6 issues, ~200 lines):**

- `no-multi-comp` + `no-polymorphic-children`: Extract `TabButton` + `CustomTabList` to `src/components/tab-button.tsx` + `src/components/custom-tab-list.tsx`; fix children type check with explicit `accessibilityLabel` prop
- `unused-file`: Verify `_layout.tsx` is active (Expo Router root layout); add suppression comment linking to Expo Router convention docs. NO DELETE.
- `unused-export` (residual): After extraction, ensure `TabButton` + `CustomTabList` imports are correct

Estimated total: ~400 lines across 10 files. Barely within single-PR budget.

## Affected Areas

| Area                                   | Impact    | Description                                                                                                     |
| -------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------- |
| `src/app/settings.tsx:27`              | Modified  | `w-16 h-16` → `size-16`                                                                                         |
| `src/components/ui/collapsible.tsx:20` | Modified  | `w-6 h-6` → `size-6`                                                                                            |
| `src/app/index.tsx:74`                 | Modified  | `px-4 py-4` → `p-4`                                                                                             |
| `src/__tests__/hint-row.test.tsx:9`    | Modified  | Wrap raw text in `<ThemedText>`                                                                                 |
| `package.json`                         | Modified  | Remove `react-doctor` devDependency                                                                             |
| `src/components/animated-icon.tsx`     | Modified  | `Dimensions.get` → `useWindowDimensions`; `zIndex: 1000` → calculated value; investigate `expo-linear-gradient` |
| `src/components/animated-icon.web.tsx` | Modified  | `zIndex: 1000` → calculated value                                                                               |
| `src/components/app-tabs.web.tsx`      | Modified  | Extract `TabButton` + `CustomTabList`                                                                           |
| `src/components/tab-button.tsx`        | New       | Extracted from `app-tabs.web.tsx`                                                                               |
| `src/components/custom-tab-list.tsx`   | New       | Extracted from `app-tabs.web.tsx`                                                                               |
| `src/app/_layout.tsx`                  | No change | Suppress false-positive only                                                                                    |
| Multiple files                         | No change | Add deslop/eslint suppression comments for false positives                                                      |

## Risks

| Risk                                                                    | Likelihood | Mitigation                                                                     |
| ----------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------ |
| `useWindowDimensions` hook changes module-level keyframe initialization | Medium     | Move keyframe creation inside component or make scale factor reactive          |
| `expo-linear-gradient` replacement changes visual appearance            | Low        | Keep existing behavior; suppress if no direct replacement                      |
| `_layout.tsx` is actually dead code → deleting it breaks tabs           | Low        | Verify app starts with tabs before suppressing; test manually                  |
| deslop suppression comments break lint rules                            | Low        | Use `// eslint-disable-next-line deslop/unused-export` with scoped suppression |

## Rollback Plan

- PRs can be reverted individually (3 independent PRs).
- `size-16` is cosmetic-only — zero functional risk.
- `useWindowDimensions` change: if keyframe animation breaks, revert to `Dimensions.get('screen')`.
- `expo-linear-gradient`: if replacement causes visual regression, revert to old import.

## Dependencies

- Expo SDK 56 docs for `expo-linear-gradient` deprecation replacement
- Expo Router v3 docs confirming `_layout.tsx` auto-loading convention

## Success Criteria

- [ ] `make doctor` exits 0 with zero findings
- [ ] All existing tests pass (`make test` or `bun test`)
- [ ] App renders correctly on web + native with tabs working
- [ ] `make typecheck` passes
- [ ] `make lint` passes
