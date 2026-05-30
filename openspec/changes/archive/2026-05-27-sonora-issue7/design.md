# Design: Native Icon Systems

## Technical Approach

Replace 9 PNG raster assets with two vector icon systems: `@expo/vector-icons` Ionicons via `NativeTabs.Trigger.VectorIcon` for native (iOS/Android) and `expo-symbols` SymbolView via a new `Icon` wrapper for web. Platform splitting (`app-tabs.tsx` vs `app-tabs.web.tsx`) already exists — each file adopts the idiomatic icon approach for its target.

## Architecture Decisions

| Decision           | Option                                        | Rationale                                                                                                                                                 |
| ------------------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native icons       | Ionicons via `@expo/vector-icons`             | _Only_ option — `NativeTabs.Trigger.VectorIcon` requires a family from this library. Zero config, already bundled.                                        |
| Web icons          | `expo-symbols` SymbolView                     | Maps SF Symbols (iOS Safari) ↔ Material Icons (Android/web Chrome) in one component. No extra bundler config vs SVG.                                      |
| Icon component     | Thin SymbolView wrapper                       | `app-tabs.web.tsx` would repeat `{ios, android, web}` objects in every `SymbolView` call. `Icon` encodes this once.                                       |
| Platform name keys | `ios` (required), `android`, `web` (optional) | `SymbolView.name` accepts partial platform objects. `ios` is always required (SF Symbol). `android`/`web` fall back gracefully when omitted per scenario. |
| Icon tinting       | `renderingMode: "template"`                   | Inherits color from parent tab bar — no dark/light asset variants needed.                                                                                 |
| PNG deletion       | Delete entire `assets/images/tabIcons/`       | All 9 files (3 icons × 3 resolutions) are unreferenced after migration.                                                                                   |

**Rejected — keeping PNGs**: Raster assets don't scale, don't support `tintColor`, add ~120 KB to bundle, require manual resolution selection.

**Rejected — custom SVG components**: No bundler react-native-svg config in project. `@expo/vector-icons` and `expo-symbols` are zero-config and already compatible with Expo SDK 56.

## Component Tree / Data Flow

### Native (`app-tabs.tsx`)

```
AppTabs
 └── NativeTabs
      ├── NativeTabs.Trigger[name="index"]
      │    ├── NativeTabs.Trigger.Label → "Home"
      │    └── NativeTabs.Trigger.Icon
      │         └── NativeTabs.Trigger.VectorIcon(family=Ionicons, name="home-outline")
      ├── NativeTabs.Trigger[name="explore"]
      │    └── ... VectorIcon(name="compass-outline")
      └── NativeTabs.Trigger[name="settings"]
           └── ... VectorIcon(name="settings-outline")
```

Theme color flows: `useColorScheme()` → `Colors[scheme]` → passed to `NativeTabs` as `backgroundColor`/`indicatorColor`/`labelStyle`. Vector icons use `renderingMode: "template"` — the tab bar tints them automatically.

### Web (`app-tabs.web.tsx`)

```
AppTabs
 └── Tabs
      ├── TabSlot
      └── TabList → CustomTabList
           ├── TabTrigger[name="home"] → TabButton(icon={ios:'house', android:'home', web:'home'})
           │    ├── Icon(ios, android, web, size, tintColor)
           │    │    └── SymbolView(name={ios, android, web})
           │    └── ThemedText → "Home"
           ├── TabTrigger[name="explore"] → TabButton(icon={ios:'compass.drawing', ...})
           └── TabTrigger[name="settings"] → TabButton(icon={ios:'gear', ...})
```

Web tab icons receive explicit `tintColor` per `isFocused` state. No parent-provided template tinting like native.

## File Changes

| File                              | Action     | Description                                                                                                                                                                 |
| --------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assets/images/tabIcons/`         | Delete     | Remove 9 PNG files (3 icons × 3 resolutions): `home-outline.png`, `compass-outline.png`, `settings-outline.png` at `1x/`, `2x/`, `3x/`.                                     |
| `src/components/app-tabs.tsx`     | Modify     | Replaced `require('@/assets/images/tabIcons/*.png')` with `NativeTabs.Trigger.VectorIcon` + Ionicons imports. Added `renderingMode: "template"`.                            |
| `src/components/app-tabs.web.tsx` | Modify     | Replaced placeholder `require('@/assets/images/tabIcons/*.png')` with `Icon` component. Added `TabButton` wrapper, `IconSymbols` type, platform-discriminated name objects. |
| `src/components/icon.tsx`         | **Create** | 14-line reusable `SymbolView` wrapper. Accepts `ios` (required), `android`/`web` (optional), `size`, `tintColor`.                                                           |

## Interfaces / Contracts

```ts
// src/components/icon.tsx
type IconProps = {
  ios: SFSymbol; // SF Symbol name (required)
  android?: AndroidSymbol; // Material icon name (optional)
  web?: AndroidSymbol; // Web icon name (optional)
  size?: number; // Default 24
  tintColor?: string; // Forwarded to SymbolView
};

// src/components/app-tabs.web.tsx
type IconSymbols = {
  ios: SFSymbol;
  android: AndroidSymbol;
  web: AndroidSymbol;
};
```

No new external API — `expo-symbols` types (`SFSymbol`, `AndroidSymbol`) are re-exported transparently.

## Testing Strategy

| Layer | What to Test                                | Approach                                                                                                            |
| ----- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Unit  | Native tabs render 3 triggers               | Jest + RTL: mock `expo-router/unstable-native-tabs`                                                                 |
| Unit  | Web tabs render 3 triggers with labels      | Jest + RTL: mock `expo-router/ui`                                                                                   |
| Unit  | Icon component forwards props to SymbolView | Verified via web-tab indirect test (SymbolView is mocked by the native renderer on native, or skipped via web file) |

All tests pass at time of writing. No integration or E2E layer exists in the project yet.

## Migration / Rollout

No migration required. PNG files are deleted atomically with the new icon references — the project won't build if a stale require remains. The 9 deleted PNGs have no other consumers in the codebase.

## Open Questions

None — implementation is complete, verified, and all tests pass.
