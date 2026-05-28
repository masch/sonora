# Design: Unify Web Tab Bar

## Technical Approach

Extract duplicated tab definitions (name, label, both icon systems) into `src/constants/tabs.ts` — a shared typed constant array. Both `app-tabs.tsx` (native) and `app-tabs.web.tsx` become thin renderers that import and iterate over the array. No behavioral change: same labels, same icons, same routes. Web additionally sheds branding and external link, and adopts the `"index"` name already used by native.

## Architecture Decisions

### Decision: Config-only extraction over component unification

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **A — Extract shared config array** | Duplicates icon-system fields per entry (+2 lines/tab), but components remain independently evolvable | ✅ **Chosen** |
| B — Unify both into one `AppTabs` component | Would require a render-props / slot abstraction that either hides platform-specific APIs or leaks them | Rejected — abstraction would be illusionary |
| C — Platform-icon-resolver service | Over-engineered for 3 entries; adds an indirection layer with no consumer benefit | Rejected |

**Why NOT full unification**: NativeTabs (`expo-router/unstable-native-tabs`) and expo-router/ui Tabs are fundamentally different component trees. NativeTabs uses a sub-component API (`NativeTabs.Trigger.Label`, `NativeTabs.Trigger.Icon`, `NativeTabs.Trigger.VectorIcon`) and consumes Ionicons via `VectorIcon`. Web Tabs uses slot-based composition (`Tabs` → `TabSlot` + `TabList` → `TabTrigger` as child) with `SymbolView` icon objects. They share no props, layout model, icon system, or styling mechanism. Any single-component facade would be a thin dispatch to two completely separate render paths — more complexity than the duplicated JSX it replaces.

### Decision: Dual-icon-field type over computed mapping

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **A — Tab type carries both icon systems** | Each entry duplicates icon info (Ionicons name + SymbolView names), but both platforms can map directly without lookup | ✅ **Chosen** |
| B — Tab type carries only name/label; platform computes icon | Adds a platform-specific icon-resolver function; fragment reasoning across files | Rejected |

Adding new tabs requires adding one entry with both icon fields. Acceptable cost for local reasoning.

## Data Flow

**Before:**
```
src/components/app-tabs.tsx          src/components/app-tabs.web.tsx
  ┌──────────────────────┐             ┌──────────────────────────────┐
  │ name: "index"   (hw)  │             │ name: "home" (hw)           │
  │ label: "Home"   (hw)  │             │ label: "Home"   (hw)        │
  │ icon: "home-out" (hw) │             │ icon: {ios,android,web} (hw)│
  │ name: "explore"  (hw) │             │ plus branding + Docs link   │
  │ ...                    │             │ ...                          │
  └──────────────────────┘             └──────────────────────────────┘
```

**After:**
```
src/constants/tabs.ts ──→ app-tabs.tsx (iterates, renders NativeTabs.Trigger)
  TABS: TabDefinition[]  ──→ app-tabs.web.tsx (iterates, renders TabTrigger)
                                └─ branding/Docs removed
                                └─ name from TABS → "index"
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/constants/tabs.ts` | **Create** | Exports `TabDefinition` type and `TABS` const array with all 3 tab entries |
| `src/components/app-tabs.tsx` | Modify | Replace hardcoded `<NativeTabs.Trigger>` × 3 with `TABS.map()` over imported array |
| `src/components/app-tabs.web.tsx` | Modify | Replace hardcoded `<TabTrigger>` × 3 with `TABS.map()`; remove `<ThemedText>` branding and `<ExternalLink>` Docs; fix `name="home"` → `name="index"` |
| `src/__tests__/app-tabs.web.test.tsx` | Modify | Change assertion `tab-trigger-home` → `tab-trigger-index` |

## Interfaces / Contracts

```typescript
// src/constants/tabs.ts
import type { SFSymbol, AndroidSymbol } from 'expo-symbols';

export type TabDefinition = {
  /** Route name: "index", "explore", or "settings" */
  name: string;
  /** Human-readable label (e.g., "Home") */
  label: string;
  /** Ionicons vector icon name (native) */
  ioniconsName: string;
  /** SymbolView icon names (web) */
  symbolViewName: {
    ios: SFSymbol;
    android?: AndroidSymbol;
    web?: AndroidSymbol;
  };
};

export const TABS = [
  {
    name: 'index',
    label: 'Home',
    ioniconsName: 'home-outline',
    symbolViewName: { ios: 'house', android: 'home', web: 'home' },
  },
  {
    name: 'explore',
    label: 'Explore',
    ioniconsName: 'compass-outline',
    symbolViewName: { ios: 'compass.drawing', android: 'explore', web: 'explore' },
  },
  {
    name: 'settings',
    label: 'Settings',
    ioniconsName: 'settings-outline',
    symbolViewName: { ios: 'gear', android: 'settings', web: 'settings' },
  },
] as const satisfies TabDefinition[];
```

Route `href` on web (`/` for index, `/{name}` otherwise) is computed inline in the component — not part of the config, since it is a derivable convention.

## Testing Strategy

| Layer | What to Verify | Approach |
|-------|---------------|----------|
| Unit | Tab labels render ("Home", "Explore", "Settings") | Existing tests pass unchanged |
| Unit | Web triggers have correct test ID (now `tab-trigger-index`) | Update 1 assertion to match new name |
| Unit | Native triggers have correct name (`native-trigger-*`) | Existing tests pass unchanged |
| Visual | Both bars look identical to pre-refactor | Manual visual check on web + native simulator |

No new tests needed. The shared config is a type-checked constant array — testing it provides no runtime value.

## Delivery Strategy Forecast

**Total delta**: ~5 new lines (net — extracting config replaces more lines than it adds due to branding removal). Well under the 400-line review budget.

- `Decision needed before apply`: **No**
- `Chained PRs recommended`: **No**
- `400-line budget risk`: **Low**

No migration required. Single atomic commit: create shared config, update both components, update test, remove branding.
