# Design: Unified Trip Map with Location Distances

## File Structure

| File                                     | Action | Role                                           |
| ---------------------------------------- | ------ | ---------------------------------------------- |
| `src/components/trip-map.tsx`            | Create | Unified trip card list with location distances |
| `src/app/(tabs)/explore.tsx`             | Create | New Explore screen using TripMap               |
| `src/app/(tabs)/_layout.tsx`             | Create | Tab navigator layout with AppTabs              |
| `src/app/(tabs)/index.tsx`               | Move   | Renamed from `index.tsx`                       |
| `src/app/(tabs)/settings.tsx`            | Move   | Renamed from `settings.tsx`                    |
| `src/app/_layout.tsx`                    | Modify | Stack wrapping (tabs) + trips/[id] screens     |
| `src/app/trips/[id].tsx`                 | Modify | Uses `TripDetailView` + `TripDetailMap`        |
| `src/components/trip-detail-map.tsx`     | Create | Leaflet in WebView for native trip detail      |
| `src/components/trip-detail-map.web.tsx` | Create | Direct Leaflet for web trip detail             |
| `src/components/trip-detail-view.tsx`    | Modify | Clean up, use TripDetailMap                    |
| `src/components/gps-precision-badge.tsx` | Modify | Fix hardcoded strings → i18n                   |
| `src/components/themed-text.tsx`         | Modify | Add `Gps` variant                              |
| `src/components/loading-view.tsx`        | Create | Standard loading spinner + message             |
| `src/constants/tabs.ts`                  | Modify | Remove walk tab                                |
| `src/data/trips.ts`                      | Modify | Add distance formatting utils                  |
| `src/i18n/locales/en.ts`                 | Modify | Add `map.*` keys                               |
| `src/i18n/locales/es.ts`                 | Modify | Add `map.*` keys                               |
| `src/app/explore.tsx`                    | Delete | Replaced by `(tabs)/explore.tsx`               |
| `src/app/walk.tsx`                       | Delete | Walk tab removed                               |

## Component Tree

```
_app.tsx (root layout)
  └─ Stack
       ├─ (tabs) — AppTabs
       │    ├─ index (home)
       │    ├─ explore
       │    │    └─ ScreenWrapper
       │    │         └─ ScrollScreenWrapper
       │    │              └─ TripMap
       │    │                   ├─ useEffect → expo-location
       │    │                   └─ TripCard[] → Pressable → router.push
       │    └─ settings
       └─ trips/[id]
            └─ TripDetailView
                 └─ TripDetailMap
                      ├─ [native] WebView + Leaflet HTML
                      └─ [web] Direct Leaflet
```

## Component Interfaces

### TripMap (trip-map.tsx)

- **Export**: `TripMap` (default)
- **Props**: None (reads from `getAllTrips()` and `expo-location` internally)
- **States**: `permissionGranted` | `permissionDenied` | `empty`
- **Behavior**: On mount, requests foreground permission via `expo-location`. On grant, gets current position and calculates Haversine distance to each trip. Renders scrollable card list. Distance hidden if permission denied or position unavailable.

### TripDetailMap (trip-detail-map.tsx / .web.tsx)

- **Export**: `TripDetailMap` (default)
- **Props**: `trip: LocalTripMetadata`
- **Platform files**:
  - `.tsx` (native): Renders WebView with Leaflet HTML string showing the route markers
  - `.web.tsx`: Direct Leaflet import via `leaflet`/`react-leaflet`
- **Behavior**: Fits map to trip coordinates. On native, loads Leaflet in a WebView from an inline HTML string. On web, renders `<MapContainer>` directly.

## Navigation

```
Root Stack (_layout.tsx)
  ├─ (tabs) group (no header)
  │    ├─ index    → /    (home)
  │    ├─ explore  → /explore (TripMap)
  │    └─ settings → /settings
  └─ trips/[id]    → /trips/:id (TripDetailView with TripDetailMap)
```

**Changes from previous navigation:**

- `explore.tsx` moved to `(tabs)/explore.tsx`
- Root layout wraps everything in a Stack to allow `trips/[id]` to push above tabs
- Walk tab removed from tab constants and file system

## Distance Calculation

```
userLocation     trip {startCoordinates}
      │                │
      └─── Haversine ──┘
              │
         distance (meters)
              │
         formatDistance(distance)
              │
         < 1000 → "X m away"
         >= 1000 → "X.X km away"
```

- **Library**: Haversine formula in `src/data/trips.ts` as `calculateDistance`
- **Display**: `formatDistance(d)` returns a formatted string using i18n keys
- **Permission**: `expo-location` `requestForegroundPermissionsAsync` → `getCurrentPositionAsync`

## i18n Keys

```typescript
// en.ts
map: {
  distanceFromYou: '{{distance}} away',
  distanceMeters: '{{value}} m',
  distanceKilometers: '{{value}} km',
  loadingMap: 'Loading map…',
  offlineTitle: 'Map unavailable',
  offlineDescription: 'Connect to the internet to see the map',
  noTripsTitle: 'No trips available',
  viewTrip: 'View trip',
}
```

```typescript
// es.ts
map: {
  distanceFromYou: 'a {{distance}}',
  distanceMeters: '{{value}} m',
  distanceKilometers: '{{value}} km',
  loadingMap: 'Cargando mapa…',
  offlineTitle: 'Mapa no disponible',
  offlineDescription: 'Conectate a internet para ver el mapa',
  noTripsTitle: 'No hay viajes disponibles',
  viewTrip: 'Ver viaje',
}
```

## State Management

**TripMap** (local state):

```
mount → requestForegroundPermissionsAsync
  ├─ granted → getCurrentPositionAsync → distances[] → cards with distance
  └─ denied  → cards without distance
```

No global state needed — all data is synchronous and local.

## Risks and Mitigations

| Risk                                        | Likelihood | Mitigation                                                     |
| ------------------------------------------- | ---------- | -------------------------------------------------------------- |
| expo-location permission permanently denied | Low        | Graceful fallback — cards shown without distance               |
| WebView Leaflet performance on native       | Medium     | Minimal HTML (Leaflet + single marker), no complex overlays    |
| GPS accuracy (indoor use)                   | Medium     | `getCurrentPositionAsync` may be imprecise; acceptable for MVP |

## Integration Points

- **Root layout** (`_layout.tsx`): Now a Stack wrapping `(tabs)` and `trips/[id]`
- **Explore tab** (`(tabs)/explore.tsx`): New screen with `TripMap`
- **Trip detail** (`trips/[id].tsx`): Uses `TripDetailView` which includes `TripDetailMap`
- **Tab navigator**: Walk tab removed — only index, explore, settings remain

## Open Questions

None. All changes implemented and validated.
