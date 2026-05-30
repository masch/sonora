# Delta for sonora-issue7: Native Icon Systems

Context: Replace PNG tab icons with Ionicons (native) and `expo-symbols` SymbolView (web). Add reusable `Icon` component. Delete 9 PNG assets from `assets/images/tabIcons/`.

## ADDED Requirements

### Requirement: Reusable Icon Component

The system MUST provide a reusable `Icon` component that wraps `expo-symbols` `SymbolView` and accepts platform-discriminated names via `{ios, android?, web?}` props.

#### Scenario: Renders SF Symbol on iOS

- GIVEN an `Icon` with `ios="house"` and no `android` / `web` keys
- WHEN it renders on iOS
- THEN the `SymbolView` MUST receive `name={{ ios: 'house' }}` and render the SF Symbol "house"

#### Scenario: Renders Material icon on Android

- GIVEN an `Icon` with `ios="house"` and `android="home"`
- WHEN it renders on Android
- THEN the `SymbolView` MUST receive `name={{ ios: 'house', android: 'home' }}` and render the Material icon "home"

#### Scenario: Renders web icon

- GIVEN an `Icon` with `ios="house"`, `android="home"`, and `web="home"`
- WHEN it renders on web
- THEN the `SymbolView` MUST receive all three name keys

#### Scenario: Forwards size and tintColor

- GIVEN an `Icon` with `size={14}` and `tintColor="rgb(107 114 128)"`
- WHEN it renders
- THEN the props MUST be forwarded to `SymbolView`

### Requirement: Web tab icon diversity

Web tab icons MUST use distinct SF Symbol / Material icon names per platform key to ensure correct rendering on iOS Safari, Android Chrome, and desktop browsers.

#### Scenario: Web tab icon names differ by platform

- GIVEN the `Icon` component receives `{ios: 'gear', android: 'settings', web: 'settings'}`
- WHEN rendering on web
- THEN `SymbolView` MUST receive all three keys in its `name` prop
- AND each platform MUST resolve to its platform-native icon set

## MODIFIED Requirements

### Requirement: Tab Navigation

Tabs MUST render with platform-native vector icons. Three tabs (Home, Explore, Settings) MUST display on native and web with vector icon systems replacing the removed PNG assets. Icon rendering MUST respect dark/light mode via template tinting.

(Previously: Tab icons loaded via `require('@/assets/images/tabIcons/*.png')`; no icon system specification.)

#### Scenario: Native tab icons use Ionicons

- GIVEN the app runs on iOS or Android
- WHEN the tab bar renders via `NativeTabs`
- THEN each `NativeTabs.Trigger` MUST render an Ionicons icon via `NativeTabs.Trigger.VectorIcon`
- AND the icons MUST be "home-outline", "compass-outline", and "settings-outline"
- AND `renderingMode` MUST be `"template"`

#### Scenario: Web tab icons use SymbolView

- GIVEN the app runs on web
- WHEN the tab bar renders via `Tabs` from `expo-router/ui`
- THEN each `TabButton` MUST render an `Icon` component
- AND Home MUST use `{ios:'house', android:'home', web:'home'}`
- AND Explore MUST use `{ios:'compass.drawing', android:'explore', web:'explore'}`
- AND Settings MUST use `{ios:'gear', android:'settings', web:'settings'}`

#### Scenario: Icons adapt to color scheme

- GIVEN the device is in dark or light mode
- WHEN a tab icon renders
- THEN the icon `tintColor` MUST respect the current color scheme via `Colors` theme tokens
- AND no separate dark-mode icon assets SHALL exist

## REMOVED Requirements

### Requirement: PNG Tab Icon Assets

The `assets/images/tabIcons/` directory (9 PNG files: 3 icons × 3 resolutions) MUST be removed from the project.

(Reason: all PNG tab icons replaced by Ionicons `@expo/vector-icons` on native and `expo-symbols` SymbolView on web. No raster tab icon assets remain.)
