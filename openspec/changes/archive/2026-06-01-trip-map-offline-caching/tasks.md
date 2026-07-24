# Tasks: Unified Trip Map with Location Distances

**Change key**: `trip-map-offline-caching`
**Delivery**: single PR (~1391 lines — exceeds 400, ask-on-risk)
**Strict TDD**: ALL tasks require test file BEFORE implementation file
**Validate**: `make validate` (format → test → lint → typecheck → gga)

## Review Workload Forecast

| Slice     | Tasks | Files    | Est. Lines | Risk     |
| --------- | ----- | -------- | ---------- | -------- |
| Single PR | 1–9   | 33 files | ~1391      | **High** |

**Decision**: Reviewed with user — proceed as single PR with `size:exception` (user-approved). All changes are validated and tested.

---

## Task 1: Add i18n keys for map and distance labels

- **Depends on**: none
- **Files modified**: `src/i18n/locales/en.ts`, `src/i18n/locales/es.ts`
- **Test files**: none (existing `i18n.test.ts` auto-verifies non-empty translation values)
- **Description**:
  - Add `map.*` keys to `en.ts`:
    ```typescript
    map: {
      distanceFromYou: '{{distance}} away',
      distanceMeters: '{{value}} m',
      distanceKilometers: '{{value}} km',
      loadingMap: 'Loading map…',
      offlineTitle: 'Map unavailable',
      offlineDescription: 'Connect to the internet to see the map',
      noTripsTitle: 'No trips available',
      viewTrip: 'View deriva',
    },
    ```
  - Add same keys to `es.ts` with Spanish translations:
    ```typescript
    map: {
      distanceFromYou: 'a {{distance}}',
      distanceMeters: '{{value}} m',
      distanceKilometers: '{{value}} km',
      loadingMap: 'Cargando mapa…',
      offlineTitle: 'Mapa no disponible',
      offlineDescription: 'Conectate a internet para ver el mapa',
      noTripsTitle: 'No hay viajes disponibles',
      viewTrip: 'Ver deriva',
    },
    ```
  - Add `trips.coordinates: '{{lat}}, {{lng}}'` to both locales
- **Acceptance**:
  - `make validate` passes
  - TypeScript compilation: new keys are auto-derived into `TranslationKeys` union type
  - `trips.duration` still returns `'{{minutes}} min {{type}}'`

---

## Task 2: Navigation restructure — root Stack + (tabs) layout

- **Depends on**: none
- **Files created**: `src/app/(tabs)/_layout.tsx`, `src/app/(tabs)/explore.tsx`
- **Files modified**: `src/app/_layout.tsx`
- **Files moved**: `src/app/index.tsx` → `src/app/(tabs)/index.tsx`, `src/app/settings.tsx` → `src/app/(tabs)/settings.tsx`
- **Files deleted**: `src/app/explore.tsx` (boilerplate replaced by `(tabs)/explore.tsx`)
- **Test files**: `src/__tests__/explore.test.tsx` (rewrite), `src/__tests__/index.test.tsx`, `src/__tests__/settings.test.tsx`, `src/__tests__/tabs.test.ts`
- **Description**:
  - Root `_layout.tsx`: Stack navigator wrapping `(tabs)` group + `trips/[id]` screen
  - New `(tabs)/_layout.tsx`: renders `<AppTabs />` from `@/components/app-tabs`
  - Move `index.tsx` and `settings.tsx` into `(tabs)/` group
  - Delete old `explore.tsx` boilerplate (Collapsible, ExternalLink, WebBadge, etc.)
  - Update test paths for moved files
- **Acceptance**:
  - `make validate` passes
  - Tabs render correctly (home, explore, settings)
  - Deep link from explore to trip detail works

---

## Task 3: TripMap unified component with location distances

- **Depends on**: Task 1 (i18n keys)
- **Files created**: `src/components/trip-map.tsx`, `src/__tests__/trip-map.test.tsx`
- **TDD guard**: `TripMap` component (default export)

### Step 1 — Write test first

Create `src/__tests__/trip-map.test.tsx`:

- Mock dependencies:

  ```typescript
  jest.mock('@/data/trips', () => ({
    getAllTrips: jest.fn(),
    calculateDistance: jest.fn(),
    formatDistance: jest.fn(),
  }));

  jest.mock('expo-router', () => ({
    useRouter: () => ({ push: jest.fn() }),
  }));

  jest.mock('@/hooks/use-translation', () => ({
    useAppTranslation: () => ({ t: (k: string) => k }),
  }));

  jest.mock('expo-location', () => ({
    requestForegroundPermissionsAsync: jest.fn(),
    getCurrentPositionAsync: jest.fn(),
  }));
  ```

- **Test 1**: renders trip cards for each trip
- **Test 2**: shows distance when location permission granted
- **Test 3**: hides distance when permission denied
- **Test 4**: renders empty state when no trips
- **Test 5**: press navigates to trip detail

