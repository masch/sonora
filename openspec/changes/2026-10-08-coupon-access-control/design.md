# Design: Coupon-Based Access Control (Viaje Grupal)

## Architecture Overview

The system replaces arbitrary email-based free downloads with a structured, audited coupon model.

```
[Mobile Client]
     │
     │ 1. GET /payments/experiences/:id/purchased?email=...
     │    Headers: X-Device-Id, X-Device-Platform
     ▼
[Hono API Router]
     │
     ├──> dbGuard()          -> Ensures DB connectivity
     ├──> deviceIdGuard()    -> Validates UUID format
     ├──> platformGuard()    -> Enforces platform enum ('ios' | 'android' | 'web')
     └──> hmacGuard()        -> Verifies c.env.HMAC_SECRET (500 HMAC_SECRET_MISSING)
             │
             ▼
      Hash email via HMAC-SHA256 (email_hash)
             │
             ├──> Regular Purchase Found? -> { purchased: true, purchase: {...} }
             │
             └──> Coupon Found?
                     ├──> Expired? -> 403 COUPON_EXPIRED
                     ├──> Existing Device Redemption? -> 200 { purchased: true } (idempotent)
                     ├──> Quota Reached? -> 403 COUPON_LIMIT_REACHED
                     └──> New Redemption:
                             ├── Atomic increment usedDownloads
                             ├── Insert experienceCouponRedemptions (deviceId, platform)
                             └── Return 200 { purchased: true }
```

## Security & PII Protection

1. **Cryptographic Key Isolation**:
   - `JWT_SECRET` must NOT be reused for hashing emails. Rotating authentication keys would invalidate all persisted email hashes in the database.
   - `HMAC_SECRET` is independent and guarded by `hmacGuard()`.
2. **Deterministic Lookup without Plaintext PII**:
   - `email_hash`: `HMAC-SHA256(normalize(email), HMAC_SECRET)` stored as hex.
   - `email_masked`: e.g. `j***e@domain.com` stored for administrative human inspection without exposing raw PII.
3. **Platform & Device Identity**:
   - `platformEnum('platform').notNull()` in `experience_coupon_redemptions` ensures valid platform telemetry.
   - Unique composite constraint on `(coupon_id, device_id)` guarantees idempotency.

## Error Model (RFC 7807 Problem Details)

- `500 HMAC_SECRET_MISSING`: Backend cryptographic environment secret not provisioned.
- `403 COUPON_EXPIRED`: Current timestamp exceeds `expiresAt`.
- `403 COUPON_LIMIT_REACHED`: `usedDownloads >= maxDownloads`.
- `404 COUPON_NOT_FOUND`: No active coupon matches `(experienceId, emailHash)`.
