## Exploration: Shared Location Subscription Context

### Current State

Currently, `TripMap` (Home) and `useOfflineGeofence` (Detail Map) fetch and subscribe to the device's location independently.

- `TripMap` runs a one-time async geolocation query on mount to calculate trip distances.
- `useOfflineGeofence` spins up a new foreground GPS watch subscription (`Location.watchPositionAsync`) when the trip details page opens, causing battery drain and a delay before the first location lock is acquired.

### Affected Areas

- [use-offline-geofence.ts](file:///home/masch/dev/js/sonora/src/hooks/use-offline-geofence.ts) — Computes the geofence proximity based on user position.
- [trip-map.tsx](file:///home/masch/dev/js/sonora/src/components/trip-map.tsx) — Displays distances on the home screen.
- [\_layout.tsx](file:///home/masch/dev/js/sonora/src/app/_layout.tsx) — Root layout of the application.
- `src/context/location-context.tsx` [NEW] — Location state provider and consumer hook.

### Approaches

1. **React Context Provider (Recommended)**
   - Create a single `LocationProvider` context at the root of the app (`RootLayout`). It starts one global `Location.watchPositionAsync` subscription.
   - Expose a `useUserLocation()` hook.
   - Refactor `TripMap` and `useOfflineGeofence` to consume `useUserLocation()` directly.
   - **Pros**: Only one active location subscription (better battery life), instant location data when entering trip detail (zero loading state if location was already fetched on home), extremely simplified hooks logic.
   - **Cons**: Small boilerplate addition (context provider).
   - **Effort**: Low/Medium.

### Recommendation

Use Approach 1. It is battery-friendly, clean, and ensures instant loading when navigating.

### Risks

- If location permissions are denied at root, the provider must expose the error state. Both `TripMap` and `useOfflineGeofence` already handle coordinate-free states gracefully.

### Ready for Proposal

Yes.
