# Proposal: Fix Android Layout

## Intent

Home and Settings screens misposition controls on Android while Explore renders correctly. Root causes are platform-sensitive flex distribution and double SafeAreaView nesting — not Android-specific code.

## Scope

### In Scope

1. **Home (`src/app/index.tsx`)** — Replace `flex-1` hero with `flex-grow` + `py-16` padding-based vertical spacing
2. **Settings (`src/app/settings.tsx`)** — Remove nested `<SafeAreaView>` wrapper (double top padding bug)
3. **Audit `BottomTabInset`** — Verify 80px value against actual `NativeTabs` height on Android; propose dynamic inset if mismatch

### Out of Scope

- Explore screen (works correctly)
- Root layout (`_layout.tsx`) or tab navigator
- SafeAreaProvider configuration
- Full screen-by-screen layout audit beyond Home + Settings

## Capabilities

### New Capabilities

None — this is a layout/presentation fix with no new spec-level behavior.

### Modified Capabilities

None — no existing capability requirements change at the spec level.

## Approach

Fix each broken screen independently, matching the verified pattern from Explore:

| Screen             | Current (broken)                                                        | Fix                                                                          | Rationale                                                             |
| ------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Home**           | `flex-1` hero consumes all available vertical space via `flex-basis: 0` | Replace with `flex-grow` (`flex-basis: auto`) + add `py-16` vertical padding | Flex distribution varies by platform height; padding is deterministic |
| **Settings**       | `ScreenWrapper` (SafeAreaView #1) wrapping a second `<SafeAreaView>`    | Remove inner `<SafeAreaView>`, keep outer wrapper                            | Double top padding is a clear bug regardless of platform              |
| **BottomTabInset** | Hardcoded `Platform.select({ ios: 50, android: 80 })`                   | Verify 80px vs native bar on Android; consider `useSafeAreaInsets().bottom`  | Prevent future inset mismatches                                       |

## Affected Areas

| Area                     | Impact            | Description                                    |
| ------------------------ | ----------------- | ---------------------------------------------- |
| `src/app/index.tsx`      | Modified          | Hero section: `flex-1` → `flex-grow` + `py-16` |
| `src/app/settings.tsx`   | Modified          | Remove nested `<SafeAreaView>` wrapper         |
| `src/constants/theme.ts` | Possibly modified | Audit `BottomTabInset = 80` Android value      |

## Risks

| Risk                                                            | Likelihood | Mitigation                                                        |
| --------------------------------------------------------------- | ---------- | ----------------------------------------------------------------- |
| Home visual regression on iOS                                   | Medium     | Match iOS centering carefully; test both platforms before merge   |
| Padding value `py-16` doesn't match original vertical centering | Medium     | Adjust padding after emulator/simulator comparison; iterate value |
| NativeTabs height differs between Android versions              | Low        | Use `useSafeAreaInsets().bottom` instead of hardcoded constant    |

## Rollback Plan

Revert the two file changes individually:

- `git revert <commit>` for Home (`index.tsx`) changes if visual centering is off on iOS
- `git revert <commit>` for Settings (`settings.tsx`) if bottom spacing regresses
- Each fix is independent — revert singly without affecting the other

## Dependencies

- Android emulator or device for visual verification (post-apply)
- iOS simulator for visual regression check

## Success Criteria

- [ ] Home controls render at correct vertical position on Android emulator
- [ ] Settings controls are not pushed down by double safe-area padding on Android
- [ ] Home and Settings still render correctly on iOS simulator (no regression)
- [ ] `make validate` passes (Strict TDD gate)