### Step 2 — Write implementation

Create `src/components/trip-map.tsx`:

- Default export: `export default function TripMap()`
- On mount: request `expo-location` foreground permission → `getCurrentPositionAsync`
- Calculate Haversine distance to each trip via `calculateDistance` in `src/data/trips.ts`
- Render scrollable card list inside `ScrollScreenWrapper`
- Each card: `Pressable` with `testID="view-trip-{id}"` and `accessibilityLabel`
  - Shows trip `title`, formatted `durationMinutes`, and distance (when available)
- Distance formatting: `< 1000m → "X m"`, `>= 1000m → "X.X km"` via `formatDistance`
- Empty state when `getAllTrips()` returns empty array
- No platform split — unified component works on both native and web

### Step 3 — Validate

```bash
make validate
```

- **Acceptance**: All tests pass; format/lint/typecheck clean

---

## Task 4: TripDetailMap — Leaflet map for trip detail

- **Depends on**: none
- **Files created**: `src/components/trip-detail-map.tsx`, `src/components/trip-detail-map.web.tsx`
- **TDD guard**: none (Leaflet-in-WebView is hard to unit test; smoke test via existing trip-detail tests)

### Description

- **Native** (`trip-detail-map.tsx`): Renders a `WebView` with an inline HTML string containing Leaflet, a tile layer (OpenStreetMap), and markers for trip start/end coordinates
- **Web** (`trip-detail-map.web.tsx`): Direct Leaflet via `react-leaflet` — `<MapContainer>`, `<TileLayer>`, `<Marker>` with popup
- **Both**: Fit map bounds to trip coordinates, fallback if no startCoordinates

### Acceptance

- `make validate` passes
- `trip-detail-view.tsx` imports and renders `TripDetailMap` with trip data

---

## Task 5: Explore screen — new (tabs)/explore.tsx

- **Depends on**: Task 3 (TripMap component)
- **Files created**: `src/app/(tabs)/explore.tsx` (already created in Task 2)
- **Files modified**: `src/__tests__/explore.test.tsx` (already rewritten in Task 2)
- **Description**:
  - Simple screen wrapping `TripMap` in `ScreenWrapper`
  - Uses `useAppTranslation` for tab title (from `tabs.explore`)
- **Acceptance**:
  - `make validate` passes
  - Explore tab shows trip cards with distances

---

## Task 6: LoadingView shared component

- **Depends on**: none
- **Files created**: `src/components/loading-view.tsx`
- **TDD guard**: none (trivial presentational component)
- **Description**:
  - `LoadingView` component: centered spinner (`ActivityIndicator`) + optional descriptive text via `message` prop
  - Used by `trip-detail-map.tsx` (native) while WebView loads
- **Acceptance**:
  - `make validate` passes

---

## Task 7: Remove Walk tab

- **Depends on**: Task 2 (tabs restructure)
- **Files deleted**: `src/app/walk.tsx`
- **Files modified**: `src/constants/tabs.ts` (remove walk entry)
- **Test files**: `src/__tests__/tabs.test.ts` (update tab count assertion)
- **Description**:
  - Delete `walk.tsx`
  - Remove walk from `tabs.ts` constants
  - Update tabs test to expect 3 tabs instead of 4
- **Acceptance**:
  - `make validate` passes
  - Only 3 tabs render (home, explore, settings)

---

## Task 8: Fix GGA violations in existing components

- **Depends on**: Task 1 (i18n keys)
- **Files modified**:
  - `src/components/gps-precision-badge.tsx` — replace hardcoded `'N/A'`, `'m'`, `'km'` with i18n keys
  - `src/components/themed-text.tsx` — add `Gps` variant
  - `src/components/trip-map.tsx` — add `accessibilityLabel` on Pressable, use i18n keys in `formatDistance`
  - `src/components/trip-detail-map.tsx` — replace raw `ActivityIndicator` with `LoadingView`, inline `style` → `className`, add `testID` + `accessibilityLabel`
  - `src/components/trip-detail-map.web.tsx` — inline `style={{ zIndex: 0 }}` → `className="z-0"`, add i18n messages for empty/error state
  - `src/app/trips/[id].tsx` — convert to use `TripDetailView` with `TripDetailMap`
  - `src/components/trip-detail-view.tsx` — integrate `TripDetailMap`
  - `src/data/trips.ts` — add `calculateDistance` and `formatDistance` utilities
  - `src/__tests__/gps-precision-badge.test.tsx` — update for i18n keys
  - `src/__tests__/trips.test.tsx` — add distance utility tests
- **Description**:
  - Fix all GGA (Gentle AI Governance Audit) violations across components
  - Ensure hardcoded strings use i18n keys
  - Ensure accessibility labels and testIDs on all interactive elements
  - Use `Tw*` components instead of raw RN views where possible
  - Remove inline styles that can be expressed as className
