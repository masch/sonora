# Archive Report: unify-web-tab-bar

**Change**: Unify Web Tab Bar
**Archived**: 2026-05-27
**Verdict**: PASS ✅ — 9/9 spec scenarios compliant, 24/24 tests pass, lint clean, typecheck clean

## Change Summary

Aligned the native and web tab bar implementations by extracting duplicated tab definitions (name, label, Ionicons name, SymbolView name) into a shared typed array at `src/constants/tabs.ts`. Removed "Expo Starter" branding text and external "Docs" link from the web tab bar (`CustomTabList`). Fixed the `"home"` → `"index"` naming mismatch on the web `TabTrigger` to match the native implementation and Expo Router convention.

The change is a pure refactor — no behavioral changes. Tab labels, icons, routes, and navigation remain identical. Both `app-tabs.tsx` and `app-tabs.web.tsx` now iterate over `TABS` from the shared config instead of hardcoding trigger definitions.

## Artifact Inventory

| Artifact          | Engram ID | Archive Path                                                              |
| ----------------- | --------- | ------------------------------------------------------------------------- |
| Proposal          | #2624     | `openspec/changes/archive/2026-05-27-unify-web-tab-bar/proposal.md`       |
| Spec (standalone) | #2625     | `openspec/changes/archive/2026-05-27-unify-web-tab-bar/specs/spec.md`     |
| Design            | #2626     | `openspec/changes/archive/2026-05-27-unify-web-tab-bar/design.md`         |
| Tasks             | #2627     | `openspec/changes/archive/2026-05-27-unify-web-tab-bar/tasks.md`          |
| Apply Progress    | #2628     | — (Engram only)                                                           |
| Verify Report     | #2629     | `openspec/changes/archive/2026-05-27-unify-web-tab-bar/verify-report.md`  |
| Archive Report    | (this)    | `openspec/changes/archive/2026-05-27-unify-web-tab-bar/archive-report.md` |

## Implementation Stats

| Metric           | Value                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| Tasks total      | 9                                                                                                           |
| Tasks complete   | 9                                                                                                           |
| Tasks incomplete | 0                                                                                                           |
| Files created    | 2 (`src/constants/tabs.ts`, `src/__tests__/tabs.test.ts`)                                                   |
| Files modified   | 2 (`src/components/app-tabs.tsx`, `src/components/app-tabs.web.tsx`, `src/__tests__/app-tabs.web.test.tsx`) |
| Test suites      | 4                                                                                                           |
| Tests passing    | 24 (unchanged from baseline)                                                                                |
| Build            | ✅ Passed                                                                                                   |
| Lint             | ✅ Clean                                                                                                    |
| Typecheck        | ✅ Clean                                                                                                    |
| Import audit     | ✅ All tab data flows from `TABS`                                                                           |

## Specs Synced

No main spec merge needed — the spec was standalone (no existing domain to merge into). The spec remains archived with the change artifacts.

## Key Decisions Made

1. **Config-only extraction over component unification** — NativeTabs (expo-router/unstable-native-tabs) and expo-router/ui Tabs have fundamentally incompatible component trees. A shared config array is the right boundary; a unified component facade would be an illusionary abstraction that hides platform-specific APIs.

2. **Dual-icon-field type over computed mapping** — The `TabDefinition` type carries both Ionicons name (`ioniconsName`) and SymbolView names (`symbolViewName`). Each platform maps directly without a lookup layer. Acceptable cost of +2 lines per tab for local reasoning.

3. **Route href computed inline** — `href` is derivable from tab name (`/` for index, `/{name}` otherwise), so it stays in the component rather than bloating the config.

4. **Dead import cleanup** — Removing branding/Docs from `CustomTabList` left `useColorScheme` as dead code. It was removed to keep lint clean.

## Known Issues

**None.** Zero critical, warning, or suggestion-level issues found during verification.

Task 5.3 (Visual check: light + dark mode on iOS/Android/Web) was listed in the original success criteria as manual, non-blocking. Not included in the 9 automated tasks.

## Next Steps

- The `src/constants/tabs.ts` shared config is now the single source of truth for tab definitions. Any future tab additions or changes require editing one file.
- Future changes that modify tab behavior should reference the `TabDefinition` type and `TABS` contract documented here.
- The `sonora-issue7` icon names contract (SymbolView names) is preserved and documented in the shared config.
