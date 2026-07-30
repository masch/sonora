# Tasks: Deriva del Bosque al Río — Price Change

## Review Workload Forecast

| Field                   | Value     |
| ----------------------- | --------- |
| Estimated changed lines | ~2        |
| 400-line budget risk    | Low       |
| Chained PRs recommended | No        |
| Suggested split         | single PR |
| Delivery strategy       | single-pr |
| Chain strategy          | pending   |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low
```

## Seed Data

- [x] Change `price: 1500000` to `price: 100` in `apps/api/src/db/seed.ts` for the `umepay-bosque` experience entry (id: `a23baa7e-2c82-472f-9241-4f23e00c1732`, line ~76). All other fields remain untouched. <!-- sdd-owner: implementation -->

## Test Mocks

- [x] Change `price: 1500000` to `price: 100` in `apps/mobile/src/__tests__/use-instructions-audio.test.ts` in the `mockOtherExperience` object (line ~37). All other fields remain untouched. <!-- sdd-owner: implementation -->

## Verification

- [x] Run `apps/mobile` test suite (`cd apps/mobile && bun test` or `npx jest`) and confirm `formatPrice(100, 'ARS')` display logic passes — existing test in `apps/mobile/src/__tests__/format-price.test.ts` covers the `isWhole` branch. <!-- sdd-owner: implementation -->
- [x] Confirm MP `unit_price` calculation: `Math.round(100 / 100) === 1` — existing test in `apps/api/src/__tests__/mercadopago.test.ts` (line ~198) validates the `amountCents / 100` conversion generically. <!-- sdd-owner: implementation -->
- [x] Run full test suite for both `apps/api` (`cd apps/api && vitest run`) and `apps/mobile` (`cd apps/mobile && npx jest --watchAll=false`) to confirm zero regressions. <!-- sdd-owner: implementation -->
- [x] Visual inspection: confirm no other `price: 1500000` references remain for the `umepay-bosque` experience anywhere in the repository. <!-- sdd-owner: implementation -->

## Lifecycle

- [x] Post-apply bounded review: validate the receipt against spec requirements. <!-- sdd-owner: parent -->
