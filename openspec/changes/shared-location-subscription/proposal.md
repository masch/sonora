# Proposal: Shared Location Subscription Context

## Intent

Replace multiple separate geolocation checks with a single global `LocationStore` managed by Zustand to improve device battery efficiency, optimize React re-renders, and ensure the user's location is preloaded when navigating to a trip detail.

## Scope

### In Scope

- Add `zustand` to dependencies.
- Create `LocationStore` and `useLocationStore` hook in `src/store/location-store.ts`.
- Initialize/subscribe to GPS location when the app starts inside `src/app/_layout.tsx`.
- Refactor `src/components/trip-map.tsx` to consume `useLocationStore` instead of querying the location on mount.
- Refactor `src/hooks/use-offline-geofence.ts` to consume `useLocationStore` and calculate geofence status synchronously.

### Out of Scope

- Background location tracking (foreground tracking is sufficient while the app is active).

## Capabilities

### New Capabilities

- `location-store`: Global Zustand store providing a shared location coordinate stream.

### Modified Capabilities

- `trip-detail-map`: Consumes shared location store instead of managing its own GPS subscription.
- `trip-map`: Consumes shared location store.

## Approach

1. Define a global Zustand store in `src/store/location-store.ts` that encapsulates location coordinates, status, and permissions.
2. Initialize the store's watcher function on RootLayout mounting.
3. Consume coordinates select-wise in both `TripMap` and `useOfflineGeofence`.

## Affected Areas

| Area                                | Impact   | Description                                                         |
| ----------------------------------- | -------- | ------------------------------------------------------------------- |
| `src/store/location-store.ts`       | New      | Global location store using Zustand.                                |
| `src/app/_layout.tsx`               | Modified | Initialize location watching on mount.                              |
| `src/components/trip-map.tsx`       | Modified | Consume location store to calculate distances.                      |
| `src/hooks/use-offline-geofence.ts` | Modified | Rewrite to consume location store instead of starting subscription. |

## Risks

| Risk                              | Likelihood | Mitigation                                                                |
| --------------------------------- | ---------- | ------------------------------------------------------------------------- |
| Denied permissions block tracking | Low        | Store exposes permission error state; consuming views render fallback UI. |

## Rollback Plan

`git checkout main -- src/app/_layout.tsx src/components/trip-map.tsx src/hooks/use-offline-geofence.ts && rm src/store/location-store.ts && bun remove zustand`

## Success Criteria

- [ ] Only a single location subscription is initialized when the app runs.
- [ ] Distances on the Home screen update dynamically.
- [ ] Entering a trip detail immediately displays the user position marker without the "Locating..." fallback if coordinates were already loaded on the home screen.
