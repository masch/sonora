# Experience Pricing Specification

## Purpose

This specification defines the pricing behavior of paid experiences in the Sonora system, with specific focus on the "Deriva del Bosque al Río" experience (slug: `umepay-bosque`, id: `a23baa7e-2c82-472f-9241-4f23e00c1732`). The price of this experience is being changed from **15,000 ARS** (1,500,000 cents) to **1 ARS** (100 cents) as a permanent price change — not a promotion, discount, or temporary sale. The experience remains a paid (non-free) experience that goes through the full Mercado Pago Checkout Pro flow.

Pricing is stored as integer minor units (cents) in the database and seed data, converted to major units for Mercado Pago preferences (via `unit_price`) and for user-facing display (via `formatPrice`).

---

## Requirements

### Requirement: Seed Data Price Value

The seed data in `apps/api/src/db/seed.ts` MUST set the `price` field of the `umepay-bosque` experience entry to `100` (representing 100 cents = 1 ARS).

All other fields of this experience entry (`id`, `slug`, `title`, `description`, `format`, `themeKey`, `audioUrl`, `durationSeconds`, `latitude`, `longitude`, `free`, `currency`, `imageKey`, `geofenceBypassable`) MUST remain unchanged from their current values.

The `free` field MUST remain `false` — this experience is a paid (non-free) experience that goes through the full checkout flow.

#### Scenario: Seed contains updated price

- GIVEN the seed file `apps/api/src/db/seed.ts`
- WHEN the `umepay-bosque` experience object is inspected
- THEN the `price` field SHALL be `100`
- AND the `free` field SHALL be `false`
- AND the `currency` field SHALL be `'ARS'`
- AND all other fields (`id`, `slug`, `title`, `description`, `format`, `themeKey`, `audioUrl`, `durationSeconds`, `latitude`, `longitude`, `imageKey`, `geofenceBypassable`) SHALL retain their original values

#### Scenario: Other seed experiences unaffected

- GIVEN the seed file `apps/api/src/db/seed.ts`
- WHEN any experience other than `umepay-bosque` is inspected
- THEN its `price` field SHALL be unchanged from its current value

---

### Requirement: Test Mock Price Value

The `mockOtherExperience` mock object in `apps/mobile/src/__tests__/use-instructions-audio.test.ts` MUST set the `price` field to `100` (matching the new seed data value).

All other fields of this mock object MUST remain unchanged.

#### Scenario: Test mock contains updated price

- GIVEN the test file `apps/mobile/src/__tests__/use-instructions-audio.test.ts`
- WHEN the `mockOtherExperience` object is inspected
- THEN its `price` field SHALL be `100`
- AND its `free` field SHALL be `false`
- AND its `id` SHALL be `'a23baa7e-2c82-472f-9241-4f23e00c1732'`
- AND its `slug` SHALL be `'umepay-bosque'`
- AND all other fields SHALL retain their original values

---

### Requirement: MP Preference Unit Price

When a checkout is created for the `umepay-bosque` experience, the Mercado Pago Checkout Pro preference MUST have `unit_price: 1` (the price in major units, derived from `Math.round(100 / 100) = 1`).

The existing `unit_price` calculation logic (`Math.round(amount / 100)`) MUST NOT be modified — the price change in the data layer is sufficient to produce the correct unit price.

#### Scenario: Checkout creates preference with unit_price = 1

- GIVEN a user initiates a purchase of `umepay-bosque`
- WHEN the system creates the Mercado Pago Checkout Pro preference
- THEN the preference SHALL have `unit_price: 1`
- AND the preference SHALL have `currency_id: 'ARS'`
- AND the preference SHALL have `transaction_amount: 1`

#### Scenario: Other experiences unaffected

- GIVEN a user initiates a purchase of any experience other than `umepay-bosque`
- WHEN the system creates the Mercado Pago Checkout Pro preference
- THEN the `unit_price` SHALL reflect that experience's price (unchanged from current behavior)

---

### Requirement: Price Display Formatting

The `formatPrice` function from `@sonora/shared` MUST render the price of the `umepay-bosque` experience as "ARS **1**" (or the equivalent formatted string in the `es-AR` locale, without decimal fraction digits).

Since `100 % 100 === 0`, the function's `isWhole` branch applies and sets `minimumFractionDigits: 0`, producing a whole-number display with no decimal places.

#### Scenario: formatPrice(100, 'ARS') returns whole number display

- GIVEN `formatPrice(100, 'ARS')` is called
- THEN the result SHALL be a string containing the currency symbol or code ("ARS") and the numeral "1"
- AND the result SHALL NOT contain decimal digits (no comma or period followed by digits)

#### Scenario: formatPrice with existing test assertions passes

- GIVEN the `format-price.test.ts` test suite
- WHEN all tests are executed
- THEN `formatPrice(100, 'ARS')` SHALL produce a valid formatted string consistent with the existing test expectations (truthy, contains "1")

---

### Requirement: No Regressions

All existing tests in the Sonora monorepo MUST pass after the price change is applied to both the seed data and the test mock. The change is limited to the price value; no other behavior or logic is modified.

#### Scenario: Full test suite passes