- **Acceptance**:
  - `make validate` passes
  - `make gga` (or equivalent GGA check) passes with 0 violations

---

## Task 9: Cleanup — remove dead dependencies and files

- **Depends on**: none (independent)
- **Files deleted**: `src/hooks/use-online-status.ts`, `src/hooks/__tests__/use-online-status.test.ts` (if exists)
- **Files modified**: `package.json` (remove `@react-native-community/netinfo`), `src/__tests__/trips.test.tsx` (remove NetInfo mock)
- **Test files**: none (tests were for deleted hook)
- **Description**:
  - Remove `@react-native-community/netinfo` from dependencies (offline caching deferred to issue #51)
  - Run `bun install` to update `bun.lock`
  - Remove unused `use-online-status.ts` hook (no callers exist)
  - Remove NetInfo mock from `trips.test.tsx`
  - Remove `expo-env.d.ts` from tracking and add to `.gitignore`
- **Acceptance**:
  - `bun install` succeeds
  - `make validate` passes
  - `grep -r "netinfo\|useOnlineStatus" src/` returns no results

---

## Task Dependency Graph

```
Task 1 (i18n)
  ├── Task 3 (TripMap)
  │     └── Task 5 (explore screen)
  ├── Task 8 (GGA fixes)
  │     └── (depends on i18n for hardcoded strings)
  └── Task 9 (cleanup — independent)
Task 2 (navigation) ──┐
  ├── Task 7 (walk tab)┘
Task 4 (trip-detail-map) ── (independent)
Task 6 (LoadingView) ── (independent, used by Task 4)
```

Tasks 2, 3, 4, 6, 9 can be parallelized after Task 1.

## File Manifest

| #   | File                                         | Action         | Task |
| --- | -------------------------------------------- | -------------- | ---- |
| 1   | `src/i18n/locales/en.ts`                     | Modify         | 1    |
| 2   | `src/i18n/locales/es.ts`                     | Modify         | 1    |
| 3   | `src/app/_layout.tsx`                        | Modify         | 2    |
| 4   | `src/app/(tabs)/_layout.tsx`                 | Create         | 2    |
| 5   | `src/app/(tabs)/explore.tsx`                 | Create         | 2/5  |
| 6   | `src/app/(tabs)/index.tsx`                   | Move           | 2    |
| 7   | `src/app/(tabs)/settings.tsx`                | Move           | 2    |
| 8   | `src/app/explore.tsx`                        | Delete         | 2    |
| 9   | `src/__tests__/explore.test.tsx`             | Rewrite        | 2    |
| 10  | `src/__tests__/index.test.tsx`               | Modify         | 2    |
| 11  | `src/__tests__/settings.test.tsx`            | Modify         | 2    |
| 12  | `src/__tests__/tabs.test.ts`                 | Modify         | 2/7  |
| 13  | `src/components/trip-map.tsx`                | Create         | 3    |
| 14  | `src/__tests__/trip-map.test.tsx`            | Create         | 3    |
| 15  | `src/components/trip-detail-map.tsx`         | Create         | 4    |
| 16  | `src/components/trip-detail-map.web.tsx`     | Create         | 4    |
| 17  | `src/components/loading-view.tsx`            | Create         | 6    |
| 18  | `src/app/walk.tsx`                           | Delete         | 7    |
| 19  | `src/constants/tabs.ts`                      | Modify         | 7    |
| 20  | `src/components/gps-precision-badge.tsx`     | Modify         | 8    |
| 21  | `src/components/themed-text.tsx`             | Modify         | 8    |
| 22  | `src/components/trip-detail-view.tsx`        | Modify         | 8    |
| 23  | `src/app/trips/[id].tsx`                     | Modify         | 8    |
| 24  | `src/data/trips.ts`                          | Modify         | 8    |
| 25  | `src/__tests__/gps-precision-badge.test.tsx` | Modify         | 8    |
| 26  | `src/__tests__/trips.test.tsx`               | Modify         | 8/9  |
| 27  | `package.json`                               | Modify         | 9    |
| 28  | `bun.lock`                                   | Modify         | 9    |
| 29  | `.gitignore`                                 | Modify         | 9    |
| 30  | `expo-env.d.ts`                              | Remove tracked | 9    |

## Key Testing Patterns (per existing codebase)

1. **Hook tests**: `renderHook` from `@testing-library/react-hooks`, `act` for state flushes
2. **Component tests**: `render` from `@testing-library/react-native`, `fireEvent` for interactions
3. **Translation mocking**: `jest.mock('@/hooks/use-translation')` returning `{ t: (k: string) => k }`
4. **Expo Router mocking**: `jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))`
5. **Expo Location mocking**: `jest.mock('expo-location', () => ({ requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }))`
