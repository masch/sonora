# Spec: UI Maintainability & Cyclomatic Complexity

## Requirements

### REQ-1: Zero Duplicate JSX Subtrees (`react-doctor/duplicate-jsx-subtree`)

- **Files**: `src/app/(tabs)/explore.tsx`, `src/components/track-detail-view.tsx`
- **Behavior**:
  - `explore.tsx`: Extract banner JSX into a dedicated subcomponent `ExploreBanner`.
  - `track-detail-view.tsx`: Simplify outer container rendering so no identical JSX tree is duplicated across platform branches.
- **Verification**: `react-doctor` reports 0 findings for `duplicate-jsx-subtree`.

### REQ-2: Low Control-Flow Complexity in React Functions (`react-doctor/no-high-complexity-react-function`)

- **Files**:
  - `src/components/audio-media-controls.tsx`
  - `src/components/feedback-form.tsx`
  - `src/components/global-audio-player.tsx`
  - `src/components/screen-wrapper.tsx`
  - `src/components/track-detail-view.tsx`
  - `src/components/trip-detail-view.tsx`
- **Behavior**:
  - Component cyclomatic complexity must remain below the `react-doctor` warning threshold.
  - State, side-effects, and branching decisions must be encapsulated in dedicated custom hooks or smaller presentational subcomponents.
  - Public component interfaces, props, behavior, and accessibility labels must remain 100% backward compatible.
- **Verification**: `react-doctor` reports 0 findings for `no-high-complexity-react-function`.

### REQ-3: Test Preservation & Regression Immunity

- All existing test suites covering the refactored components must pass without modifications to test expectations or assertions.
- `make test-front` passes with 0 failures.
- `make lint` and `make typecheck` pass with 0 errors.
