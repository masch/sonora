# Specification: Mobile Web Bottom Navigation Tabs

## Requirements

### Requirement 1: Web Navigation Bar Positioning

The web navigation tab list MUST be anchored at the bottom of the viewport container with `bottom-0` positioning and `z-50` stacking order.

#### Acceptance Criteria

- `CustomTabList` renders a `TwView` container with `absolute bottom-0 w-full p-4 justify-center items-center flex-row z-50`.
- The container includes `testID="custom-tab-list"` with default parameter fallback `testID = 'custom-tab-list'`.

### Requirement 2: Dead Code Elimination

The `AppVersionText` component and related test files MUST be removed completely from the repository to prevent UI overlap with bottom navigation tabs.

#### Acceptance Criteria

- `apps/mobile/src/components/app-version-text.tsx` and `apps/mobile/src/__tests__/app-version-text.test.tsx` are deleted.
- `<AppVersionText />` and its import are removed from `apps/mobile/src/app/(tabs)/index.tsx`.
- TypeScript typechecks pass with zero errors across all workspaces.

### Requirement 3: Platform Scope & Parity

All web tab changes MUST be isolated to web builds (`.web.tsx`) without altering native navigation behaviors on iOS or Android.

#### Acceptance Criteria

- `app-tabs.tsx` remains untouched.
- Unit tests in `app-tabs.web.test.tsx` pass cleanly.
