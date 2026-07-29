# Exploration: Mobile API Security Hardening

## Summary

Current state analysis for 3 hardening areas: Device ID Validation, Rate Limiting, and HMAC Request Signing. The codebase has sound architecture patterns but exposes several gaps that these changes must address.

---

## 1. Device ID Validation

### Current State

`injectDeviceId()` at `apps/api/src/middleware/device-id.ts`:

```ts
const rawDeviceId = c.req.header('X-Device-Id');
if (rawDeviceId) {
  const hashed = await hashDeviceId(rawDeviceId);
  c.set('deviceId', hashed);
}
```

- **No input validation** before hashing: accepts any value, including empty string `""`, whitespace-only strings, extremely long strings, non-printable characters, or JSON injection payloads.
- `hashDeviceId()` uses Web Crypto `SHA-256` — correct algorithm, fine.
- The guard at `device-id-guard.ts` only checks for falsy (`!c.var.deviceId`), meaning `""` or whitespace-only values that produce a valid SHA-256 hash will pass through.

### Client-side Device ID Generation

**Native (`apps/mobile/src/services/device-service.ts`):**

- Android: `Application.getAndroidId()` — can return `null` (no Google Play Services)
- iOS: `Application.getIosIdForVendorAsync()` — returns `nil` if no vendor, or after app reinstall
- Fallback: persisted UUID via `expo-sqlite/kv-store`
- Worst-case fallback: hardcoded string `'fallback-device-id'`

**Web (`apps/mobile/src/services/device-service.web.ts`):**

- `localStorage`-backed UUID
- Worst-case fallback: `'fallback-web-device-id'`

**Client sends via:** `MobileApiClient.getAuthHeader()` at `apps/mobile/src/services/api-client.ts` — mandatory, throws if no device ID.

### Gaps & Risks

| Gap                                      | Severity | Impact                                                               |
| ---------------------------------------- | -------- | -------------------------------------------------------------------- |
| No format/type validation before SHA-256 | HIGH     | Empty string, `null`, or extremely long values get hashed and stored |
| Fallback IDs are not unique per device   | MEDIUM   | Multiple devices collide on `'fallback-device-id'`                   |
| No minimum/maximum length check          | MEDIUM   | SHA-256 of a 10MB payload wastes CPU cycles                          |
| No character set enforcement             | LOW      | Potential for injection in downstream logging/storage                |

### Recommendations

1. **Add validation middleware** (or inline in `injectDeviceId`):
   - Reject if empty string, whitespace-only, or exceeds `MAX_DEVICE_ID_LENGTH` (e.g., 1024 bytes)
   - Optionally validate UUID format (v4 or v5) since the client generates UUIDs
   - **Do NOT** silently drop invalid IDs → return 400 via `problem(c, ERRORS.INVALID_DEVICE_ID)`
2. **Add `INVALID_DEVICE_ID` error constant** to `problem-details.ts` (4xx)
3. **Update fallback behavior** in mobile device service: never expose hardcoded fallbacks to the API; generate a UUID as last resort.

---

## 2. Rate Limiting

### Current State

- **No rate limiting exists** anywhere in the codebase. Zero matches for `rate.limit` or `ratelimit`.
- `apps/api/src/index.ts` mounts all middleware globally via `app.use('*', ...)` — no per-route middleware concept except within individual routers.

### Sensitive Routes (need rate limiting)

