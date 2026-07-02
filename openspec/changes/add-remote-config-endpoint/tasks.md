# Tasks: Add Remote Config Endpoint

## Review Workload Forecast

| Field                   | Value       |
| ----------------------- | ----------- |
| Estimated changed lines | ~330        |
| 400-line budget risk    | Low         |
| Chained PRs recommended | No          |
| Suggested split         | Single PR   |
| Delivery strategy       | ask-on-risk |
| Chain strategy          | pending     |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                                               | Likely PR | Notes                    |
| ---- | -------------------------------------------------- | --------- | ------------------------ |
| 1    | Shared types + API endpoint + API tests            | PR 1      | Independent; base = main |
| 2    | Mobile config layer (cache, provider, hook, tests) | PR 1      | Depends on PR 1          |
| 3    | Wire provider in layout + refactor consumers       | PR 1      | Depends on PR 2          |

All three units fit within 400 lines — single PR is appropriate.

## Phase 1: Foundation — Shared Types

- [x] 1.1 Create `packages/shared/src/schemas/config.ts` with `RemoteConfigPayloadSchema` (Zod), `RemoteConfigPayload` type, and `DEFAULT_REMOTE_CONFIG`
- [x] 1.2 Add `export * from './schemas/config'` in `packages/shared/src/index.ts`

## Phase 2: API Endpoint (with TDD)

- [x] 2.1 **RED**: Write `apps/api/src/__tests__/config.test.ts` — test happy path (200, shape, types), no null values, stateless/latency under 50ms, CORS header
- [x] 2.2 **GREEN**: Create `apps/api/src/routes/config.ts` — Hono router returning static `RemoteConfigPayload` JSON
- [x] 2.3 **GREEN**: Register `configRouter` in `apps/api/src/index.ts` with `app.route('/config', configRouter)`
- [x] 2.4 **REFACTOR**: Confirm all tests pass, verify coverage of all spec scenarios

## Phase 3: Mobile Config Layer (with TDD)

- [x] 3.1 Create `apps/mobile/src/storage/config-cache.ts` — KV-store wrapper for key `"remote-config"` (native)
- [x] 3.2 Create `apps/mobile/src/storage/config-cache.web.ts` — localStorage wrapper for same key (web)
- [x] 3.3 **RED**: Write `apps/mobile/src/providers/__tests__/remote-config-provider.test.ts` — test scenarios: happy path (fetch + merge), offline startup, 3s timeout, stale cache, first-launch offline, partial response, type mismatch
- [x] 3.4 **GREEN**: Create `apps/mobile/src/providers/remote-config-provider.tsx` — React context + `ConfigProvider` with fetch (`AbortController` + 3s timeout), Zod per-key validation, cache merge, `useCallback`-stable refetch
- [x] 3.5 **RED**: Write `apps/mobile/src/hooks/__tests__/use-remote-config.test.ts` — test hook returns merged config from context, loading state
- [x] 3.6 **GREEN**: Create `apps/mobile/src/hooks/use-remote-config.ts` — `useRemoteConfig()` re-exports from provider
- [x] 3.7 **REFACTOR**: All mobile tests green (49 suites, 344 tests), mock `global.fetch` and KV store

## Phase 4: Integration + Consumer Refactoring

- [x] 4.1 Wrap `<ConfigProvider>` around `<Stack>` in `apps/mobile/src/app/_layout.tsx` (before existing providers)
- [x] 4.2 Migrate `use-offline-geofence.ts`: replace module-level `const { radiusMeters } = APP_CONFIG.geofence` with `useRemoteConfig()` call inside the hook body
- [x] 4.3 Review `use-feedback-sync.ts` and `use-background-sync.ts` — replace `APP_CONFIG.feedback.syncIntervalSec` with dynamic config if spec requires runtime overrideability

## Phase 5: Verification

- [ ] 5.1 Run `make validate` (lint + typecheck + format) across all changed packages
- [ ] 5.2 Run full API test suite (`vitest run` in `apps/api`)
- [ ] 5.3 Run full mobile test suite (`jest` in `apps/mobile`)
