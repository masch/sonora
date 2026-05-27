# Proposal: Migrate StyleSheet Components to NativeWind className

## Intent

Eliminate dual styling (StyleSheet + className) by migrating remaining StyleSheet.create() components to NativeWind className. Infrastructure exists (src/tw/, global.css, Tailwind v4), settings.tsx proves the pattern. Keeping both alive increases cognitive load and blocks full dark: variant adoption.

## Scope

### In Scope
- Register custom color tokens in CSS @theme (Phase 0)
- Migrate: hint-row, web-badge, collapsible (Phase 1)
- Migrate: index.tsx, explore.tsx (Phase 2)
- Migrate: ThemedText, ThemedView (Phase 3)
- Migrate: app-tabs.web.tsx partial (Phase 4)
- Cleanup unused theme constants (Phase 5)

### Not in Scope
- animated-icon.tsx/.web.tsx (Keyframes), app-tabs.tsx native (NativeTabs runtime props), external-link.tsx (no StyleSheet)
- New features or UI redesign

## Capabilities

**New**: None — pure refactor, no new behavior.
**Modified**: None — `nativewind-styling` spec unchanged.

## Approach

**Phase 0** — Prerequisites. Add 5 color tokens to global.css @theme with `light-dark()` fallback. Enables `bg-backgroundElement`, `text-textSecondary` className usage.

**Phase 1** — Leaf components. Remove StyleSheet + Spacing imports. Replace ThemedView/TwView mix with className. Collapsible keeps Animated.View wrapper.

**Phase 2** — Pages. index.tsx (~9 style refs), explore.tsx (~17) → className. Already mixed, fully commit to Tw*.

**Phase 3** — Core wrappers. ThemedView → TwView inline. ThemedText `type` prop maps to utility combos (title → `text-5xl font-semibold leading-[52px]`). Keep component for compat.

**Phase 4** — Web tabs. app-tabs.web.tsx layout → className. Keep Colors for SymbolView tintColor.

**Phase 5** — Cleanup. Remove unused Colors/Spacing/ThemeColor exports. Remove useTheme from migrated files.

**Spacing mapping** (Tailwind defaults, no custom tokens):

| Custom | px | Tailwind |
|--------|----|----------|
| half | 2 | gap-0.5 |
| one | 4 | gap-1 |
| two | 8 | gap-2 |
| three | 16 | gap-4 |
| four | 24 | gap-6 |
| five | 32 | gap-8 |
| six | 64 | gap-16 |

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| src/global.css | Modified | Add 5 color @theme tokens |
| src/components/hint-row.tsx | Modified | StyleSheet → className |
| src/components/web-badge.tsx | Modified | StyleSheet → className |
| src/components/ui/collapsible.tsx | Modified | StyleSheet → className |
| src/components/themed-text.tsx | Modified | Styles → className combos |
| src/components/themed-view.tsx | Removed | Replace with inline TwView |
| src/components/app-tabs.web.tsx | Modified | Layout → className |
| src/app/index.tsx | Modified | StyleSheet → className |
| src/app/explore.tsx | Modified | StyleSheet → className |
| src/constants/theme.ts | Modified | Prune unused exports |
| src/hooks/use-theme.ts | Removed | If unused by migrated files |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Color tokens not registered → className breaks | Low | Phase 0 blocks all, verify first |
| Mixed styles flicker during migration | Med | Test before merge per phase |
| ThemedText type mapping misses minor style | Low | Visual check per type variant |
| useTheme still needed for app-tabs.tsx props | High | Keep hook, remove only from migrated files |

## Rollback Plan

Revert the PR commit. No schema/data changes. Visual only.

## Dependencies

- `nativewind-env.d.ts` must pick up new color tokens (auto-generated)
- Phase 0 must complete before any component PR

## Success Criteria

- [ ] Migrated components render identically in light + dark mode
- [ ] Zero StyleSheet.create() in migrated files
- [ ] No Spacing/Colors imports from theme.ts in migrated files
- [ ] All tests pass (bun run test)
- [ ] `make typecheck` passes