| Route                          | File             | Device ID Guard?                    | Auth?                         | Risk Level                              |
| ------------------------------ | ---------------- | ----------------------------------- | ----------------------------- | --------------------------------------- |
| `POST /payments/create`        | `payments.ts`    | ❌ No device guard                  | `paymentsGuard()` (env setup) | **CRITICAL** — Creates purchase records |
| `POST /payments/webhook`       | `payments.ts`    | ❌ No device guard                  | MP signature validation       | **CRITICAL** — Payment state changes    |
| `POST /experiences/:id/access` | `payments.ts`    | ✅ `deviceIdGuard()`                | None beyond device            | HIGH — Access logging                   |
| `GET /experiences/`            | `experiences.ts` | ✅ `deviceIdGuard()` + `jwtGuard()` | JWT + device + DB             | HIGH — Expensive, joins across 3 tables |
| `GET /audio/stream`            | `audio.ts`       | ❌ (but client must send)           | `jwtGuard()` + device match   | HIGH — Streaming bandwidth cost         |
| `POST /feedback/*`             | `feedback.ts`    | ❌ (check)                          | Device + throttled by KV      | MEDIUM                                  |
| `POST /audio/upload`           | `audio.ts`       | ❌ No device guard                  | `adminAuthGuard()`            | LOW (admin-only)                        |

### Wrangler Configuration

- `wrangler.toml` and `wrangler.staging.toml` exist.
- `FEEDBACK_STORE` KV namespace is **commented out** in both — not created in production.
- No KV namespace exists yet for rate limiting.

### Existing KV Pattern (FEEDBACK_STORE)

- Defined as optional in `Env` interface: `FEEDBACK_STORE?: KVNamespace`
- Injected via `envGuard()` at `apps/api/src/middleware/env-guard.ts`: `c.set('feedbackStore', c.env?.FEEDBACK_STORE)`
- Used in feedback routes for idempotency (fast-path check before DB write, 30-day TTL)

### Recommendations

**Architecture: Hybrid approach**

- **Cloudflare WAF** → coarse IP-based rate limiting (config-level, no code change)
- **Hono middleware + KV** → per-device, per-route fine-grained limiting

**KV namespace:**

- **Create a new `RATE_LIMIT_STORE` KV namespace** — do NOT reuse `FEEDBACK_STORE` (different TTL/write patterns, rate-limiting is hot-path)
- Add to `wrangler.toml` and `wrangler.staging.toml`
- Add to `Env` interface in `index.ts`

**New middleware: `rate-limit-guard.ts`:**

- Follows existing guard pattern (`dbGuard`, `deviceIdGuard`, `privateBucketGuard`)
- Configurable: window (ms), max requests, key function (device ID, IP, or both)
- Uses `RATE_LIMIT_STORE.get()` / `.put()` with TTL matching the window
- Returns `429` with `Retry-After` header via `problem(c, ERRORS.RATE_LIMIT_EXCEEDED)`

**Route protection plan:**

- Global liberal rate limit on `app.use('*')` (e.g., 100 req/min per device)
- Strict limits per-route on sensitive endpoints via `rateLimitGuard({ window: 60_000, max: 10 })` for payments
- Audio streaming: limit by device ID + key to prevent token farming

**KV TTL considerations:**

- Rate limit windows: short TTL (1-60 seconds) — KV has eventual consistency, acceptable for rate limiting (over-count is safe)
- Use fixed-window algorithm (simpler, KV-friendly) rather than sliding window
- Key format: `ratelimit:{deviceId}:{route}:{windowStart}`

**CORS impact:** `X-RateLimit-*` headers should be added to exposed headers in `cors.ts` if used.

---

## 3. HMAC Request Signing

### Current State

- **No HMAC signing middleware exists** for API-to-server requests.
- **Existing HMAC pattern**: `apps/api/src/payments/signature.ts` validates MercadoPago webhook HMAC signatures using the official MP SDK. Uses `X-Signature` header with `ts=...,v1=...` format.
- The existing `timingSafeCompare()` in `admin-auth-guard.ts` uses SHA-256 hash comparison — this is a constant-time comparison utility that could be reused.

### Client-side (Mobile API Client)

`apps/mobile/src/services/api-client.ts`:

- Extends `BaseApiClient` from `@sonora/shared` (at `packages/shared/src/api/base-client.ts`)
- Currently only injects `X-Device-Id` via `getAuthHeader()`
- Uses `fetch()` under the hood
- `fetchWithDeviceId()` method for raw fetch with device ID

