# Tasks: Terms and Conditions

## Review Workload Forecast

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: single-pr
400-line budget risk: Medium
```

| Metric                       | Value         |
| ---------------------------- | ------------- |
| Estimated changed lines      | 320–380 lines |
| 400-line budget risk         | Medium        |
| Chained PRs recommended      | No            |
| Delivery strategy            | single-pr     |
| Decision needed before apply | No            |

## Phase 1: Shared Schemas & Types (`packages/shared`)

- [x] 1.1 Write tests for terms DTOs and validation schemas in `packages/shared/src/__tests__/terms.test.ts` (RED)
- [x] 1.2 Implement `TermsResponse` and `AcceptTermsRequestSchema` in `packages/shared/src/schemas/terms.ts` and `packages/shared/src/types/terms.ts` (GREEN)
- [x] 1.3 Export terms schemas and types from `packages/shared/src/index.ts`

## Phase 2: Backend Persistence & Endpoints (`apps/api`)

- [x] 2.1 Add `terms_versions` and `terms_acceptances` table definitions in `apps/api/src/db/schema.ts`
- [x] 2.2 Add initial terms v1.0.0 seed data in `apps/api/src/db/seed-data.ts` and register in `apps/api/src/db/seed.ts`
- [x] 2.3 Write integration tests for `GET /api/terms` and `POST /api/terms/accept` in `apps/api/src/__tests__/terms.test.ts` (RED)
- [x] 2.4 Implement `apps/api/src/routes/terms.ts` with `GET /` and `POST /accept` handlers (GREEN)
- [x] 2.5 Mount `termsRouter` at `/api/terms` in `apps/api/src/index.ts`

## Phase 3: Mobile Storage & Hook (`apps/mobile`)

- [x] 3.1 Write unit tests for terms storage accessors in `apps/mobile/src/__tests__/app-storage-terms.test.ts` (RED)
- [x] 3.2 Add `getAcceptedTermsVersion` and `setAcceptedTermsVersion` in `apps/mobile/src/storage/app-storage-common.ts` and `apps/mobile/src/storage/app-storage.ts` (GREEN)
- [x] 3.3 Write unit tests for `useTermsCheck` handling first start, version bump, and offline state in `apps/mobile/src/__tests__/use-terms-check.test.ts` (RED)
- [x] 3.4 Implement `apps/mobile/src/hooks/use-terms-check.ts` (GREEN)

## Phase 4: Mobile UI & App Layout Integration (`apps/mobile`)

- [x] 4.1 Write component tests for `TermsModal` rendering and interactions in `apps/mobile/src/__tests__/terms-modal.test.tsx` (RED)
- [x] 4.2 Implement `apps/mobile/src/components/terms-modal.tsx` styled after `TrackDetailView` tokens (GREEN)
- [x] 4.3 Integrate `useTermsCheck` and render `TermsModal` in `apps/mobile/src/app/_layout.tsx`

## Phase 5: Verification & Quality Checks

- [x] 5.1 Run API test suite: `bun --filter @sonora/api test`
- [x] 5.2 Run Mobile test suite: `bun --filter @sonora/mobile test`
- [x] 5.3 Run monorepo typecheck: `make typecheck`
- [x] 5.4 Run linter: `make lint`
