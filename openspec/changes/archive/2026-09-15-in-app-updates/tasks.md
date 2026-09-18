# Tasks: In-App Updates

## Review Workload Forecast

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: single-pr
400-line budget risk: Low
```

| Metric                       | Value         |
| ---------------------------- | ------------- |
| Estimated changed lines      | 200–260 lines |
| 400-line budget risk         | Low           |
| Chained PRs recommended      | No            |
| Delivery strategy            | single-pr     |
| Decision needed before apply | No            |

## Phase 1: Store URL Resolution (`apps/mobile`)

- [x] 1.1 Write unit tests for `getStoreUrls()` in `apps/mobile/src/services/__tests__/store-url.test.ts` covering Android (`market://` and HTTPS), iOS (`itms-apps://` and HTTPS), and Web fallbacks (RED)
- [x] 1.2 Implement `apps/mobile/src/services/store-url.ts` using `Application.applicationId` from `expo-application` (GREEN)

## Phase 2: Update Service & Strategy Pattern (`apps/mobile`)

- [x] 2.1 Write unit tests for `UpdateService` in `apps/mobile/src/services/__tests__/update-service.test.ts` verifying provider invocation, error handling, and graceful fallback to store deep link (RED)
- [x] 2.2 Implement `apps/mobile/src/services/update-service.ts` exposing `UpdateProvider` interface, `DeepLinkUpdateProvider`, and `updateService` singleton (GREEN)

## Phase 3: Mobile UI & i18n Integration (`apps/mobile`)

- [x] 3.1 Add `versionCheck.bannerUpdate` localization key in `apps/mobile/src/i18n/locales/en.ts` and `es.ts`
- [x] 3.2 Update `UpdateRequiredModal` in `apps/mobile/src/components/update-required-modal.tsx` to invoke `updateService.triggerUpdate({ mode: 'immediate' })`
- [x] 3.3 Update `UpdateWarningBanner` in `apps/mobile/src/components/update-warning-banner.tsx` to include an "Update" button invoking `updateService.triggerUpdate({ mode: 'flexible' })`
- [x] 3.4 Update component tests in `apps/mobile/src/components/__tests__/update-required-modal.test.tsx` and `update-warning-banner.test.tsx` (RED → GREEN)

## Phase 4: Quality & Validation

- [x] 4.1 Run mobile test suite: `bun --filter @sonora/mobile test`
- [x] 4.2 Run monorepo typecheck: `make typecheck`
- [x] 4.3 Run linter: `make lint`

## Phase 5: Android Web Gate (`apps/mobile` & `@sonora/shared`)

- [x] 5.1 Add `getPlayStoreUrl()` helper and unit tests in `apps/mobile/src/services/store-url.ts` and `apps/mobile/src/services/__tests__/store-url.test.ts` (RED → GREEN)
- [x] 5.2 Add `webGate.*` localization strings in `packages/shared/src/locales/en.ts` and `es.ts`
- [x] 5.3 Write unit tests for `AndroidWebGate` in `apps/mobile/src/components/__tests__/android-web-gate.test.tsx` (RED)
- [x] 5.4 Implement `AndroidWebGate` in `apps/mobile/src/components/android-web-gate.tsx` and integrate in `apps/mobile/src/app/_layout.tsx` (GREEN)
- [x] 5.5 Validate test suite, typecheck, and lint
