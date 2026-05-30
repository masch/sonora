# Proposal: Unify Web Tab Bar

## Intent

The app has two divergent tab bar implementations (native + web) with inconsistent tab names (`"home"` vs `"index"`), hardcoded branding only on web, and duplicated icon/label definitions. This creates maintenance overhead — any tab change requires editing two files in different ways. Extract shared config, fix the naming mismatch, and remove web-only branding to align both implementations.

## Scope

### In Scope

- Create `src/constants/tabs.ts` with shared tab definitions (name, label, icon names for both icon systems)
- Remove "Expo Starter" branding and external "Docs" link from web tab bar
- Fix tab name `"home"` → `"index"` in `app-tabs.web.tsx`
- Update both `app-tabs.tsx` and `app-tabs.web.tsx` to import from shared config
- Update web tab bar tests for naming consistency

### Out of Scope

- Full unification into one component — NativeTabs and expo-router/ui Tabs have fundamentally incompatible APIs
- Design changes to tab bar appearance, layout, or floating pill styling
- Adding new tabs or modifying tab labels/routes
- Changing native tab bar styling or behavior

## Capabilities

### New Capabilities

None — pure refactor, no new behavioral capability introduced.

### Modified Capabilities

None — spec-level behavior unchanged. Tab labels, icons, routes, and navigation behavior remain identical. The existing `sonora-issue7` icon names contract is preserved.

## Approach

Extract tab definitions (name, label, Ionicons name, SymbolView names) into `src/constants/tabs.ts` as a shared typed array. Both implementations import from it iteratively instead of hardcoding content.

For the web bar: remove the "Expo Starter" `ThemedText` and external `ExternalLink` to Docs from `CustomTabList`, keeping only the floating pill shell with tab triggers. Rename `name="home"` → `name="index"` on the web `TabTrigger` to match native.

The native implementation is structurally unchanged — it continues using `NativeTabs.Trigger` with Ionicons but reads labels and icon names from shared defs. The web implementation reads SymbolView icon names for the `Icon` component.

## Affected Areas

| Area                                  | Impact   | Description                                                          |
| ------------------------------------- | -------- | -------------------------------------------------------------------- |
| `src/constants/tabs.ts`               | **NEW**  | Shared typed tab definitions array                                   |
| `src/components/app-tabs.tsx`         | Modified | Iterate shared defs instead of hardcoded triggers                    |
| `src/components/app-tabs.web.tsx`     | Modified | Iterate shared defs, remove branding/docs link, `"home"` → `"index"` |
| `src/__tests__/app-tabs.web.test.tsx` | Modified | Update `tab-trigger-home` test ID assertion → `tab-trigger-index`    |

## Risks

| Risk                                         | Likelihood | Mitigation                                                                        |
| -------------------------------------------- | ---------- | --------------------------------------------------------------------------------- |
| `"home"` → `"index"` breaks deep links       | Low        | Tab name is internal trigger ID; route is still `"/"`                             |
| Web bar layout shifts after branding removal | Low        | Floating pill root container unchanged; only inner branding/docs elements removed |
| Test assertions mismatch on tab name         | Low        | Fix test assertion alongside component rename — committed together                |

## Rollback Plan

Revert `app-tabs.web.tsx` tab name from `"index"` back to `"home"`. Re-add branding and Docs link. Delete `src/constants/tabs.ts`. Revert imports in both components. This is a single-commit revert — no data or schema impact.

## Dependencies

None.

## Success Criteria

- [ ] Both tab bars render identically to before (visually confirmed)
- [ ] Web tab bar has no "Expo Starter" branding text or "Docs" external link
- [ ] `src/constants/tabs.ts` is the single source of truth for tab definitions
- [ ] Tab name is `"index"` in both implementations
- [ ] All existing tests pass without modification except the `tab-trigger-home` → `tab-trigger-index` assertion
