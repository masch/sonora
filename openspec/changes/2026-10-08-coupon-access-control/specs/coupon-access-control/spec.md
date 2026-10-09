# Spec: Coupon Access Control

## Requirements

### REQ-1: Admin Coupon Creation

- Endpoint: `POST /payments/experiences/:id/coupons`
- Auth: Admin Bearer token via `adminAuthGuard`.
- Guards: `dbGuard()`, `hmacGuard()`.
- Request body:
  - `email`: valid email string.
  - `expiresAt`: valid ISO datetime string (mandatory).
  - `notes`: non-empty string (mandatory).
  - `maxDownloads`: positive integer >= 1 (defaults to 1).
- Behavior:
  - Normalizes email and computes HMAC-SHA256 hex string.
  - Masks email for admin overview.
  - Inserts into `experience_coupons`.
  - Returns `201 Created` with coupon metadata.

### REQ-2: User Redemption & Access Validation

- Endpoint: `GET /payments/experiences/:id/purchased?email=:email`
- Guards: `dbGuard()`, `deviceIdGuard()`, `platformGuard()`, `hmacGuard()`.
- Behavior:
  - Checks regular purchases first (`status: 'approved'`).
  - If no regular purchase, looks up coupon by `email_hash`.
  - Rejects with `403 COUPON_EXPIRED` if `expiresAt <= now`.
  - Grants access idempotently with `200 { purchased: true }` if device already redeemed.
  - Rejects with `403 COUPON_LIMIT_REACHED` if `usedDownloads >= maxDownloads`.
  - Increments `usedDownloads` and inserts into `experience_coupon_redemptions`.
  - Returns `200 { purchased: true }`.

### REQ-3: Streaming Catalog Audio Authorization

- Endpoint: `GET /experiences`
- Headers: `X-Device-Id`, `X-Device-Platform`.
- Behavior:
  - Paid experiences authorize `audioUrl` if a record exists in `experience_coupon_redemptions` for `deviceId`.
