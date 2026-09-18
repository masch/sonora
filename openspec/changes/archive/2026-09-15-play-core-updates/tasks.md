# Tasks: PlayCoreUpdateProvider

## Review Workload Forecast

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: single-pr
400-line budget risk: Low
```

| Metric                       | Value        |
| ---------------------------- | ------------ |
| Estimated changed lines      | 80–120 lines |
| 400-line budget risk         | Low          |
| Chained PRs recommended      | No           |
| Delivery strategy            | single-pr    |
| Decision needed before apply | No           |

## Phase 1: Test Suite & Provider Implementation (`apps/mobile`)

- [x] 1.1 Write unit tests for `PlayCoreUpdateProvider` in `apps/mobile/src/services/__tests__/play-core-provider.test.ts` covering availability detection, mode mapping, and error propagation (RED)
- [x] 1.2 Implement `apps/mobile/src/services/play-core-provider.ts` using `sp-react-native-in-app-updates` (GREEN)
- [x] 1.3 Register `PlayCoreUpdateProvider` in `UpdateService` default providers list in `apps/mobile/src/services/update-service.ts`
- [x] 1.4 Write integration tests in `apps/mobile/src/services/__tests__/update-service.test.ts` asserting fallback from PlayCore to DeepLink on failure

## Phase 2: Quality & Validation

- [x] 2.1 Run mobile unit tests (`bun --filter @sonora/mobile test`)
- [x] 2.2 Run typecheck (`make typecheck`)
- [x] 2.3 Run lint (`make lint`)
- [x] 2.4 Verify with `make validate`
