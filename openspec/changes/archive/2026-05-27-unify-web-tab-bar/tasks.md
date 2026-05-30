# Tasks: Unify Web Tab Bar

## Review Workload Forecast

| Field                   | Value                                     |
| ----------------------- | ----------------------------------------- |
| Estimated changed lines | ~90 (35 new + 55 modified across 4 files) |
| 400-line budget risk    | Low                                       |
| Chained PRs recommended | No                                        |
| Suggested split         | Single PR                                 |
| Delivery strategy       | ask-on-risk                               |
| Chain strategy          | pending                                   |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                                                      | Likely PR | Notes                                            |
| ---- | --------------------------------------------------------- | --------- | ------------------------------------------------ |
| 1    | Shared config + component iterations + cleanup + test fix | Single PR | All 4 files, atomic commit, well under 400 lines |

## Phase 1: Foundation — Shared Tab Config

- [x] 1.1 Create `src/constants/tabs.ts` exporting `TabDefinition` type and `TABS` const array with all 3 entries (name, label, ioniconsName, symbolViewName) — S3: three tabs preserved with correct icons

## Phase 2: Core Implementation — Component Updates

- [x] 2.1 Update `src/components/app-tabs.tsx`: replace 3 hardcoded `<NativeTabs.Trigger>` with `TABS.map()` — S1: native triggers driven by shared defs
- [x] 2.2 Update `src/components/app-tabs.web.tsx`: replace 3 hardcoded `<TabTrigger>` with `TABS.map()`, iterate `symbolViewName` for `<Icon>` — S2: web triggers driven by shared defs
- [x] 2.3 Remove `<ThemedText>` "Expo Starter" and `<ExternalLink>` "Docs" from `CustomTabList` in `app-tabs.web.tsx` — S4: no branding, S5: no Docs link, S6: pill container preserved
- [x] 2.4 Fix root `TabTrigger` name: `"home"` → `"index"` with `href` still `"/"` in `app-tabs.web.tsx` — S7: root trigger renamed, S8: old name absent

## Phase 3: Testing

- [x] 3.1 Update `src/__tests__/app-tabs.web.test.tsx`: change `getByTestId('tab-trigger-home')` → `getByTestId('tab-trigger-index')` — S9: test assertion updated
- [x] 3.2 Verify all existing tests pass: `npx jest src/__tests__/app-tabs.web.test.tsx src/__tests__/app-tabs.test.tsx`

## Phase 4: Verification

- [x] 4.1 Run `npx tsc --noEmit` — typecheck passes with no new errors
- [x] 4.2 Run `npx eslint src/constants/tabs.ts src/components/app-tabs.tsx src/components/app-tabs.web.tsx` — lint clean
- [x] 4.3 Import audit: no remaining hardcoded tab-definition strings in either component (name, label, icon names should all come from `TABS`)

## Scenario Coverage

| Scenario                                    | Requirement             | Tasks    |
| ------------------------------------------- | ----------------------- | -------- |
| S1: Native triggers driven by shared defs   | Unified Tab Definitions | 1.1, 2.1 |
| S2: Web triggers driven by shared defs      | Unified Tab Definitions | 1.1, 2.2 |
| S3: Three tabs preserved with correct icons | Unified Tab Definitions | 1.1      |
| S4: No branding text                        | Web Bar Cleanup         | 2.3      |
| S5: No Docs external link                   | Web Bar Cleanup         | 2.3      |
| S6: Pill container preserved                | Web Bar Cleanup         | 2.3      |
| S7: Root trigger renamed to "index"         | Tab Naming Consistency  | 2.4      |
| S8: Old "home" name absent                  | Tab Naming Consistency  | 2.4      |
| S9: Test assertion updated                  | Tab Naming Consistency  | 3.1      |
