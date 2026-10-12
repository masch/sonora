# Tasks: UI Maintainability Refactoring

## Review Workload Forecast

| Field                   | Value         |
| ----------------------- | ------------- |
| Estimated changed lines | ~250          |
| 400-line budget risk    | Medium        |
| Chained PRs recommended | No            |
| Suggested split         | Single PR     |
| Delivery strategy       | batch-by-file |

## Phase 0: Baseline Verification

- [x] 0.1 Run `make test-front` and ensure all existing frontend tests pass.

## Phase 1: Duplicate JSX Elimination

- [x] 1.1 Refactor `src/app/(tabs)/explore.tsx` to extract banner.
- [x] 1.2 Refactor `src/components/track-detail-view.tsx` to unify platform wrapper.

## Phase 2: Control-Flow Complexity Reduction (Hooks & Utilities)

- [x] 2.1 Refactor `src/components/screen-wrapper.tsx` to simplify layout branches.
- [x] 2.2 Refactor `src/components/feedback-form.tsx` to extract form state management hook.
- [x] 2.3 Refactor `src/components/audio-media-controls.tsx` to decompose playback speed and action controls.
- [x] 2.4 Refactor `src/components/global-audio-player.tsx` to extract route/visibility checks and mini player.

## Phase 3: Monolithic Views Decomposition

- [x] 3.1 Refactor `src/components/track-detail-view.tsx` to decompose into subcomponents.
- [x] 3.2 Refactor `src/components/trip-detail-view.tsx` to decompose into subcomponents.

## Phase 4: Full Verification

- [x] 4.1 Run `cd apps/mobile && bun run doctor --verbose --scope full -y --blocking warning`.
- [x] 4.2 Run `make test-front` and `make test-shared`.
- [x] 4.3 Run `make lint` and `make typecheck`.
- [x] 4.4 Generate `verify-report.md`.
