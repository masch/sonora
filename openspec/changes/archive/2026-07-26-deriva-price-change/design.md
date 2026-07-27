# Design: Deriva del Bosque al Río — Price Change

**Change:** `deriva-price-change`
**Status:** Design complete
**Author:** SDD design executor
**Date:** 2026-07-20

---

## 1. Overview

Permanent price change of the "Deriva del Bosque al Río" experience (slug `umepay-bosque`, id `a23baa7e-2c82-472f-9241-4f23e00c1732`) from **15,000 ARS** (1,500,000 cents) to **1 ARS** (100 cents). This is a **data-only change** — no new infrastructure, no API changes, no UI modifications, no migration scripts.

The experience remains a paid (non-free) experience (`free: false`) and continues through the full Mercado Pago Checkout Pro flow. The net-negative commission (~6–7 ARS on a 1 ARS charge) is accepted by design.

---

## 2. Affected Files

Exactly **2 files** — data values only, no logic changes.

### 2.1. `apps/api/src/db/seed.ts` (line 76)

| Field            | Before    | After     |
| ---------------- | --------- | --------- |
| `price`          | `1500000` | `100`     |
| `free`           | `false`   | unchanged |
| `currency`       | `'ARS'`   | unchanged |
| all other fields | —         | unchanged |

### 2.2. `apps/mobile/src/__tests__/use-instructions-audio.test.ts` (line 36)

| Field            | Before    | After     |
| ---------------- | --------- | --------- |
| `price`          | `1500000` | `100`     |
| all other fields | —         | unchanged |

---

## 3. Why No Other Files Change

### 3.1. Payment flow reads `experience.price` generically

The `usePurchase` hook (`apps/mobile/src/hooks/use-purchase.ts`) is called as:

```ts
const [purchaseState, purchaseActions] = usePurchase(track.id, track.free, track.price);
```

There is **no minimum-amount validation gate**. The price value passes through to `PaymentClient.createPayment` unchanged regardless of magnitude. A price of 100 cents flows identically to 1,500,000 cents through every code path.

### 3.2. MP unit_price calculation

```ts
// apps/api/src/payments/mercadopago.ts:45
unit_price: Math.round(params.amount / 100),
```

With `params.amount = 100` cents → `Math.round(100 / 100)` = **1**. The MP preference receives `unit_price: 1` with `currency_id: 'ARS'`. Correct.

The existing MP test (`apps/api/src/__tests__/mercadopago.test.ts:198`) already validates this conversion with `unit_price: amountCents / 100` — no new test needed.

### 3.3. Price display (`formatPrice`)

```ts
// packages/shared/src/utils/format-price.ts
const isWhole = cents % 100 === 0; // 100 % 100 === 0 → true
```

`formatPrice(100, 'ARS')`:

1. `isWhole = true` → `defaultFractionDigits = 0`
2. `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(1)`
3. → **"ARS 1"** (no decimal digits, correct display)

No changes to `formatPrice` or its callers.

### 3.4. PaymentPrompt is generic

The `PaymentPrompt` component (`apps/mobile/src/components/payment-prompt.tsx`) receives `price` and `currency` as props and calls `formatPrice(price, currency)` for display. No price-specific branching logic.

### 3.5. No database migration

The production DB is updated manually by the user via a direct SQL `UPDATE`. No migration script is created — the change is a single integer value, and a full migration would be disproportionate.

---

## 4. Data Flow

```
                          ┌─────────────────────┐
                          │    seed.ts           │
                          │  price: 100 (cents)  │
                          │  (dev/test DB only)  │
                          └─────────┬───────────┘
                                    │
                                    ▼
                          ┌─────────────────────┐
                          │  Production DB       │
                          │  (manual SQL UPDATE) │
                          │  price = 100         │
                          └─────────┬───────────┘
                                    │
                                    ▼
                     ┌───────────────────────────┐
                     │  GET /experiences          │
                     │  → { ... price: 100 ... }  │
                     └─────────┬─────────────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
      ┌──────────────────────┐  ┌──────────────────────┐
      │ TripDetailView        │  │ TrackDetailView       │
      │ usePurchase(          │  │ usePurchase(          │
      │   id, free, price)    │  │   id, free, price)    │
      └──────────┬───────────┘  └──────────┬───────────┘
                 │                          │
                 └──────────┬──────────────┘
                            ▼
              ┌─────────────────────────────┐
              │  PaymentClient.createPayment │
              │  amount: 100 (cents)         │
              └──────────┬──────────────────┘
                         │
                         ▼
              ┌─────────────────────────────┐
              │  API POST /payments/create   │
              │  → amount: 100               │
              └──────────┬──────────────────┘
                         │
                         ▼
              ┌─────────────────────────────┐
              │  mercadopago.ts              │
              │  unit_price: Math.round(     │
              │    100 / 100) = 1            │
              └──────────┬──────────────────┘
                         │
                         ▼
              ┌─────────────────────────────┐
              │  MP Checkout Pro             │
              │  preference: unit_price: 1   │
              └─────────────────────────────┘

              ┌─────────────────────────────┐
              │  PaymentPrompt               │
              │  formatPrice(100, 'ARS')     │
              │  → "ARS 1"                   │
              └─────────────────────────────┘
```

---

## 5. Verification Approach

| Check              | What to verify                                    | How                                      |
| ------------------ | ------------------------------------------------- | ---------------------------------------- |
| **Seed data**      | `umepay-bosque.price = 100` in seed.ts            | Visual inspection or `grep` after change |
| **Test mock**      | `mockOtherExperience.price = 100` in test file    | Visual inspection after change           |
| **DB seed run**    | Seed runs without error, price persists in dev DB | `npx ts-node seed.ts` then check DB      |
| **formatPrice**    | `formatPrice(100, 'ARS')` returns `"ARS 1"`       | Run existing `format-price.test.ts`      |
| **MP unit_price**  | Checkout creates preference with `unit_price: 1`  | Run existing `mercadopago.test.ts`       |
| **No regressions** | All existing tests pass                           | Full test suite both packages            |

**No new tests are required** — the existing test suite covers all affected code paths. The mock update in `use-instructions-audio.test.ts` ensures the test mock stays in sync with the seed data.

---

## 6. Rollout Plan

1. **Apply** both file changes (seed + test mock)
2. **Run** full test suite to confirm green
3. **Merge** to main
4. **Deploy** API (changed seed affects fresh/rebuild environments only)
5. **Manual SQL** on production DB: `UPDATE experiences SET price = 100 WHERE id = 'a23baa7e-2c82-472f-9241-4f23e00c1732';`

### Rollback

- **Seed**: revert `price: 100` → `price: 1500000` in seed.ts
- **Test mock**: revert `price: 100` → `price: 1500000` in test file
- **Production DB**: `UPDATE experiences SET price = 1500000 WHERE id = 'a23baa7e-2c82-472f-9241-4f23e00c1732';`

---

## 7. Risks & Mitigations

| Risk                                         | Likelihood                                          | Mitigation                                                    |
| -------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------- |
| Seed validation tests assert specific prices | Low                                                 | Update assertions if they exist; no evidence from code search |
| MP rejects `unit_price: 1` as below minimum  | Very Low — no documented minimum for Checkout Pro   | Test with real sandbox credentials before production          |
| `formatPrice(100, 'ARS')` edge case          | None — `isWhole` branch is deterministic and tested | Existing `format-price.test.ts` covers this path              |
| Net-negative per transaction                 | Certain by design                                   | User accepts cost                                             |
