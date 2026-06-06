# Tasks: Swap Home/Explore tabs and hide Explore & Settings

## Review Workload Forecast

| Field                   | Value       |
| ----------------------- | ----------- |
| Estimated changed lines | ~40-60      |
| 400-line budget risk    | Low         |
| Chained PRs recommended | No          |
| Suggested split         | Single PR   |
| Delivery strategy       | ask-on-risk |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                        | Likely PR | Notes                                                                         |
| ---- | --------------------------- | --------- | ----------------------------------------------------------------------------- |
| 1    | Full implementation + tests | Single PR | All changes are tightly coupled; splitting would add overhead with no benefit |

---

## Phase 1: Foundation — TabDefinition + Config

- [x] 1.1 Add `hidden?: boolean` to `TabDefinition` interface in `src/constants/tabs.ts`
- [x] 1.2 Set `hidden: true` on the `explore` and `settings` entries in the `TABS` array

## Phase 2: Content Swap

- [x] 2.1 Replace content in `src/app/(tabs)/index.tsx` — import `TripMap` from `@/components/trip-map/trip-map`, render inside existing `ScrollScreenWrapper`
- [x] 2.2 Replace content in `src/app/(tabs)/explore.tsx` — import old Home screen components (`AnimatedIcon`, download card, audio player, hints) and render inside `ScrollScreenWrapper`

## Phase 3: Tab Hiding — Renderer Filter

- [x] 3.1 In `src/components/app-tabs.tsx` (native), add `.filter((tab) => !tab.hidden)` before `.map()`
- [x] 3.2 In `src/components/app-tabs.web.tsx` (web), add `.filter((tab) => !tab.hidden)` before `.map()`

## Phase 4: Tests

- [x] 4.1 Update `src/__tests__/app-tabs.test.tsx` — assert only 1 `NativeTabs.Trigger` rendered (`index`), expect `explore`/`settings` triggers to NOT render
- [x] 4.2 Update `src/__tests__/app-tabs.web.test.tsx` — assert only 1 `TabTrigger` rendered (`index`), expect `explore`/`settings` triggers to NOT render

## Discrepancy Note: Additional files updated

The following files were NOT listed in original tasks but needed updating because the content swap broke them:

- `src/__tests__/index.test.tsx` — Updated to test TripMap content (was testing old Home content)
- `src/__tests__/explore.test.tsx` — Updated to test old Home content (was testing TripMap content)
