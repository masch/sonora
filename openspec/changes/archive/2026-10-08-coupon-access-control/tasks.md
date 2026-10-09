# Tasks: Coupon Access Control

## Review Workload Forecast

| Field                   | Value       |
| ----------------------- | ----------- |
| Estimated changed lines | ~350        |
| 400-line budget risk    | Low         |
| Chained PRs recommended | No          |
| Suggested split         | Single PR   |
| Delivery strategy       | ask-on-risk |
| Chain strategy          | pending     |

## Phase 1: Database Schema & Migration

- [x] 1.1 Add `experience_coupons` and `experience_coupon_redemptions` tables with non-null `platform` enum in `apps/api/src/db/schema.ts`.
- [x] 1.2 Convert schema table constraints to array syntax `(table) => [ ... ]`.
- [x] 1.3 Generate migration `0018_productive_nighthawk.sql`.

## Phase 2: Middleware & Security

- [x] 2.1 Implement `hmacGuard` middleware in `apps/api/src/middleware/hmac-guard.ts` (fails-closed with 500 `HMAC_SECRET_MISSING`).
- [x] 2.2 Register `HMAC_SECRET_MISSING` in `apps/api/src/middleware/problem-details.ts`.
- [x] 2.3 Extend Hono `Variables` interface with `hmacSecret: string`.
- [x] 2.4 Add unit tests for `hmacGuard` in `apps/api/src/middleware/__tests__/guards.test.ts`.

## Phase 3: Route Handlers & Business Logic

- [x] 3.1 Implement `POST /payments/experiences/:id/coupons` with email hashing and masking.
- [x] 3.2 Implement `GET /payments/experiences/:id/purchased` with quota tracking and `{ purchased: true }` minimal response.
- [x] 3.3 Authorize audio streams in `GET /experiences` for coupon redemptions.
- [x] 3.4 Write E2E functional test suite in `apps/api/src/__tests__/coupons-functional.test.ts`.

## Phase 4: Mobile Integration & Clean Up

- [x] 4.1 Update `usePurchase.restore()` to handle coupon error codes and return boolean contract.
- [x] 4.2 Update `PaymentPrompt` Viaje Grupal restore UI.
- [x] 4.3 Verify full monorepo tests (`make test`) and linting (`make lint`).
