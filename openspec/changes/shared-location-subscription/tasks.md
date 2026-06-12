# Tasks: Shared Location Subscription Context

## Review Workload Forecast

| Field                   | Value          |
| ----------------------- | -------------- |
| Estimated changed lines | 200-250        |
| 400-line budget risk    | Low            |
| Chained PRs recommended | No             |
| Suggested split         | Single PR      |
| Delivery strategy       | ask-on-risk    |
| Chain strategy          | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Foundation (Location Store)

- [ ] 1.1 Create `src/store/location-store.ts` with global `useLocationStore` and dynamic location watching via `expo-location`.
- [ ] 1.2 Import `useLocationStore` and invoke `startWatching()` inside a `useEffect` cleanup handler in `src/app/_layout.tsx`.

## Phase 2: Core Implementation (Refactoring Consumers)

- [ ] 2.1 Refactor `src/components/trip-map.tsx` to consume coordinates from `useLocationStore` and remove local geolocation states.
- [ ] 2.2 Refactor `src/hooks/use-offline-geofence.ts` to consume store coordinates and status synchronously.

## Phase 3: Verification

- [ ] 3.1 Update unit tests for `use-offline-geofence.test.ts` to mock `useLocationStore` hook.
- [ ] 3.2 Run formatting, lints, typechecks, and tests via `make format-check test lint typecheck`.
- [ ] 3.3 Verify manually in emulators/browsers.