### BaseApiClient (`packages/shared/src/api/base-client.ts`)

- Provides `request<T>()` with caching, transforms, error handling
- `getAuthHeader()` is the extension point for adding auth headers
- Currently returns `Authorization: Bearer <token>` when `getAuthToken` is configured

### CORS Configuration (`apps/api/src/middleware/cors.ts`)

Current allowed headers:

```
'Content-Type', 'Authorization', 'Range', 'Cache-Control', 'Pragma', 'X-Device-Id'
```

HMAC will require additional headers like `X-Signature`, `X-Timestamp`, `X-Nonce`.

### Recommendations

**Server-side middleware: `hmac-guard.ts`:**

- New middleware following the guard pattern
- Validates: given `deviceId` + request body (or canonical request string) + timestamp + nonce
- Steps:
  1. Extract `X-Signature`, `X-Timestamp`, `X-Nonce` from headers
  2. Reject if timestamp is outside allowed window (e.g., ±5 min, same as MP pattern)
  3. Check replay via `RATE_LIMIT_STORE.get(nonce)` (use same KV namespace)
  4. Recompute HMAC using request body + device ID + timestamp + nonce + shared secret
  5. Constant-time compare using existing `timingSafeCompare()` or `crypto.subtle.timingSafeEqual`
- Returns `401` via `problem(c, ERRORS.HMAC_INVALID)`

**Shared secret management:**

- Per-device secret derived from `JWT_SECRET` + device-specific key? Or shared `HMAC_SECRET` env var?
- Recommendation: `HMAC_SECRET` env var, combined with `deviceId` in the signing material — this ties the signature to a specific device

**Client-side sidecar (`apps/mobile/src/services/hmac-signer.ts`):**

- New service that intercepts requests in `MobileApiClient`
- Signs each request with device ID, body, timestamp, nonce
- Extends `getAuthHeader()` or wraps the `request()` method
- Key derivation: shared secret stored securely (expo-secure-store or similar)

**CORS changes:**

- Add `X-Signature`, `X-Timestamp`, `X-Nonce` to `ALLOWED_HEADERS`
- Add `X-Signature` to `EXPOSED_HEADERS` if signature-related responses are needed

**Route scope for HMAC:**

- Start with payment and experience access routes (POST/PUT mutations)
- Audio streaming (GET) is less critical for HMAC since it has JWT + device binding
- Webhook routes (`/payments/webhook`) use MP's own signature — no change needed

---

## 4. App Wiring & Middleware Patterns

### Global Middleware Order (`index.ts`)

```
customLogger → configureCors → injectDb → injectDeviceId
```

Followed by route mounting. The `injectDeviceId` runs globally — every route has access to `c.var.deviceId` (hashed).

**Important:** for HMAC validation, the middleware must run **after** `injectDeviceId` (to access `deviceId`) but **before** route handlers:

```
customLogger → configureCors → injectDb → injectDeviceId → hmacGuard → rateLimitGuard
```

### Middleware Guard Pattern

All guards follow the same factory pattern:

```ts
export const guardName = (): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> => {
  return async (c, next) => {
    // validate
    if (!pass) return problem(c, ERRORS.SOME_ERROR);
    // optionally set context
    c.set('someVar', value);
    await next();
  };
};
```

Key patterns observed:

- `dbGuard` → checks `c.var.db`, returns `DB_NOT_AVAILABLE`
- `deviceIdGuard` → checks `c.var.deviceId`, returns `DEVICE_ID_REQUIRED`
- `privateBucketGuard` → checks binding, sets `c.var.privateBucket`
- `jwtGuard` → reads `c.env.JWT_SECRET`, sets `c.var.jwtSecret` + `c.var.audioLinkExpirySeconds`
- `paymentsGuard` → creates payment providers, sets them on context
- `envGuard` → sets environment + feedbackStore

