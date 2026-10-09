# Proposal: coupon-access-control (Viaje Grupal)

## Intent

Replace the legacy unconstrained free download email mechanism (`free_downloads` / `freeGrant`) with a cryptographic, quota-enforced coupon access control system ("Viaje Grupal") protecting user PII and guaranteeing platform integrity.

## Capabilities

| Who                 | Can do                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| Admin               | Generates coupons with mandatory expiration date, notes, and max download quota for paid experiences.  |
| User (Viaje Grupal) | Redeems group coupon by email, unlocking paid audio on authorized devices up to the quota limit.       |
| System (API)        | Validates redemptions with HMAC-SHA256, enforces quotas idempotently, and fails closed without secret. |

## Scope

**In scope**:

- **Database (`apps/api/src/db/schema.ts`)**:
  - `experience_coupons`: `email_hash` (HMAC), `email_masked`, `expires_at` (NOT NULL), `notes` (NOT NULL), `max_downloads`, `used_downloads`.
  - `experience_coupon_redemptions`: `coupon_id`, `experience_id`, `device_id`, `platform` (NOT NULL enum), `redeemed_at`.
- **Security & Middleware (`apps/api/src/middleware/hmac-guard.ts`)**:
  - Fail-closed `hmacGuard()` rejecting with 500 `HMAC_SECRET_MISSING` when `HMAC_SECRET` is unset.
  - No fallback to `JWT_SECRET` to prevent cryptographic key reuse.
- **Routes (`apps/api/src/routes/payments.ts`, `experiences.ts`)**:
  - `POST /payments/experiences/:id/coupons`: Protected by `adminAuthGuard`, `dbGuard`, `hmacGuard`.
  - `GET /payments/experiences/:id/purchased`: Protected by `dbGuard`, `deviceIdGuard`, `platformGuard`, `hmacGuard`. Returns clean `{ purchased: true }`.
  - `GET /experiences`: Authorizes audio stream URL when a valid coupon redemption exists for the device.
- **Mobile Integration (`apps/mobile/src/hooks/use-purchase.ts`, `payment-prompt.tsx`)**:
  - `usePurchase.restore()` error mapping for `COUPON_EXPIRED`, `COUPON_LIMIT_REACHED`, `COUPON_NOT_FOUND`.
  - Refined Viaje Grupal restore UI.

**Out of scope**:

- Web payment checkout gateway integrations (Mercado Pago flow remains untouched).
- Dynamic coupon transfer across different emails.

## Approach

1. **Deterministic Hashing**: Use HMAC-SHA256 with dedicated `HMAC_SECRET` to look up coupons by email without storing raw email plaintext in `experience_coupons`.
2. **Fail-Closed Gatekeeper**: Dedicated middleware ensures requests cannot proceed if cryptographic salt/secret is unconfigured.
3. **Strict Device Quota**: Track redemptions in `experience_coupon_redemptions` per `(coupon_id, device_id)` pair, incrementing `used_downloads` atomically only on first redemption by a new device.
4. **Clean API Contract**: Keep client response minimal (`{ purchased: true }`), auditing telemetry directly in the database.

## Success Criteria

- [x] Database migration generated and applied cleanly with array constraint syntax.
- [x] Dedicated `hmacGuard` fails closed with 500 problem details when `HMAC_SECRET` is missing.
- [x] 100% path coverage functional E2E tests covering complete coupon lifecycle.
- [x] Client restore handles coupon errors gracefully without crashing.
- [x] `make test` and `make lint` pass with 0 errors and 0 warnings.
