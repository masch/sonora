# Tasks: Android and Web GPS Marker Update Smoothness

## Review Workload Forecast

| Field                   | Value          |
| ----------------------- | -------------- |
| Estimated changed lines | 100-150        |
| 400-line budget risk    | Low            |
| Chained PRs recommended | No             |
| Suggested split         | Single PR      |
| Delivery strategy       | ask-on-risk    |
| Chain strategy          | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Foundation (Translations)

- [ ] 1.1 Add `map.fetchingLocation: 'Locating…'` to `src/i18n/locales/en.ts`.
- [ ] 1.2 Add `map.fetchingLocation: 'Obteniendo ubicación…'` to `src/i18n/locales/es.ts`.

## Phase 2: Core Implementation (Android Map Update)

- [ ] 2.1 Refactor `src/components/trip-detail-map.tsx`'s `buildDataUri` and remove `userLatitude`/`userLongitude` from parameters to keep `uri` static.
- [ ] 2.2 Add an absolute-positioned "Locating..." badge overlay in `TripDetailMap` component shown when `userLatitude`/`userLongitude` are undefined.
- [ ] 2.3 Implement `useEffect` with `webviewRef.current.injectJavaScript` that updates `window.userMarker` and pans/fits bounds smoothly when user coordinates update.

## Phase 3: Web Parity Implementation (Web Map Update)

- [ ] 3.1 Refactor `src/components/trip-detail-map.web.tsx` to remove `userLatitude`/`userLongitude` from the main Map initialization `useEffect` to prevent full map recreation.
- [ ] 3.2 Add a new `useLayoutEffect` to dynamically initialize/update `userMarkerRef` and animate map fit bounds in-place when coordinates change.

## Phase 4: Verification

- [ ] 4.1 Run unit tests and typechecking via `make format-check test lint typecheck`.
- [ ] 4.2 Verify dynamic coordinates changes manually in emulator/browser without full map reload.
