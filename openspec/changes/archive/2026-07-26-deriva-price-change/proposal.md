# SDD Proposal: Deriva del Bosque al Río — Price Change

## 1. Intent

Change the price of the "Deriva del Bosque al Río" experience (slug: `umepay-bosque`, id: `a23baa7e-2c82-472f-9241-4f23e00c1732`) from **15,000 ARS** (1,500,000 cents) to **1 ARS** (100 cents). This is a **permanent price change**, not a promotion or discount code. The experience remains a paid (non-free) experience that goes through the full Mercado Pago Checkout Pro flow.

**Rationale**: The user wants to make this experience accessible at a symbolic price. The net-negative transaction (MP fees of ~7 ARS on a 1 ARS charge) is an accepted cost.

## 2. Mercado Pago Commission Analysis

Based on current Argentina Checkout Pro rates (2026):

| Component                             | Rate                                     | On 1 ARS                 |
| ------------------------------------- | ---------------------------------------- | ------------------------ |
| Credit card (immediate) fee           | 6.29%–6.49% + IVA (~7.85% effective)     | ~0.08 ARS                |
| Debit card (immediate) fee            | 3.25%–3.49% + IVA (~4.22% effective)     | ~0.04 ARS                |
| Dinero en cuenta (MP wallet)          | Exact rate not documented — likely lower | Unknown                  |
| Fixed fee per transaction             | ~6 ARS (multiple sources)                | 6 ARS                    |
| IVA (21%) on fixed fee                | ~1.26 ARS                                | 1.26 ARS                 |
| **Total estimated fee (credit card)** |                                          | **~7.33 ARS**            |
| **Net seller receipt**                |                                          | **~ −6.33 ARS per sale** |

Each sale at 1 ARS costs approximately 6–7 ARS in fees. The user is aware and accepts this cost.

**Note**: The `DEFAULT_PAYMENT_PROVIDER` environment variable controls which provider is used. If MP fees become a concern, switching to a different provider for this experience would be a separate change.

## 3. Scope

### In Scope

**Database / Seed Data (`apps/api/src/db/seed.ts`)**

- Change the `umepay-bosque` experience entry:
  - `price`: `1500000` → `100`
  - All other fields remain unchanged (`free: false`, `currency: 'ARS'`, etc.)

**Tests (`apps/mobile/src/__tests__/use-instructions-audio.test.ts`)**

- Update the `mockOtherExperience` mock object:
  - `price`: `1500000` → `100`

**No other code changes needed** because:

- The API payment flow reads `experience.price` generically and passes it to MP as `Math.round(amount/100)` → 100 cents → 1 ARS unit_price. No minimum-amount validation gates.
- The mobile `PaymentPrompt` component displays price via `formatPrice(price, currency)` from `@sonora/shared`. `formatPrice(100, 'ARS')` → `"ARS 1"` (100 % 100 === 0 → whole number → 0 fraction digits via `Intl.NumberFormat`).
- No database migration file needed — the production DB will be updated manually by the user.

### Out of Scope (Explicit Non-Goals)

- No changes to any other experience's price, `free` flag, or configuration.
- No new payment provider, promo code system, or discount infrastructure.
- No changes to the purchase flow, webhook handling, or access validation.
- No refunds or reprocessing of existing purchases.
- No changes to MP integration or `unit_price` calculation logic.
- No minimum-price validation (the 1 ARS price goes through the existing flow unchanged).

## 4. Affected Areas

| Area                                                       | Impact                                                     |
| ---------------------------------------------------------- | ---------------------------------------------------------- |
| `apps/api/src/db/seed.ts`                                  | Change `price: 1500000` to `price: 100` (line ~76)         |
| `apps/mobile/src/__tests__/use-instructions-audio.test.ts` | Change `price: 1500000` to `price: 100` in mock (line ~37) |
| Production DB                                              | Manual update of `price` column for `umepay-bosque` row    |

## 5. Risks

| Risk                                  | Likelihood                                                                                                               | Mitigation                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| **MP rejects 1 ARS as below minimum** | Low — MP Checkout Pro has no documented minimum amount; 1 ARS transactions are valid                                     | Test with a real MP credential in sandbox first         |
| **Existing purchases broken**         | None — purchases are already completed and stored; the price change only affects future transactions                     | No action needed                                        |
| **formatPrice displays wrong value**  | Very Low — `formatPrice` handles cents correctly and 100 is a whole-cent value; already tested in `format-price.test.ts` | Verify with `formatPrice(100, 'ARS')` returns `"ARS 1"` |
| **Seed.ts test pipeline fails**       | Low — if there are seed-data validation tests that assert specific prices                                                | Update test assertions to match new price               |
| **Net-negative per transaction**      | Certain — this is by design                                                                                              | User accepts this cost                                  |

## 6. Rollback Plan

**Database revert**: Update `price` back to `1500000` in the production DB (manual SQL). Seed file revert: change `price` back to `1500000` in `seed.ts`.

**No deployment ordering concerns**: The change is a single data value. Frontend and backend are already compatible with any price value.

## 7. Success Criteria

1. `seed.ts` contains `price: 100` for the `umepay-bosque` experience.
2. The `mockOtherExperience` in `use-instructions-audio.test.ts` contains `price: 100`.
3. A checkout for `umepay-bosque` creates an MP preference with `unit_price: 1`.
4. `formatPrice(100, 'ARS')` outputs `"ARS 1"` in the payment prompt.
5. All existing tests pass with the updated mock value.
6. No regressions in any other experience's price, purchase flow, or display.
