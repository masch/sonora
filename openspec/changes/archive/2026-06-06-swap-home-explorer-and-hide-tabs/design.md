# Design: Swap Home/Explore tabs and hide Explore & Settings

## Technical Approach

Two independent but co-located changes: (A) swap UI content between route files, (B) add `hidden` support to `TabDefinition` and filter in both tab renderers. No shared state, no feature flags, no migration.

## Architecture Decisions

| Decision                 | Choice                                                                   | Alternatives                     | Rationale                                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content swap strategy    | Copy-paste full screen body between the two files                        | Extract shared component         | Both files are leaf screens with zero shared logic between them. A new component name would be misleading. File-based routing keeps the file→route mapping unchanged.           |
| Component function names | Keep `HomeScreen` and `ExploreScreen` even after swap                    | Rename for accuracy              | Expo Router uses the default export, not the function name. Tests reference `HomeScreen`/`ExploreScreen` by import, not by display name. Renaming adds churn with zero benefit. |
| Tab hiding mechanism     | Add `hidden?: boolean` to `TabDefinition`, filter `TABS` before `.map()` | Remove entries from `TABS` array | Removing entries would lose label/icon references for potential future use. A `hidden` flag is self-documenting and reversible.                                                 |
| Filter location          | In both `app-tabs.tsx` and `app-tabs.web.tsx`                            | Filter once in a shared utility  | Each tab renderer maps differently (NativeTabs.Trigger vs TabTrigger). Filtering inline is clearer than an indirection for a one-liner.                                         |

## Data Flow

```
tabs.ts (static config)
  └─→ TABS.filter(tab => !tab.hidden) → filtered[]
        ├─→ app-tabs.tsx   → NativeTabs.Trigger × 1
        └─→ app-tabs.web.tsx → TabTrigger × 1
```

Route content is entirely static — no data flow changes. `index.tsx` renders `<TripMap />`, `explore.tsx` renders the old Home content. Both route files remain accessible via URL.

## File Changes

| File                                  | Action | Description                                                                           |
| ------------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| `src/app/(tabs)/index.tsx`            | Modify | Replace Home UI with TripMap import and wrapper from explore.tsx                      |
| `src/app/(tabs)/explore.tsx`          | Modify | Replace TripMap with old Home UI (imports + layout + content) from index.tsx          |
| `src/constants/tabs.ts`               | Modify | Add `hidden?: boolean` to `TabDefinition`; set `hidden: true` on explore and settings |
| `src/components/app-tabs.tsx`         | Modify | Add `.filter(tab => !tab.hidden)` before `.map()`                                     |
| `src/components/app-tabs.web.tsx`     | Modify | Same filter for web renderer                                                          |
| `src/__tests__/app-tabs.test.tsx`     | Modify | Update assertions: 3 triggers → 1 trigger (index only)                                |
| `src/__tests__/app-tabs.web.test.tsx` | Modify | Same assertion change                                                                 |

## Interfaces / Contracts

### `TabDefinition` — interface extension

```typescript
export interface TabDefinition {
  name: string;
  label: string;
  ioniconsName: string;
  symbolViewName: {
    ios: SFSymbol;
    android?: AndroidSymbol;
    web?: AndroidSymbol;
  };
  hidden?: boolean; // ← ADDED: when true, tab is hidden from visible bar
}
```

### Tab entries — updated `TABS` array

```typescript
export const TABS = [
  { name: 'index',  label: 'Home',     ..., hidden: undefined },  // visible
  { name: 'explore', label: 'Explore',  ..., hidden: true },      // hidden
  { name: 'settings', label: 'Settings', ..., hidden: true },      // hidden
] as const satisfies TabDefinition[];
```

## Testing Strategy

| Layer         | What to Test                          | Approach                                                                                                                                              |
| ------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (native) | Only 1 NativeTabs.Trigger rendered    | Update `app-tabs.test.tsx`: `getByTestId('native-trigger-index')` passes, `native-trigger-explore` and `native-trigger-settings` throw (not rendered) |
| Unit (web)    | Only 1 TabTrigger rendered            | Update `app-tabs.web.test.tsx`: `tab-trigger-index` exists, `tab-trigger-explore` and `tab-trigger-settings` throw                                    |
| Smoke         | Both route files render without crash | Existing render tests on the screens (no new test needed — current test coverage for each screen verifies its render)                                 |

## Migration / Rollout

No migration required. This is a static config + content change with no persisted state.

Rollback: `git checkout` the 7 affected files as documented in the proposal.

## Open Questions

None.
