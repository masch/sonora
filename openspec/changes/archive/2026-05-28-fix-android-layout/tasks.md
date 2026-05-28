# Tasks: Fix Android Layout

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 4 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Home Screen Fix

- [x] 1.1 `src/app/index.tsx` line 53 — remove `flex-1`, add `py-16` on hero `<TwView>`

## Phase 2: Settings Screen Fix

- [x] 2.1 `src/app/settings.tsx` line 15 — replace `<SafeAreaView` with `<TwView>`, replace `</SafeAreaView>` with `</TwView>`
- [x] 2.2 `src/app/settings.tsx` line 3 — remove unused `SafeAreaView` import

## Phase 3: Verification

- [x] 3.1 Run `make validate` — tests, lint, typecheck
- [ ] 3.2 Visual verify on Android emulator — Home centered, Settings no double top padding
- [ ] 3.3 Visual regression check on iOS simulator — both screens render correctly
- [ ] 3.4 Confirm BottomTabInset=80 on real Android device (manual, flagged)
