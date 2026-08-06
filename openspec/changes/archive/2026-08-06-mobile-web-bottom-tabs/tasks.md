# Tasks: Mobile Web Bottom Navigation Tabs

## Review Workload Forecast

| Field                   | Value     |
| ----------------------- | --------- |
| Estimated changed lines | ~30-60    |
| 400-line budget risk    | Low       |
| Chained PRs recommended | No        |
| Suggested split         | Single PR |
| Delivery strategy       | direct    |
| Chain strategy          | none      |

## Phase 1: Layout & Component Styling

- [x] 1.1 Update `CustomTabList` in `apps/mobile/src/components/app-tabs/custom-tab-list.tsx` to position tab bar at the bottom (`bottom-0 z-50` / inset adjustments) on web.
- [x] 1.2 Use default parameter `testID = 'custom-tab-list'` in `CustomTabList` function signature.

## Phase 2: Dead Code Elimination

- [x] 2.1 Remove `<AppVersionText />` element and import from `apps/mobile/src/app/(tabs)/index.tsx`.
- [x] 2.2 Delete obsolete `apps/mobile/src/components/app-version-text.tsx` and `apps/mobile/src/__tests__/app-version-text.test.tsx`.

## Phase 3: Web Tab Tests & Verification

- [x] 3.1 Update `apps/mobile/src/__tests__/app-tabs.web.test.tsx` to assert bottom positioning / styling classes on web tab bar component.
- [x] 3.2 Run `make validate` to ensure all typechecks, linters, React Doctor checks, and unit tests pass without regressions.
