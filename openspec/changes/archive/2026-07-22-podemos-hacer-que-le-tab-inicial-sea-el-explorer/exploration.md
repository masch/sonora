## Exploration: Make Explorer the initial tab and hide Home & Settings from tab bar

### Current State

The app has **three tab routes** inside `src/app/(tabs)/`:

| Route          | Screen   | Role                                                                |
| -------------- | -------- | ------------------------------------------------------------------- |
| `index.tsx`    | Home     | **Current initial/default tab** (the `index` route is always first) |
| `explore.tsx`  | Explore  | Contains `TripMap` — the main map view                              |
| `settings.tsx` | Settings | User preferences and app info                                       |

All three are rendered in the tab bar via two platform-specific implementations that both iterate a shared `TABS` array:

- **Native** (`src/components/app-tabs.tsx`): Uses `NativeTabs` from `expo-router/unstable-native-tabs`. Iterates `TABS.map()` rendering `<NativeTabs.Trigger>` for each tab.
- **Web** (`src/components/app-tabs.web.tsx`): Uses `Tabs`/`TabList`/`TabTrigger` from `expo-router/ui`. Iterates `TABS.map()` rendering `<TabTrigger asChild>` with `<TabButton>` for each tab.
- **Shared config** (`src/constants/tabs.ts`): Defines the `TABS` array with `TabDefinition` interface (name, label, ioniconsName, symbolViewName). No `hidden` or visibility field exists.

The root layout (`src/app/_layout.tsx`) uses a `<Stack>` with two screens: `(tabs)` (no header) and `trips/[id]` (with header). No `unstable_settings` or `initialRouteName` is configured anywhere.

**Key findings:**

1. **No conditional tab visibility exists** — no `hidden` prop, no filtering, no `href: null` usage.
2. **No `initialRouteName` is set** — the `index` route is the default simply because that's Expo Router's default behavior.
3. **The `NativeTabs.Trigger` supports a `hidden` prop natively** (per Expo SDK 56 docs).
4. **The web `TabTrigger` does not have a `hidden` prop** — hiding on web means conditionally not rendering the `<TabTrigger>`.
5. **All three routes are in the same `(tabs)` group** — they share state and navigation history.

### Affected Areas

- `src/constants/tabs.ts` — Add `hidden` field to `TabDefinition` interface and mark `index` and `settings` as hidden by default
- `src/components/app-tabs.tsx` — Native: pass `hidden` prop to `NativeTabs.Trigger` for hidden tabs, or filter them out
- `src/components/app-tabs.web.tsx` — Web: conditionally skip rendering `TabTrigger` for hidden tabs
- `src/app/(tabs)/_layout.tsx` — May need `unstable_settings` with `initialRouteName: 'explore'` to make Explore the initial tab
- `src/app/(tabs)/explore.tsx` — No changes needed (screen stays accessible via URL)
- `src/app/(tabs)/index.tsx` — No changes needed (screen stays, just hidden from tab bar)
- `src/app/(tabs)/settings.tsx` — No changes needed (screen stays, just hidden from tab bar)
- `src/__tests__/app-tabs.test.tsx` — Update tests to reflect new expected triggers
- `src/__tests__/app-tabs.web.test.tsx` — Update tests to reflect new expected triggers

### Approaches

1. **Filter-based approach — filter TABS at render time**
   - Add a `hidden` boolean field to `TabDefinition` in `src/constants/tabs.ts`
   - Set `hidden: true` on `index` and `settings` entries
   - In both `app-tabs.tsx` and `app-tabs.web.tsx`, filter `.filter(tab => !tab.hidden)` before rendering
   - Set `initialRouteName: 'explore'` via `unstable_settings` in `(tabs)/_layout.tsx`
   - Pros: Simple, declarative, single source of truth, easy to toggle later
   - Cons: None significant
   - Effort: **Low** — ~40 lines changed across 4 files (+ tests)

2. **Hidden-prop approach — use NativeTabs native `hidden` prop + conditional web rendering**
   - Keep `TABS` array unchanged
   - In `app-tabs.tsx` (native): conditionally pass `hidden={true}` on `NativeTabs.Trigger` for `index` and `settings`
   - In `app-tabs.web.tsx` (web): skip rendering `TabTrigger` for `index` and `settings`
   - Set `initialRouteName: 'explore'`
   - Pros: Uses the official native API (`hidden` prop is documented for `NativeTabs.Trigger`)
   - Cons: Less centralized — logic lives in two components instead of data model; harder to toggle; inconsistency between platforms (native uses `hidden`, web uses conditional render)
   - Effort: **Low** — similar line count but more scattered

3. **Route rename approach — make explore the index**
   - Rename `explore.tsx` → `index.tsx` and `index.tsx` → `home.tsx`
   - Update `TABS` array name references accordingly
   - Filter out `home` and `settings` from tab bar rendering
   - Pros: Cleanest routing — the main screen IS the index
   - Cons: Renaming files changes URLs for all routes; breaks existing navigation patterns; more invasive than needed
   - Effort: **Medium** — file renames, import updates, potential deep-link breakage

### Recommendation

**Approach 1: Filter-based approach with `hidden` field on `TabDefinition`**.

It's the cleanest: the data model expresses visibility, both platforms consume it the same way, and it's trivially reversible if they want to show Home/Settings again. Adding a `hidden: true` to two entries and filtering with `.filter()` is minimal code. The `initialRouteName` setting in `unstable_settings` is the standard Expo Router way to control which tab opens first.

The `hidden` prop on `NativeTabs.Trigger` is the Expo-sanctioned approach for native, but since the web implementation uses a custom `TabTrigger` (which doesn't have a `hidden` prop), unifying via the data model is cleaner than having two different hiding mechanisms.

### Risks

- **Remounting on dynamic change**: The Expo docs warn that dynamically changing `hidden` on `NativeTabs.Trigger` remounts the navigator and resets state. Since we're setting it statically (Home and Settings are always hidden), this is not a risk — the navigator mounts once with the correct configuration.
- **Web URL access**: Hidden tabs' routes are still accessible via direct URL (`/settings`, `/`). If they wanted to prevent that too, additional route guards would be needed. Per the user's request, they just want to hide from the tab bar — the screens should remain accessible.
- **Test updates**: Both test files (`app-tabs.test.tsx` and `app-tabs.web.test.tsx`) currently assert that all three triggers render. They'll need updating to assert only `explore` renders.
- **Navigation to hidden tabs**: Hidden tabs are still navigable programmatically via `router.push('/')` or `router.push('/settings')`. This is the desired behavior per the user's requirement ("no borrarlos, sino que no se muestren").

### Ready for Proposal

**Yes**. The scope is well-understood, the API surface is clear, and the effort is minimal. The proposal should specify:

1. Add `hidden?: boolean` to `TabDefinition`
2. Set `hidden: true` on `index` and `settings` entries
3. Filter `TABS` in both `app-tabs.tsx` and `app-tabs.web.tsx`
4. Add `unstable_settings` with `initialRouteName: 'explore'` to `(tabs)/_layout.tsx`
5. Update tests
