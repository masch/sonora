# Proposal: Swap Home/Explore tabs and hide Explore & Settings

## Intent

The tab bar currently shows Home (startup content), Explore (TripMap), and Settings. The user wants TripMap (the primary app feature) as the initial visible tab, with the old Home screen and Settings accessible but **hidden from the tab bar**. No deletion — routes stay, just hidden from chrome.

## Scope

### In Scope

1. Swap UI content between `src/app/(tabs)/index.tsx` and `src/app/(tabs)/explore.tsx` so `index` renders TripMap and `explore` renders the old Home content
2. Add `hidden?: boolean` to `TabDefinition` in `src/constants/tabs.ts`
3. Mark `explore` and `settings` entries as `hidden: true`
4. Filter out hidden tabs in both `app-tabs.tsx` (native) and `app-tabs.web.tsx` (web)
5. Update existing tab tests to match new visible set

### Out of Scope

- Deleting route files — all stay
- Renaming files or routes
- Changing the TripMap component
- Blocking URL access to hidden routes (they remain navigable via `router.push`)

## Capabilities

### New Capabilities

None — this is a UX chrome reconfiguration. No spec-level behavior changes.

### Modified Capabilities

None — existing specs (screen-layout, nativewind-styling) are unaffected.

## Approach

Two-part change:

**Part A — Content swap**: Move the TripMap rendering (`<TripMap />` + wrapper) from `explore.tsx` into `index.tsx`. Move the old Home screen contents (AnimatedIcon, download card, audio player, hints, etc.) from `index.tsx` into `explore.tsx`. Both route files keep their filenames and exports.

**Part B — Tab hiding**: Add `hidden?: boolean` to `TabDefinition` interface. Set `hidden: true` on `explore` and `settings` entries. In both `app-tabs.tsx` and `app-tabs.web.tsx`, filter with `.filter(tab => !tab.hidden)` before rendering triggers. No `initialRouteName` change needed — `index` stays as the initial tab.

## Affected Areas

| Area                                  | Impact   | Description                                      |
| ------------------------------------- | -------- | ------------------------------------------------ |
| `src/app/(tabs)/index.tsx`            | Modified | Replace Home UI with TripMap from explore        |
| `src/app/(tabs)/explore.tsx`          | Modified | Replace TripMap with old Home UI from index      |
| `src/constants/tabs.ts`               | Modified | Add `hidden` field; mark explore+settings hidden |
| `src/components/app-tabs.tsx`         | Modified | Filter `.filter(tab => !tab.hidden)`             |
| `src/components/app-tabs.web.tsx`     | Modified | Same filter for web renderer                     |
| `src/__tests__/app-tabs.test.tsx`     | Modified | Assert only 1 visible trigger (explore filter)   |
| `src/__tests__/app-tabs.web.test.tsx` | Modified | Same assertion for web                           |

## Risks

| Risk                                             | Likelihood | Mitigation                                                             |
| ------------------------------------------------ | ---------- | ---------------------------------------------------------------------- |
| Accidentally break import paths when moving code | Low        | Both files share the same alias base; imports should translate cleanly |
| Flashing initial tab on slow devices             | Low        | New initial screen is TripMap which loads via existing lazy import     |
| Tab state reset from dynamic hidden              | Low        | Static config — navigator mounts once with correct state               |

## Rollback Plan

1. Revert the content swap by restoring `index.tsx` and `explore.tsx` from git (`git checkout -- src/app/\(tabs\)/index.tsx src/app/\(tabs\)/explore.tsx`)
2. Revert the tab hiding by restoring `tabs.ts`, `app-tabs.tsx`, and `app-tabs.web.tsx` (`git checkout -- src/constants/tabs.ts src/components/app-tabs.tsx src/components/app-tabs.web.tsx`)
3. Revert test files similarly
4. Verify the original tab bar renders all 3 tabs with original content

## Dependencies

None.

## Success Criteria

- [ ] `index` tab shows TripMap as its content
- [ ] `explore` tab shows old Home content (AnimatedIcon, download card, hints, etc.)
- [ ] Tab bar shows **only** the `index` tab (Home) — explore and settings are hidden
- [ ] Settings screen is still reachable via `router.push('/settings')`
- [ ] Explore screen is still reachable via `router.push('/explore')`
- [ ] All existing tests pass
