# Design: Shared Location Subscription Context

## Technical Approach

Introduce a Zustand store `useLocationStore` in `src/store/location-store.ts` that manages permissions and coordinate watching. Consuming components (`TripMap` and `useOfflineGeofence`) will select state from `useLocationStore` directly, avoiding unnecessary React re-renders.

## Architecture Decisions

### Decision: Zustand for Global Location State

- **Choice**: Implement `useLocationStore` in `src/store/location-store.ts`.
- **Alternatives considered**: React Context (rejected to avoid re-rendering entire component subtrees on coordinate updates).
- **Rationale**: Zustand allows fine-grained subscription using selectors, which ensures that components only re-render if the specific property they consume (e.g. coordinates or status) actually changes. It weighs ~1.1KB and runs outside the React render tree.

## Data Flow

```
                     [Location.watchPositionAsync]
                                  │
                                  ▼ (updates state)
                      [useLocationStore (Zustand)]
                                  │
                  ┌───────────────┴───────────────┐
                  ▼                               ▼
      state => state.coords             state => state.coords
                  │                               │
                  ▼                               ▼
       [TripMap (Home list)]             [useOfflineGeofence (Detail)]
```

## File Changes

| File                                | Action | Description                                                                       |
| ----------------------------------- | ------ | --------------------------------------------------------------------------------- |
| `src/store/location-store.ts`       | Create | Exposes Zustand store and subscription initializer.                               |
| `src/app/_layout.tsx`               | Modify | Trigger location subscription initialization on mount.                            |
| `src/components/trip-map.tsx`       | Modify | Consume coordinates from store for distance calculations.                         |
| `src/hooks/use-offline-geofence.ts` | Modify | Consume coordinates/status from store to calculate geofence status synchronously. |

## Interfaces / Contracts

`src/store/location-store.ts`:

```typescript
export interface LocationState {
  coords: { latitude: number; longitude: number } | null;
  accuracy: number | null;
  status: 'initializing' | 'weak' | 'ready';
  errorMsg: string | null;
}

export interface LocationStore extends LocationState {
  startWatching: () => () => void;
}
```

## Testing Strategy

| Layer       | What to Test                     | Approach                                                                         |
| ----------- | -------------------------------- | -------------------------------------------------------------------------------- |
| Unit        | Store state updates              | Call `startWatching` and mock `expo-location` updates, validating store updates. |
| Unit (Hook) | `useOfflineGeofence` integration | Mock `useLocationStore` hook output and verify geofence distance calculation.    |

## Migration / Rollout

No migration required.
