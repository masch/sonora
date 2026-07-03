# Tasks: App Version Check

## Review Workload Forecast

| Field                   | Value                                                                    |
| ----------------------- | ------------------------------------------------------------------------ |
| Estimated changed lines | ~500-600                                                                 |
| 400-line budget risk    | High                                                                     |
| Chained PRs recommended | Yes                                                                      |
| Suggested split         | PR 1 (shared) → PR 2 (API) independiente → PR 3 (store) → PR 4 (UI+i18n) |
| Delivery strategy       | ask-on-risk                                                              |
| Chain strategy          | pending                                                                  |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal                                       | Likely PR | Notes                                       |
| ---- | ------------------------------------------ | --------- | ------------------------------------------- |
| 1    | Shared foundation: semver + schema         | PR 1      | base=main; ~120 lines                       |
| 2    | API layer: env vars, route, tests          | PR 2      | base=main, no semver dep; ~60 lines         |
| 3    | Mobile store: grace period + versionStatus | PR 3      | base=main, dep on Unit 1 schema; ~140 lines |
| 4    | Mobile UI + i18n: modal, banner, layout    | PR 4      | base=main, dep on Unit 3; ~230 lines        |

## Phase 1: Shared Foundation

- [x] 1.1 Create `packages/shared/src/semver.ts` — `gte(a, b): boolean | null`, parse numeric parts, compare major.minor.patch
- [x] 1.2 Write `packages/shared/src/__tests__/semver.test.ts` — RED: failing tests for sufficient/below/equal/invalid/prerelease
- [x] 1.3 Make tests pass — GREEN: equal→true, 1.10.0≥1.9.0→true, 1.0.0≥2.0.0→false, invalid→null
- [x] 1.4 Add `RemoteConfigAppVersionSchema` to `packages/shared/src/schemas/config.ts` + update `DEFAULT_REMOTE_CONFIG`
- [x] 1.5 Update `packages/shared/src/__tests__/config.test.ts` — test appVersion parsing and defaults
- [x] 1.6 Re-export `gte` from `packages/shared/src/index.ts`

## Phase 2: API Layer

- [x] 2.1 Add `MINIMUM_APP_VERSION`, `BLOCK_OLDER_VERSIONS`, `GRACE_PERIOD_DAYS` to `Env` in `apps/api/src/index.ts`
- [x] 2.2 Add `[vars]` defaults to `apps/api/wrangler.toml`
- [x] 2.3 Read env vars and return `appVersion` from `apps/api/src/routes/config.ts`
- [x] 2.4 Assert `appVersion` in `apps/api/src/__tests__/config.test.ts`

## Phase 3: Mobile Store

- [x] 3.1 Add `getGracePeriodStart()`, `setGracePeriodStart()`, `clearGracePeriodStart()` to `apps/mobile/src/storage/config-cache.ts`
- [x] 3.2 Add `versionStatus` state + `computeVersionStatus()` to `apps/mobile/src/store/remote-config-store.ts`, wire into `loadConfig()`
- [x] 3.3 Test ok/warn/block/grace/offline scenarios in `apps/mobile/src/store/__tests__/remote-config-store.test.ts`

## Phase 4: Mobile UI + i18n

- [x] 4.1 Create `apps/mobile/src/components/update-required-modal.tsx` — full-screen non-dismissable overlay, i18n text, testID
- [x] 4.2 Create `apps/mobile/src/components/update-warning-banner.tsx` — dismissable top banner, i18n text, close button, testID
- [x] 4.3 Write `apps/mobile/src/components/__tests__/update-required-modal.test.tsx` — render + non-dismissable verification
- [x] 4.4 Write `apps/mobile/src/components/__tests__/update-warning-banner.test.tsx` — render + dismiss interaction
- [x] 4.5 Add `versionCheck.*` keys to `apps/mobile/src/i18n/locales/en.ts` and `es.ts`
- [x] 4.6 Subscribe to `versionStatus` in `apps/mobile/src/app/_layout.tsx` — render modal on 'block', banner on 'warn'
