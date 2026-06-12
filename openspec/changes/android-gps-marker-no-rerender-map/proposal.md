# Proposal: Android and Web GPS Marker Update Smoothness

## Intent

Prevent the map from fully reloading/repainting and resetting zoom when the user's GPS coordinates change on both Android and Web, while adding a loading feedback indicator when the location is not yet resolved.

## Scope

### In Scope

- Smoothly update the user location marker position on Android (`TripDetailMap` WebView) using Javascript injection.
- Smoothly update the user location marker on Web (`TripDetailMap` React component) by updating Leaflet marker reference in place.
- Implement smooth panning (`map.panTo` / `map.fitBounds` with animation) to the new location instead of reloading the map.
- Show an overlay/badge on the map saying "Obteniendo ubicación..." / "Locating..." when `userLatitude` / `userLongitude` are undefined.
- Add new translations: `map.fetchingLocation`.

### Out of Scope

- A manual reset/re-center button.

## Capabilities

### New Capabilities

None

### Modified Capabilities

- `trip-detail-map`: Prevent map re-initialization and flickering during GPS updates, and show location loading feedback.

## Approach

1. **Dynamic WebView updates (Android)**: Re-scope the initial `buildDataUri` call to exclude dynamic user location properties (only destination coordinate is hardcoded). When user location is acquired, use `injectJavaScript` to dynamically initialize `window.userMarker` or call `userMarker.setLatLng` and update boundaries smoothly.
2. **Dynamic Leaflet updates (Web)**: Maintain Map and Marker instances in React refs. Update Leaflet states imperatively inside `useEffect` when coordinates change, avoiding `map.remove()` calls.
3. **UX Location Loading**: Absolute position a small pill/badge over the map component if `userLatitude` / `userLongitude` are undefined.

## Affected Areas

| Area                                     | Impact   | Description                                                |
| ---------------------------------------- | -------- | ---------------------------------------------------------- |
| `src/components/trip-detail-map.tsx`     | Modified | Use ref injection for updates; add location loading badge. |
| `src/components/trip-detail-map.web.tsx` | Modified | Use refs for Leaflet instances; avoid map removal/re-init. |
| `src/i18n/locales/en.ts`                 | Modified | Add `map.fetchingLocation` key.                            |
| `src/i18n/locales/es.ts`                 | Modified | Add `map.fetchingLocation` key.                            |

## Risks

| Risk                                       | Likelihood | Mitigation                                      |
| ------------------------------------------ | ---------- | ----------------------------------------------- |
| JS injection fails if WebView isn't loaded | Low        | Guard with `loading` check before injecting JS. |

## Rollback Plan

`git checkout main -- src/components/trip-detail-map.tsx src/components/trip-detail-map.web.tsx src/i18n/locales/`

## Success Criteria

- [ ] Changing user position updates the blue marker smoothly without map flickering.
- [ ] Changing user position triggers smooth panning instead of zoom reset.
- [ ] If no coordinates are passed, a "Locating..." pill shows up over the map.
