## Exploration: Android and Web GPS Marker Update Smoothness

### Current State

In both `TripDetailMap` (Android, using Leaflet inside `WebView`) and `TripDetailMap` (Web, using Leaflet dynamically in a `div`), when `userLatitude` or `userLongitude` changes, the map components reconstruct the entire map instance. In Android, the WebView reload is triggered because the `uri` prop changes. On Web, the React `useEffect` re-runs entirely because `userLatitude` and `userLongitude` are in the dependency array, calling `map.remove()` and fully re-initializing Leaflet. This causes map re-paints, flashing tiles, and resets any manual/automatic zoom.

### Affected Areas

- [trip-detail-map.tsx](file:///home/masch/dev/js/sonora/src/components/trip-detail-map.tsx) — Handles rendering of the Map on Android inside a WebView.
- [trip-detail-map.web.tsx](file:///home/masch/dev/js/sonora/src/components/trip-detail-map.web.tsx) — Handles rendering of the Map on Web.

### Approaches

1. **Dynamic Update via Ref Injection (Recommended)**
   - **Android**: Keep the initial WebView `uri` static (exclude `userLatitude` and `userLongitude` from the initial HTML generation if they are not yet available). Use `webviewRef.current.injectJavaScript` inside a `useEffect` watching `[userLatitude, userLongitude]` to:
     - Update the coordinates of the existing `window.userMarker` using `userMarker.setLatLng([newLat, newLng])`.
     - If `window.userMarker` does not exist yet (i.e. first location acquired), create it on the fly.
     - Move the map view smoothly using `map.panTo([newLat, newLng])` or `map.fitBounds(bounds.pad(0.2))` to ensure both destination and user marker fit, but with smooth animated panning instead of recreation.
   - **Web**: Store the Leaflet marker and map instances in refs. Inside `useEffect`, instead of recreating the map, check if the map is initialized. If so, simply set the new lat/lng on the marker ref, and pan smoothly.
   - **Pros**: Zero flickering, preserves zoom level (unless fitting bounds), very high UX quality.
   - **Cons**: Requires managing Leaflet instances outside of React lifecycle.
   - **Effort**: Low/Medium.

2. **State-Driven React Wrapper Component**
   - Attempt to wrap map components using React-specific wrappers.
   - **Pros**: Closer to React patterns.
   - **Cons**: Leaflet doesn't play nicely with React renders without full reconstruction unless a library like `react-leaflet` is used (which we don't have and shouldn't add to avoid unnecessary dependencies).
   - **Effort**: High.

### Recommendation

Use Approach 1 (Dynamic Update via Ref Injection) for both Android and Web. It is lightweight, does not require new packages, and directly solves the visual reload/repaint issues.

### Risks

- If the WebView is not yet fully loaded when coordinates arrive, `injectJavaScript` might fail. This can be mitigated by guarding execution with a `loading` state check (which we already do for labels).
- Initial map boundary calculations might zoom too far out if the user is very far from the destination. We can configure `maxZoom` on the bounds fit.

### Ready for Proposal

Yes.
