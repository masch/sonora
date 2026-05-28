# Delta: Unify Web Tab Bar

Context: Align native and web tab bar implementations by extracting shared tab definitions into `src/constants/tabs.ts`, removing "Expo Starter" branding and external "Docs" link from the web bar, and fixing the `"home"` → `"index"` naming mismatch on web to match native's Expo Router convention.

## ADDED Requirements

### Requirement: Unified Tab Definitions

The system MUST provide a single shared typed array in `src/constants/tabs.ts` that both tab bars import from. Each entry MUST include `name`, `label`, `ioniconName` (Ionicons icon for native), and `symbolIcon` (platform-discriminated icon names for web SymbolView).

Both `src/components/app-tabs.tsx` and `src/components/app-tabs.web.tsx` SHALL iterate this array to render their triggers instead of hardcoding definitions.

#### Scenario: Native triggers driven by shared defs

- GIVEN `src/constants/tabs.ts` exports the typed array
- WHEN `app-tabs.tsx` renders triggers via `.map()` over the array
- THEN each `NativeTabs.Trigger` MUST receive `name` and an Ionicons icon matching the array entry
- AND the label text MUST match the entry's `label` value

#### Scenario: Web triggers driven by shared defs

- GIVEN the same shared array
- WHEN `app-tabs.web.tsx` renders via `.map()` over the array
- THEN each `TabTrigger` MUST receive `name` from the entry
- AND the `Icon` component MUST receive `symbolIcon` from the entry
- AND the label text in `TabButton` MUST match the entry's `label`

#### Scenario: Three tabs preserved with correct icons

- GIVEN the shared array
- THEN it MUST contain exactly three entries: index/Home, explore/Explore, settings/Settings
- AND `ioniconName` MUST match current values: `home-outline`, `compass-outline`, `settings-outline`
- AND `symbolIcon` MUST match current values: `{ios:"house",android:"home",web:"home"}`, `{ios:"compass.drawing",android:"explore",web:"explore"}`, `{ios:"gear",android:"settings",web:"settings"}`

### Requirement: Web Bar Cleanup

The web tab bar MUST remove the "Expo Starter" `ThemedText` and the external "Docs" `ExternalLink` from `CustomTabList`. The floating pill container SHALL remain structurally unchanged — only the branding text and external link are removed.

#### Scenario: No branding text

- GIVEN the web tab bar renders after cleanup
- WHEN querying for text "Expo Starter"
- THEN no element with that text SHALL be present in the rendered output

#### Scenario: No Docs external link

- GIVEN the web tab bar renders after cleanup
- WHEN querying for text "Docs" or a link targeting "https://docs.expo.dev"
- THEN no such element SHALL be present

#### Scenario: Pill container preserved

- GIVEN the web tab bar renders after cleanup
- THEN the pill container inside `TabList` SHALL retain `rounded-[32px]` styling
- AND the three tab triggers SHALL still render inside it at the same relative positions

## MODIFIED Requirements

### Requirement: Tab Naming Consistency

The web root `TabTrigger` MUST use `name="index"` instead of `name="home"` to match the native implementation and Expo Router convention (`app/index.tsx`). The `href` SHALL remain `"/"`.

(Previously: web `TabTrigger` for root route used `name="home"` while native used `name="index"`.)

#### Scenario: Root trigger renamed to "index"

- GIVEN the web tab bar renders after the rename
- WHEN locating the root `TabTrigger` by `getByTestId('tab-trigger-index')`
- THEN the trigger MUST be found
- AND its `href` attribute MUST be `"/"`

#### Scenario: Old "home" name absent

- GIVEN the web tab bar renders after the rename
- WHEN searching for `getByTestId('tab-trigger-home')`
- THEN no element with that test ID SHALL exist

#### Scenario: Test assertion updated

- GIVEN `src/__tests__/app-tabs.web.test.tsx`
- WHEN checking the root trigger test assertion
- THEN it MUST use `getByTestId('tab-trigger-index')` instead of `getByTestId('tab-trigger-home')`
- AND all existing tests MUST pass without further modification
