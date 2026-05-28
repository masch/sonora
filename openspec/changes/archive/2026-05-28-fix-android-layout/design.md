# Design: Fix Android Layout

## Technical Approach

Three independent layout issues in `index.tsx` (Home) and `settings.tsx` (Settings) cause content mispositioning on Android. Explore renders correctly — its pattern (`flex-grow` + padding-based vertical spacing + single SafeAreaView) is the reference. Fix each screen independently; the `BottomTabInset` audit is informational only.

## Architecture Decisions

### Decision 1: Home hero `flex-1` → padding-based spacing

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **A — `flex-grow` + `py-16` on hero** | Removes `flex-basis: 0` platform sensitivity; card+text follow hero naturally instead of being pinned to bottom | ✅ **Chosen** |
| B — Keep `flex-1`, add `min-height` guard | Band-aid; still platform-sensitive for taller screens | Rejected |
| C — Switch to ScrollScreenWrapper | Adds scroll to Home — changes UX intent for a screen with fixed layout | Rejected |

**Rationale**: `flex-1` (flex-basis: 0) makes the hero consumer ALL available vertical space after siblings. On Android, available space differs due to status bar / nav bar / tab bar combined height. Padding (`py-16`) is deterministic. The visual cost — hero's siblings no longer pinned to screen bottom — is acceptable for consistent cross-platform rendering. The card still renders below the hero content with `SECTION_GAP` (16px) spacing.

**Note**: This is a deliberate visual change on iOS too — the card moves up from absolute bottom to below hero + padding. Test both platforms.

### Decision 2: Settings inner SafeAreaView removal

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **A — Replace `<SafeAreaView>` with `<TwView>`** | Same className kept (`flex-1 max-w-[800px]`); no top-padding duplication | ✅ **Chosen** |
| B — Keep SafeAreaView, adjust top padding | Treats symptom not cause; still two insets fighting | Rejected |

**Rationale**: `ScreenWrapper` already wraps content in a `SafeAreaView`. The nested one in settings.tsx is a copy-paste artifact — double top padding on Android (~24–48dp × 2). The fix is unambiguous: `<SafeAreaView>` → `<TwView>`, same layout props.

### Decision 3: BottomTabInset audit (informational)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **A — Keep 80px, flag for visual verify** | Material 3 bottom nav spec = 80dp with label; reasonable estimate. No measurement from JS possible. | ✅ **Chosen** |
| B — Use `useSafeAreaInsets().bottom` dynamically | Returns system nav bar height (gesture ~20dp), NOT tab bar height — wrong value | Rejected |
| C — Measure native bar at runtime | No JS API to read `NativeTabs` rendered height | Impossible |

**Rationale**: `BottomTabInset = 80` matches Material 3 spec for bottom navigation with labels. Combined with `TabBottomPadding = 16`, total = 96px. Cannot verify without running on real Android device — mark as manual check during verify phase.

## Data Flow

No data flow changes. Pure layout — component tree structure stays identical; only flex and padding values change.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/index.tsx` | Modify | Hero section: `flex-1` → `flex-grow` + `py-16` on the inner TwView (line 53) |
| `src/app/settings.tsx` | Modify | Inner `<SafeAreaView>` (line 15) → `<TwView>` with same className |
| `src/constants/theme.ts` | None | No change — audit results are documented, value stays at 80 |

## Interfaces / Contracts

No new types, contracts, or APIs. The `TwView`, `ScreenWrapper`, `BottomTabInset` interfaces are unchanged.

## Affected Code

### Home diff (index.tsx, line 53)

```diff
- <TwView className="items-center justify-center flex-1 px-6 gap-6">
+ <TwView className="items-center justify-center px-6 gap-6 py-16">
```

The `flex-1` (flex: 1 1 0) becomes no flex shorthand — TwView defaults to flex-grow:0, flex-shrink:1, flex-basis:auto. The hero renders at its natural content height + 32px vertical padding; siblings flow below with the existing `gap: SECTION_GAP`.

### Settings diff (settings.tsx, line 15)

```diff
- <SafeAreaView className="flex-1 max-w-[800px]">
+ <TwView className="flex-1 max-w-[800px]">
```

The inner safe-area wrapper is removed. The `TwScrollView` inside inherits the same width constraint. Only top padding changes — no side effects on bottom spacing because `ScreenWrapper` already provides the bottom tab bar inset.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Home renders title, badges, hints | `make test` — existing tests (< 42 lines, no layout assertions) pass unchanged |
| Unit | Settings renders all sections | `make test` — existing tests pass unchanged (`<SafeAreaView>` is not asserted by text-based queries) |
| Visual | Home iOS — card not mispositioned | Manual — run iOS simulator, verify hero centered-ish, card visible below |
| Visual | Settings Android — no double top gap | Manual — run Android emulator, verify first visible element at correct Y |
| Gate | Full CI | `make validate` (test → lint → typecheck) |

No new tests needed — the fix is pure layout with no behavioral contract. Text queries in existing tests are unaffected by layout changes. Visual verification is the real gate.

## Migration / Rollout

No migration. Two independent single-line changes in separate files — can be applied atomically or as separate commits. Revert individually without cross-effect.

## Open Questions

- [ ] **Home visual on iOS**: Does `py-16` match the original centering feel? May need adjustment to `py-20` or `py-12` after emulator comparison.
- [ ] **Android BottomTabInset=80**: Confirm on real Android device that 96px total bottom padding is correct for NativeTabs height.
