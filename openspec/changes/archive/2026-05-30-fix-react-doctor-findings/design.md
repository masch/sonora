# Design: Fix react-doctor Findings

## Technical Approach

Pure code health pass — 19 react-doctor findings (score 92→100) across 10 files. No behavioral changes. Three impact groups: mechanical (cosmetic only), careful (needs component lifecycle understanding), architecture (component extraction).

## Architecture Decisions

### Decision: `expo-linear-gradient` — keep, suppress rule

| Option                                          | Tradeoff                                                                                                                                                  |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migrate to `backgroundImage` (CSS gradient)     | Experimental per SDK 56 docs, visual regression risk, different behavior on Android/iOS                                                                   |
| **Keep `expo-linear-gradient` + suppress rule** | Package is actively maintained in SDK 56 (https://docs.expo.dev/versions/v56.0.0/sdk/linear-gradient/). `backgroundImage` is experimental — no migration. |

**Decision**: Suppress `rn-no-legacy-expo-packages` on the `animated-icon.tsx` import. Add doc comment referencing SDK 56 docs.

### Decision: `Dimensions.get()` → `useWindowDimensions()` — move keyframes inside component

`INITIAL_SCALE_FACTOR` (module-level) and `keyframe` (depends on it) must move inside components:

| Scope                          | Strategy                                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `AnimatedSplashOverlay`        | `useWindowDimensions()` → compute scale factor inside (keyframe already inside component)                |
| `AnimatedIcon`                 | `useWindowDimensions()` + `useMemo` to recreate `keyframe` when dimensions change (rarely during splash) |
| `logoKeyframe`, `glowKeyframe` | Stay module-level — no dimension dependency                                                              |

### Decision: z-index scale — deliberate values

Replace `zIndex: 1000` (both files) with deliberate values based on stacking context:

| File                                             | Current | Replacement  | Reasoning                                                                                     |
| ------------------------------------------------ | ------- | ------------ | --------------------------------------------------------------------------------------------- |
| `animated-icon.tsx:136` (`backgroundSolidColor`) | `1000`  | `zIndex: 50` | Splash overlay on top of icon container (`zIndex: 100`), needs to be above. 50 is deliberate. |
| `animated-icon.web.tsx:82` (`container`)         | `1000`  | `zIndex: 50` | Layout container, nothing else stacked nearby                                                 |

Wait — `backgroundSolidColor` at `zIndex: 50` is BELOW `iconContainer` at `zIndex: 100`. That's wrong. Fix: use `zIndex: 200` for the splash overlay (above icon container's 100). For web container, `zIndex: 10` is sufficient (no competing stack context).

**Corrected**: splash overlay → `zIndex: 200`, web container → `zIndex: 10`.

### Decision: Extract `TabButton` + `CustomTabList` to own files

| File                                 | Action | Solves                                           |
| ------------------------------------ | ------ | ------------------------------------------------ |
| `src/components/tab-button.tsx`      | New    | `no-multi-comp` + `no-polymorphic-children`      |
| `src/components/custom-tab-list.tsx` | New    | `no-multi-comp`                                  |
| `src/components/app-tabs.web.tsx`    | Modify | Remove inline definitions, import from new files |

Both components lose `export default` status (internal-only). `TabButton` gets explicit `label: string` prop replacing `typeof children` check for `accessibilityLabel`.

### Decision: Suppression strategy for false positives

| Rule                                 | File                  | Suppression                                                                                                    |
| ------------------------------------ | --------------------- | -------------------------------------------------------------------------------------------------------------- |
| `deslop/unused-file`                 | `src/app/_layout.tsx` | `// deslop:keep-used — Expo Router auto-loads _layout.tsx`                                                     |
| `unused-export` (×4 false positives) | Various               | `// eslint-disable-next-line deslop/unused-export` — annotated with reason (deslop can't resolve `@/` aliases) |

## File Changes

| File                                           | Action     | Description                                                                                                         |
| ---------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/app/settings.tsx:27`                      | Modify     | `w-16 h-16` → `size-16`                                                                                             |
| `src/components/ui/collapsible.tsx:20`         | Modify     | `w-6 h-6` → `size-6`                                                                                                |
| `src/app/index.tsx:74`                         | Modify     | `px-4 py-4` → `p-4`                                                                                                 |
| `src/__tests__/hint-row.test.tsx:9`            | Modify     | Wrap `"Custom Hint"` in `<ThemedText>`                                                                              |
| `package.json`                                 | Modify     | Remove `"react-doctor"` from devDependencies                                                                        |
| `src/components/animated-icon.tsx`             | Modify     | `Dimensions.get()` → `useWindowDimensions()`; `zIndex: 1000` → `zIndex: 200`; suppress `rn-no-legacy-expo-packages` |
| `src/components/animated-icon.web.tsx`         | Modify     | `zIndex: 1000` → `zIndex: 10`                                                                                       |
| `src/components/app-tabs.web.tsx`              | Modify     | Remove `TabButton` + `CustomTabList` definitions, import from new files                                             |
| `src/components/tab-button.tsx`                | **Create** | Extracted `TabButton` with explicit `label` prop                                                                    |
| `src/components/custom-tab-list.tsx`           | **Create** | Extracted `CustomTabList`                                                                                           |
| `src/hooks/use-color-scheme.ts`                | Modify     | Suppress false-positive unused-export                                                                               |
| `src/app/_layout.tsx`                          | Modify     | Suppress false-positive deslop/unused-file                                                                          |
| Other files with false-positive unused-exports | Modify     | Add suppression comments                                                                                            |

## Testing Strategy

| Layer          | What to Test                            | Approach                                               |
| -------------- | --------------------------------------- | ------------------------------------------------------ |
| Regression     | `make doctor` exits 0 with score 100    | Run `make doctor` — this is the primary success metric |
| Existing tests | All tests still pass                    | `bun test`                                             |
| Type check     | No type errors                          | `make typecheck`                                       |
| Lint           | No lint errors                          | `make lint`                                            |
| Visual         | Splash animation works (both platforms) | Manual: app renders splash → fades → tabs visible      |
| Visual         | Tab bar renders on web                  | Manual: tabs navigate correctly                        |

No new tests needed — all changes are structural/style-only with zero behavioral delta.

## Open Questions

- [ ] How does react-doctor handle finding suppressions? Is it config-based or comment-based? (Resolve during apply phase.)
- [ ] Which 4 exports are the false-positive `unused-export` findings? (Will be identified during apply by running `make doctor` and inspecting output.)