New middleware should follow this exact pattern.

### Error Response Format

All errors use RFC 7807-style problem details:

```json
{ "code": "ERROR_CODE", "detail": "Human message", "status": 400 }
```

New error constants go into `problem-details.ts` under `ERRORS_4XX` (client errors) or `ERRORS_5XX` (server errors).

---

## 5. Route-Level Analysis

### `apps/api/src/routes/payments.ts`

- **Device ID usage:** Only `POST /experiences/:id/access` uses `deviceIdGuard()`. The `deviceId` is stored in `purchases.deviceId` during checkout creation (from `c.var.deviceId` set by global `injectDeviceId()`).
- **Gap:** `POST /payments/create` does NOT use `deviceIdGuard()` — it relies on the global injector setting `c.var.deviceId` silently. If the header is missing, `deviceId` will be `undefined` and still create a purchase.
- **Gap:** `POST /payments/webhook` has no device ID constraint (correct — it's MP-to-server).

### `apps/api/src/routes/audio.ts`

- **Device ID usage:** Not used via middleware on the route. Audio stream JWT validation manually checks `payload.deviceId === c.var.deviceId` inside the handler.
- **No `deviceIdGuard()`** on any audio route — authentication relies on JWT + manual device match.
- HMAC protection less critical here since JWT + device binding already protects streams.

### `apps/api/src/routes/experiences.ts`

- Uses `deviceIdGuard()` + `jwtGuard()` — one of the best-protected routes.
- Joins across 4 tables (experiences, waypoints, experienceAccesses, purchases) — expensive, a target for abuse.

---

## 6. KV/Binding Requirements

### New Binding: `RATE_LIMIT_STORE`

| Property             | Value                                                                 |
| -------------------- | --------------------------------------------------------------------- |
| Binding name         | `RATE_LIMIT_STORE`                                                    |
| Type                 | `kv_namespaces`                                                       |
| Purpose              | Rate limit counters + HMAC nonce replay protection                    |
| TTL range            | 1-60s (rate counts), 24h (nonce dedup)                                |
| Production namespace | Needs creation: `npx wrangler kv:namespace create "RATE_LIMIT_STORE"` |

Files to update:

- `apps/api/wrangler.toml`
- `apps/api/wrangler.staging.toml`
- `apps/api/src/index.ts` (`Env` interface)
- `apps/api/src/middleware/env-guard.ts` (optional, or new middleware reads directly)

### Existing `FEEDBACK_STORE`

- Currently commented out in both wrangler configs
- Not used in production
- Recommendation: leave as-is or create it separately — don't conflate with rate limiting

---

## 7. Test Coverage Assessment

### Existing Test Files

| Test File                                                   | Coverage                                              | Quality                                                                    |
| ----------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------- |
| `apps/api/src/__tests__/device-id.test.ts`                  | `hashDeviceId` (3 tests) + `injectDeviceId` (2 tests) | ✅ Good — covers basic hashing and header injection                        |
| `apps/api/src/__tests__/middleware/device-id-guard.test.ts` | Unit (4 tests) + Integration (2 tests)                | ✅ Excellent — covers missing, empty, present, RFC 7807 shape, integration |
| `apps/api/src/__tests__/payments.test.ts`                   | 1 test for device ID in purchase creation             | ⚠️ Only checks hashed value presence, no invalid format coverage           |
| `apps/api/src/__tests__/audio.test.ts`                      | Tests device ID mismatch scenario                     | ⚠️ Tests at handler level, not middleware                                  |
| `mobile/src/services/__tests__/api-client.test.ts`          | X-Device-Id enforcement (13+ tests)                   | ✅ Strong — covers all HTTP methods, missing ID, fetchWithDeviceId         |

### Test Gaps for Hardening

1. **Device ID validation**: No tests for empty string, whitespace-only, extremely long, or non-UUID formats
2. **Rate limiting**: No tests exist (greenfield)
3. **HMAC signing**: No middleware tests exist (greenfield)
4. **Payment route without device guard**: No test ensures `POST /payments/create` rejects missing device ID (currently it doesn't)

### Test Runner

Uses **Vitest** (detected from `import { describe, it, expect } from 'vitest'`).

---

## 8. Recommendations Summary

### Priority Order

1. **P0 — Device ID validation**: Quick win, low risk, closes a real vulnerability. Add format validation before hashing + add `INVALID_DEVICE_ID` error constant.
2. **P0 — DeviceGuard on payment create**: Add `deviceIdGuard()` to `POST /payments/create` route (currently missing).
3. **P1 — Rate limiting middleware**: Create KV namespace + middleware. Start with global per-device limit, then tighten per endpoint.
4. **P1 — HMAC request signing**: Build server middleware + client sidecar. Requires coordination between API and mobile teams.
5. **P2 — Fallback device IDs**: Fix mobile client to never send hardcoded fallback strings.

### Cross-cutting Concerns

- **Error constants**: Add `INVALID_DEVICE_ID` (422), `RATE_LIMIT_EXCEEDED` (429), `HMAC_INVALID` (401), `HMAC_EXPIRED` (401)
- **CORS headers**: Add `X-Signature`, `X-Timestamp`, `X-Nonce`, `Retry-After` to allowed headers
- **Monitoring**: Add metrics (`[METRIC:rate_limit_exceeded_total]`, `[METRIC:hmac_invalid_total]`) following existing pattern from payments (`[METRIC:invalid_signature_total]`)
- **Wrangler config**: Both `wrangler.toml` and `wrangler.staging.toml` need `RATE_LIMIT_STORE` KV binding
- **Env vars**: New `HMAC_SECRET` secret env var

### Key Files and Their Roles

| File                                             | Role                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| `apps/api/src/index.ts`                          | Global middleware wiring, Env/Variables types                         |
| `apps/api/src/middleware/device-id.ts`           | **INJECTOR** — reads X-Device-Id, SHA-256 hashes, sets c.var.deviceId |
| `apps/api/src/middleware/device-id-guard.ts`     | **GUARD** — rejects missing deviceId                                  |
| `apps/api/src/middleware/problem-details.ts`     | Error response format + error constant registry                       |
| `apps/api/src/middleware/cors.ts`                | CORS config — needs header additions                                  |
| `apps/api/src/middleware/db-guard.ts`            | Reference guard pattern                                               |
| `apps/api/src/middleware/jwt-guard.ts`           | Reference guard pattern (reads env, sets vars)                        |
| `apps/api/src/middleware/env-guard.ts`           | Env variable injection pattern                                        |
| `apps/api/src/payments/signature.ts`             | **REFERENCE** — existing HMAC signature validation                    |
| `apps/api/src/middleware/admin-auth-guard.ts`    | **REFERENCE** — timingSafeCompare utility for HMAC                    |
| `apps/api/wrangler.toml`                         | Production wrangler config — needs KV binding                         |
| `apps/api/wrangler.staging.toml`                 | Staging wrangler config — needs KV binding                            |
| `apps/mobile/src/services/api-client.ts`         | Mobile API client — sidecar target                                    |
| `apps/mobile/src/services/device-service.ts`     | Device ID generation (native)                                         |
| `apps/mobile/src/services/device-service.web.ts` | Device ID generation (web)                                            |
| `packages/shared/src/api/base-client.ts`         | Base API client — extension point for HMAC                            |
| `apps/api/src/routes/payments.ts`                | Payment routes — need device guard + rate limiting                    |
| `apps/api/src/routes/audio.ts`                   | Audio streaming routes — need rate limiting                           |
| `apps/api/src/routes/experiences.ts`             | Experience listing — well-protected, needs rate limiting              |
