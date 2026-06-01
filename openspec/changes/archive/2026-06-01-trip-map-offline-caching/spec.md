# Spec: Unified Trip Map with Location Distances

## Change Overview

Replace the boilerplate Explore tab with a unified trip card list showing all available trips with distance from the user's current location. A single `TripMap` component works on both native and web, using `expo-location` to request GPS permissions and calculate Haversine distances to each trip's start coordinates.

Additionally, restructure navigation to support deep-linking from explore to trip detail by wrapping the tab navigator in a root Stack layout.

On web, `expo-location` gracefully degrades — distances simply aren't shown if location permission is denied or unavailable.

## Requirements

### Functional Requirements

#### FR1: Trip List Display

- **Priority**: P0
- **Description**: The Explore tab MUST display all trips from `getAllTrips()` as a scrollable list of cards.
- **Acceptance Criteria**:
  - One card per trip, showing `title` and formatted `durationMinutes`
  - Cards rendered inside `ScrollScreenWrapper`
  - Works identically on native and web

#### FR2: Location-Based Distance

- **Priority**: P1
- **Description**: Each trip card SHOULD show the Haversine distance from the user's current location to the trip's `startCoordinates` when GPS permission is granted.
- **Acceptance Criteria**:
  - Requests `expo-location` foreground permission on mount
  - Distance displayed as meters (`< 1 km`) or kilometers (`>= 1 km`) with one decimal
  - No distance shown if permission denied or location unavailable
  - Uses i18n key `map.distanceFromYou` with formatted distance value

#### FR3: Trip Detail Navigation

- **Priority**: P0
- **Description**: Tapping a trip card SHALL navigate to `/trips/[id]`.
- **Acceptance Criteria**:
  - `<Pressable>` with `testID="view-trip-{id}"` per card
  - Calls `router.push(`/trips/${id}`)` on press
  - Works on both native and web

#### FR4: Navigation Restructuring

- **Priority**: P0
- **Description**: The root layout MUST use a Stack navigator wrapping the `(tabs)` group so that non-tab routes (e.g., `trips/[id]`) can be navigated to from the Explore tab.
- **Acceptance Criteria**:
  - Root `_layout.tsx` renders Stack with `(tabs)` and `trips/[id]` screens
  - Tab layout `(tabs)/_layout.tsx` uses `<AppTabs />`
  - Deep links from Explore to trip detail work on all platforms

#### FR5: Remove Walk Tab

- **Priority**: P1
- **Description**: The "Walk" tab MUST be removed from the tab navigator.
- **Acceptance Criteria**:
  - `src/app/walk.tsx` deleted
  - Tab constants no longer include a walk entry
  - i18n keys for walk removed if present

#### FR6: i18n Labels

- **Priority**: P1
- **Description**: Trip map and distance labels MUST be defined in both `en.ts` and `es.ts`.
- **Acceptance Criteria**:
  - `map.distanceFromYou`: "{{distance}} away" (en) / "a {{distance}}" (es)
  - `map.distanceMeters`: "{{value}} m" (both)
  - `map.distanceKilometers`: "{{value}} km" (both)
  - `map.loadingMap`: "Loading map…" (en) / "Cargando mapa…" (es)
  - `trips.coordinates`: "{{lat}}, {{lng}}" (both) — for web trip-detail-map

### Non-Functional Requirements

#### NFR1: Platform Consistency

- **Priority**: P1
- **Description**: Trip card list MUST render identically on native and web. No platform-specific files needed for the Explore tab content.

#### NFR2: Accessibility

- **Priority**: P1
- **Description**: Each trip card `<Pressable>` MUST have an `accessibilityLabel` and `testID`.

### Technical Constraints

- No `react-native-maps` — map functionality is deferred
- No `@react-native-community/netinfo` — offline detection deferred to issue #51
- `expo-location` for GPS permission and position (already in dependencies)
- Trip data is synchronous (`getAllTrips()`) — no loading state needed
- `FormatterDistance` uses i18n keys for unit formatting

## Scenarios

### Happy Path (Native)

1. User opens Explore tab
2. `expo-location` requests foreground permission
3. Permission granted → current location obtained
4. Trip cards render with title, duration, and distance from user
5. User taps a card → navigates to `/trips/[id]`

### No Location Permission

1. User opens Explore tab
2. `expo-location` permission denied
3. Trip cards render with title and duration — no distance shown
4. No error state, no blocking UI — distances simply omitted

### Web

1. User opens Explore tab on web browser
2. Trip cards render with title and duration
3. If browser geolocation available, distances shown; otherwise omitted
4. Same behavior as native

### Empty State

1. `getAllTrips()` returns empty array
2. Centered "No trips available" message shown

## Data Flow

```
getAllTrips()
  │
  ▼
LocalTripMetadata[]
  │
  ▼
TripMap (unified — works on all platforms)
  ├─ useEffect → expo-location.getCurrentPositionAsync()
  │    └─ currentLocation → cardDistance(trip) → Haversine calc
  ├─ FlatList / scrollable card list
  │    └─ Pressable → router.push(`/trips/${id}`)
  └─ Empty state if no trips
```