- GIVEN the updated seed data (`price: 100`) and test mock (`price: 100`)
- WHEN the full test suite is executed
- THEN all tests SHALL pass (exit code 0)
- AND no new test failures SHALL be introduced

#### Scenario: No regressions in payment flow

- GIVEN the purchase flow for any experience
- WHEN a user completes a purchase
- THEN the flow SHALL behave identically to the pre-change behavior, including preference creation, webhook handling, and access validation
- AND the only difference SHALL be the `unit_price` value for `umepay-bosque`

---

### Requirement: No Unintended Side Effects

The price change MUST NOT alter any other experience's price, the `free` flag of any experience, or the payment/checkout infrastructure. No code beyond the two affected files (seed + test mock) SHALL be modified.

#### Scenario: Other experiences' prices unchanged

- GIVEN any experience in the seed data other than `umepay-bosque`
- WHEN its price is read
- THEN it SHALL match the pre-change value

#### Scenario: Payment infrastructure unchanged

- GIVEN the Mercado Pago integration code
- WHEN inspected
- THEN no changes SHALL be present in any payment provider, preference creation, webhook handling, or access validation logic

---

## Non-Functional Requirements

### Performance

- **No measurable performance impact.** The change is a single integer value in seed data and a test mock. No new computations, API calls, database queries, or rendering cycles are introduced.
- The existing `formatPrice` function's performance characteristics are unchanged.
- The Mercado Pago API call for preference creation is identical in structure.

### Security

- **No changes to authentication, authorization, or access control.** The `free` flag remains `false`, and the purchase flow is unchanged. The experience continues to require a completed purchase for access.
- No new secrets, tokens, or credentials are introduced.
- No changes to webhook signature validation, HMAC verification, or payment provider construction.

### Compatibility

- **No API contract changes.** The API response shape for experience data is unchanged — only the `price` field value differs.
- **No mobile app contract changes.** The `Experience` type is unchanged; only the data value differs.
- The `@sonora/shared` package exports are unchanged.
- The `formatPrice` function signature and behavior are unchanged.
- Database schema is unchanged — the `price` column in the `experiences` table already supports any integer value.

---

## Constraints

1. **Production database MUST be updated manually.** There is no database migration script for this change. The user SHALL execute a manual SQL `UPDATE` statement on the production database to set `price = 100` for the `umepay-bosque` experience row.

2. **No migration script** — the change is a single data value, and a full migration would be disproportionate to the scope.

3. **Seed data and production data are separate concerns.** The seed file serves development and test environments. The production DB is updated independently by the user.

4. **The `free` flag SHALL remain `false`.** This experience must go through the full Mercado Pago Checkout Pro flow, including fee calculation, regardless of the symbolic price.

---

## Dependencies

- **None.** This change has no dependencies on other in-flight changes. It is an independent data-only change affecting two files with no structural or behavioral modifications to the codebase.

---

## Mercado Pago Commission Analysis

This section documents the fee structure for Mercado Pago Checkout Pro (Argentina, 2026 rates) as applied to the new 1 ARS transaction price. This information is documented here by explicit user request and is informational — it does not constitute a functional requirement.

### Fee Breakdown

| Component                              | Rate                                         | On 1 ARS                |
| -------------------------------------- | -------------------------------------------- | ----------------------- |
| Credit card (immediate settlement) fee | 6.29%–6.49% + IVA (~7.85% effective)         | ~0.08 ARS               |
| Debit card (immediate settlement) fee  | 3.25%–3.49% + IVA (~4.22% effective)         | ~0.04 ARS               |
| Dinero en cuenta (MP wallet)           | Exact rate not documented — see caveat below | Unknown                 |
| Fixed fee per transaction              | ~6 ARS (consistent across multiple sources)  | 6 ARS                   |
| IVA (21%) on fixed fee                 | ~1.26 ARS                                    | 1.26 ARS                |
| **Total estimated fee (credit card)**  |                                              | **~7.33 ARS**           |
| **Net seller receipt (credit card)**   |                                              | **~−6.33 ARS per sale** |

### Source and Caveats

- **Research date:** 2026-07-19
- **Sources consulted:**
  - coordenadacero.com.ar — third-party comparison
  - talo.com.ar — third-party comparison
  - woosync.io — third-party comparison
- **Official MP documentation gap:** Mercado Pago's official help pages blocked automated access during research (bot detection). The rates above are aggregated from third-party comparison sites and may not reflect MP's exact current pricing.
- **Dinero en cuenta (MP wallet) rate:** Not found in the third-party sources consulted. It is likely lower than card rates but is documented here as unknown.
- **Net-negative per transaction:** Each sale at 1 ARS costs approximately 6–7 ARS in fees. This is an accepted cost by design.
- **Provider switching:** The `DEFAULT_PAYMENT_PROVIDER` environment variable controls which payment provider is used. If MP fees become a concern, switching providers for this experience would be a separate change.

---

## Risk: Inferred Domain Boundary

The proposal has no explicit `Capabilities` section. The domain _Experience Pricing_ was inferred from the affected areas listed in the proposal (seed data price, test mock price, MP unit_price, price display). If implementation reveals additional domains or requirements not covered by this specification, those must be spec'd before proceeding.
