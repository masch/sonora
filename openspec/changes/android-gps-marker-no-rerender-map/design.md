# Design: Android and Web GPS Marker Update Smoothness

## Technical Approach

Implement dynamic map updates using direct references and Leaflet APIs, avoiding React re-renders or WebView reloads when user coordinates change.

## Architecture Decisions

### Decision: Direct JS Injection for WebView (Android)

- **Choice**: Separate the WebView HTML generation (which uses a static destination coordinates URI) from user position updates (which are dynamically injected via `webviewRef.current.injectJavaScript`).
- **Rationale**: If we rebuild the data URI on coordinate updates, the WebView fully reloads, causing a white flash, tile repainting, and resetting the map camera. Dynamic JS injection performs in-memory leaflet updates instantly without state loss.

### Decision: Separate useEffects for Leaflet Map Initialization and Coordinates Sync (Web)

- **Choice**: Remove `userLatitude` and `userLongitude` from the main Leaflet initialization `useEffect` and handle coordinates updates in a dedicated `useLayoutEffect` targeting marker refs.
- **Rationale**: Standardizing dynamic updates on Web prevents calling `map.remove()` and fully recreating the map container, bringing parity to the Android and Web UX.

## Data Flow

```
[User Coordinates Hook]
          │
          ▼ (Coordinates Update)
[TripDetailMap Component] ──(props changed)──→ [Sync Effect / injectJavaScript]
                                                           │
                                                           ▼ (imperative call)
                                                 [Leaflet Marker & Map instances]
```

## File Changes

| File                                     | Action | Description                                                                                               |
| ---------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| `src/components/trip-detail-map.tsx`     | Modify | Isolate WebView HTML generation; add `useEffect` to inject marker updates; add fetching location overlay. |
| `src/components/trip-detail-map.web.tsx` | Modify | Extract user coordinates from main map init effect; add layout effect for marker/bounds sync.             |
| `src/i18n/locales/en.ts`                 | Modify | Add `map.fetchingLocation` key.                                                                           |
| `src/i18n/locales/es.ts`                 | Modify | Add `map.fetchingLocation` key.                                                                           |

## Interfaces / Contracts

Props interface for `TripDetailMapProps` remains unchanged:

```typescript
interface TripDetailMapProps {
  latitude: number;
  longitude: number;
  userLatitude?: number;
  userLongitude?: number;
  showLabels?: boolean;
}
```

## Testing Strategy

| Layer      | What to Test                                                     | Approach                                                                                            |
| ---------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Unit (Web) | Render behavior with and without user location; position updates | Assert `L.circleMarker` updates coordinates in place; verify overlay visibility depending on props. |
| Manual     | Physical coordinate transition on Android & Web emulator         | Check that moving the user position updates the dot, pans smoothly, and does not cause map flashes. |

## Migration / Rollout

No migration required.
