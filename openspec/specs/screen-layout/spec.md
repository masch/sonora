# Delta: Screen Layout — Fix Android Layout

Retroactive spec documenting layout fixes for Home and Settings screens on Android. No existing capability specs for screen layout; this establishes the domain.

## ADDED Requirements

### Requirement: Home Screen Platform-Aware Scrolling

The Home screen MUST use a platform-aware scroll strategy to avoid content cutoff on Android where system chrome (status bar, nav bar, tab bar) consumes more vertical space.

- On web: the screen MUST use `ScreenWrapper` (fixed, no scroll) with `pt-16 pb-6` content padding for the absolute tab bar.
- On native (Android + iOS): the screen MUST use `ScrollScreenWrapper` with `contentContainerClassName="pt-16 pb-6"` to enable scrolling when content exceeds viewport.

#### Scenario: Native scroll wrapper provides overflow on Android

- GIVEN the Home screen is displayed on Android
- WHEN the hero content + card exceeds the viewport height
- THEN the user can scroll to see the card

#### Scenario: Web uses fixed wrapper on desktop

- GIVEN the Home screen is displayed on web
- WHEN the content renders
- THEN the ScreenWrapper provides a fixed layout without scrolling
- AND the horizontal tab bar position is stable across tab navigation

### Requirement: Home Hero Deterministic Vertical Spacing

The Home hero section MUST use padding-based vertical spacing instead of `flex-1` to eliminate platform-sensitive `flex-basis: 0` behavior that causes content mispositioning on Android.

- The hero `<TwView>` MUST have `py-16` (64px vertical padding) and NO `flex-1` class.
- The inner container TwView MUST use `alignItems: 'center'` and `self-center` for centered horizontal layout.
- The hero-content gap MUST use `SECTION_GAP` (16px).
- The content block (hero + card + badges) MUST be extracted into a reusable `innerView` variable for consistent rendering across platform-specific wrappers.

#### Scenario: Hero renders at correct vertical position on Android

- GIVEN the Home screen is displayed on Android
- WHEN the hero section renders
- THEN the hero uses natural content height + `py-16` padding instead of `flex-1`
- AND the card renders below the hero with `SECTION_GAP` spacing

#### Scenario: iOS layout visually consistent

- GIVEN the Home screen is displayed on iOS
- WHEN the hero section renders
- THEN the card is not pinned to the absolute bottom
- AND vertical spacing is consistent with Android

### Requirement: Settings Screen Single View Hierarchy

The Settings screen MUST NOT nest `SafeAreaView` to prevent double top-padding on Android.

- The root wrapper MUST be `TwView(flex-1 bg-background)` — no `ScreenWrapper` or `SafeAreaView`.
- Content MUST use `TwScrollView(flex-1 bg-background)` for scrollable content.
- `bg-background` MUST be set on BOTH `TwView` and `TwScrollView` to prevent white background flash on web in dark mode.

#### Scenario: No double safe-area padding on Android

- GIVEN the Settings screen is displayed on Android
- WHEN the screen renders
- THEN there is only one safe-area contribution to top padding
- AND the first visible element appears at the correct Y position

#### Scenario: Dark mode background renders correctly on web

- GIVEN the Settings screen is displayed on web
- WHEN dark mode is active
- THEN the background color is `bg-background` (CSS variable) with no white flash areas

### Requirement: ThemedText Small Type Compact Line Height

The `type="small"` variant of `ThemedText` MUST NOT specify `leading-5` (line-height) to allow Android to use its natural text line height, preventing oversized vertical gaps.

- `typeClassMap.small` MUST be `'text-sm font-medium'` (no leading utility).
- `typeClassMap.smallBold` MAY keep `leading-5` since bold text requires explicit height for cross-platform consistency.

#### Scenario: Small text has natural height on Android

- GIVEN a `<ThemedText type="small">` component renders on Android
- WHEN the text is displayed
- THEN the line height matches Android's native text rendering, not an explicit `leading-5`

#### Scenario: Small text renders without regression on iOS

- GIVEN a `<ThemedText type="small">` component renders on iOS
- WHEN the text is displayed
- THEN the visual appearance is not negatively affected by the removal of `leading-5`

### Requirement: HintRow Badge Compact Typography

The HintRow hint badge MUST use `type="small"` for compact height consistent with the title, preventing oversized badge text on Android.

#### Scenario: Hint badge height matches title

- GIVEN a HintRow component with a title and hint
- WHEN both render
- THEN the hint badge text uses `type="small"` typography
- AND the hint badge height matches the title text height

## Coverage

- Happy paths: ✅ All core flows covered
- Edge cases: ✅ Platform awareness (web vs native), dark mode, scroll overflow
- Error states: N/A — layout-only; no error states apply
