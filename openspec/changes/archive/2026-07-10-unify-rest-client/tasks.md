# Tasks: Unify REST Client Core

## Review Workload Forecast

| Field                   | Value          |
| ----------------------- | -------------- |
| Estimated changed lines | 150 - 250      |
| 400-line budget risk    | Low            |
| Chained PRs recommended | No             |
| Suggested split         | Single PR      |
| Delivery strategy       | single-pr      |
| Chain strategy          | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Foundation / Infrastructure

- [x] 1.1 Create `packages/shared/src/api/base-client.ts` with `BaseApiClient` and type definitions.
- [x] 1.2 Export `BaseApiClient` and configuration types in `packages/shared/src/index.ts`.

## Phase 2: Core Implementation

- [x] 2.1 Refactor `apps/admin/src/services/admin-api-client.ts` to instantiate and extend `BaseApiClient`.
- [x] 2.2 Refactor `apps/mobile/src/services/api-client.ts` to instantiate and extend `BaseApiClient` passing SQLite storage adapters.

## Phase 3: Testing / Verification

- [x] 3.1 Write unit tests for `BaseApiClient` under `packages/shared/src/__tests__/base-client.test.ts` covering request serialization, error checks, auth token headers, and offline caching.
- [x] 3.2 Run `bun test` in `packages/shared` and verify all tests pass.
- [x] 3.3 Verify types and compile checks by running `make typecheck`.
- [x] 3.4 Verify codebase gate checks by running `make validate`.
