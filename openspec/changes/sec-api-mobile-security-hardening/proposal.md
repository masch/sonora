# Mobile API Security Hardening — Proposal

**Change:** `sec-api-mobile-security-hardening`
**Issue:** [#351 — Mobile API Security Hardening](https://github.com/masch/sonora/issues/351)
**Status:** Proposal

---

## 1. Executive Summary

The Sonora mobile API currently trusts every request it receives. There is no validation on the device identity header before it gets hashed, no rate limiting on any endpoint, and no cryptographic proof that a request came from a legitimate mobile client. An attacker can replay, forge, or flood requests with minimal effort.

This proposal covers three hardening layers — **Device ID validation**, **Rate limiting**, and **HMAC request signing** — that together raise the cost of abuse from zero to significant. The work also fixes a critical gap: `POST /payments/create` bypasses the device identity guard entirely, meaning a purchase can be initiated without any device identifier.

The changes are additive, backward-compatible for well-behaved clients, and follow the existing middleware patterns already established in the codebase (RFC 7807 errors, guard composition, KV injection).

---

## 2. Goals & Non-goals

### Goals

- **Device ID validation:** reject malformed `X-Device-Id` headers (empty, whitespace-only, >256 chars, non-UUID format) before SHA-256 hashing, with a new `INVALID_DEVICE_ID` error constant
- **Device ID guard coverage:** add `deviceIdGuard()` to `POST /payments/create` (P0 fix)
- **Rate limiting:** prevent abuse on sensitive endpoints via a hybrid approach — Cloudflare WAF rules for coarse IP-based blocking + Hono middleware backed by a dedicated `RATE_LIMIT_STORE` KV namespace for per-device, per-route rate limiting
- **HMAC request signing:** server-side verification middleware that validates `X-Signature`, `X-Timestamp`, and `X-Nonce` headers against a shared `HMAC_SECRET`; client-side signing sidecar in `MobileApiClient` that signs every outgoing request
- **KV and env setup:** create the `RATE_LIMIT_STORE` KV namespace in both wrangler configs (production + staging), add `HMAC_SECRET` env var, extend CORS to allow the new headers, and add the `Env`/`Variables` bindings
- **Replay protection:** use a nonce store (KV, TTL-scoped) to prevent replay of captured signed requests within the validity window

### Non-goals

- Replacing or modifying the existing MercadoPago webhook signature validation (`payments/signature.ts`) — it stays as-is
- Adding API key authentication for mobile clients (HMAC signing addresses this differently)
- IP-based allow/deny lists (left to Cloudflare WAF layer, not app middleware)
- Client certificate pinning or TLS-level hardening
- Refactoring the KV namespace for feedback (`FEEDBACK_STORE`) — the new `RATE_LIMIT_STORE` is a separate namespace
- Changing the mobile app's device ID generation strategy (the `'fallback-device-id'` case is a separate concern, tracked as P2)

---

## 3. Current State

### Device ID: zero validation before hashing

`injectDeviceId()` at `apps/api/src/middleware/device-id.ts` reads the `X-Device-Id` header and passes it directly to `hashDeviceId()` — empty strings, whitespace-only values, and headers over 1 KB all get hashed into a deterministic value that passes the guard.

`deviceIdGuard()` at `apps/api/src/middleware/device-id-guard.ts` rejects only a missing/falsy `c.var.deviceId` — but a valid hash of `""` is truthy and passes.

The mobile client (`device-service.ts`) generates UUIDs natively (Android ID / iOS vendor ID → persisted UUID) but falls back to `'fallback-device-id'` on error — a hardcoded string that would hash to the same value on every device.

### Critical gap: POST /payments/create has no device guard

The payments router at `apps/api/src/routes/payments.ts` applies `paymentsGuard()` at the top level, and `dbGuard()` on individual routes, but **`POST /payments/create` does not apply `deviceIdGuard()` before handling the request**. The handler reads `c.var.deviceId` for the purchase record, but if no `X-Device-Id` was sent, `c.var.deviceId` is `undefined` and gets inserted as `null`. A purchase can be initiated with zero device identity.

Other routes already use device guard correctly: `GET /experiences/` applies it, and `POST /experiences/:id/access` applies it.

### Rate limiting: nonexistent

No route has rate limiting of any kind. An attacker can hit any endpoint arbitrarily. Sensitive targets include:

- `POST /payments/create` — initiates payment flows
- `POST /payments/webhook` — payment provider notifications
- `POST /experiences/:id/access` — writes to the access log
- `GET /experiences/` — expensive 4-table join with JWT verification
- `GET /audio/stream` — bandwidth-costly streaming endpoint

The `FEEDBACK_STORE` KV namespace exists in the `Env` interface but is commented out in both wrangler configs — not created in any environment.

### HMAC signing: server-side only (MercadoPago webhooks)

The only HMAC verification exists at `apps/api/src/payments/signature.ts`, which validates MercadoPago webhook signatures using the official MP SDK. There is no general-purpose HMAC middleware for API-to-server requests.

`timingSafeCompare()` exists at `apps/api/src/middleware/admin-auth-guard.ts` and can be reused for HMAC comparison.

The mobile client (`MobileApiClient`) injects only `X-Device-Id` via `getAuthHeader()`. No signing of any kind.

CORS currently allows `Content-Type, Authorization, Range, Cache-Control, Pragma, X-Device-Id` — the new HMAC headers (`X-Signature`, `X-Timestamp`, `X-Nonce`) are not listed.

---

## 4. Proposed Solution

### 4.1 Device ID Validation

**Where:** `apps/api/src/middleware/device-id.ts` — modify `injectDeviceId()`

Add validation before hashing:

| Check                      | Rejection                                                            |
| -------------------------- | -------------------------------------------------------------------- |
| Header missing             | passes through (no change — `deviceIdGuard` handles this downstream) |
| Empty string `""`          | `INVALID_DEVICE_ID` — 400                                            |
| Whitespace-only            | `INVALID_DEVICE_ID` — 400                                            |
| Length > 256 chars         | `INVALID_DEVICE_ID` — 400                                            |
| Not a valid UUID v4 format | `INVALID_DEVICE_ID` — 400                                            |

**Rationale for UUID validation:** The mobile client always generates UUIDs (via `generateUuid()` or native platform IDs). Any non-UUID value is either a bug, a misconfigured client, or an attacker sending arbitrary data. Rejecting at the middleware level catches all three early, before the value enters business logic or the database.

**New error constant:** Add `INVALID_DEVICE_ID` to `ERRORS_4XX` in `problem-details.ts`.

### 4.2 Device Guard on Payment Create

**Where:** `apps/api/src/routes/payments.ts` — add `deviceIdGuard()` to the `POST /payments/create` handler chain, between `paymentsGuard()` and the route handler.

The guard already exists and is proven on other routes. This is a one-line addition.

### 4.3 Rate Limiting — Hybrid Approach

**Why hybrid:** Cloudflare WAF handles volumetric DDoS and IP-based abuse at the edge, before traffic reaches the worker. But IP-based limiting alone is insufficient for mobile apps where multiple devices share a NAT. The middleware layer adds per-device, per-route limits using KV for state.

**Cloudflare WAF (coarse, IP-based):**
Configuration outside this code change (Cloudflare dashboard / WAF API), but documented here for context:

- `POST /payments/*` — 20 req/min per IP
- `POST /experiences/*/access` — 30 req/min per IP
- `GET /experiences/` — 60 req/min per IP
- `GET /audio/stream` — 30 req/min per IP
- All other routes — 120 req/min per IP

**Hono + KV middleware (fine-grained, per-device):**

New file: `apps/api/src/middleware/rate-limit-guard.ts`

- Follows existing guard pattern (`MiddlewareHandler` returning middleware)
- Reads `c.var.deviceId` as the identity key
- Uses `RATE_LIMIT_STORE` KV namespace for state
- Sliding window counter per `{route}:{deviceId}` — KV key, TTL-scoped
- Exposes a `RateLimitConfig` type mapping route patterns to limits
- Returns RFC 7807 `RATE_LIMIT_EXCEEDED` error (429) with `Retry-After` header
- Configurable limit per route via a config object

**Initial limits (default values, overridable via config):**

| Route                          | Limit       | Window     |
| ------------------------------ | ----------- | ---------- |
| `POST /payments/create`        | 10 requests | 60 seconds |
| `POST /experiences/:id/access` | 20 requests | 60 seconds |
| `GET /experiences/`            | 30 requests | 60 seconds |
| `GET /audio/stream`            | 20 requests | 60 seconds |
| `POST /payments/webhook`       | 20 requests | 60 seconds |

**KV namespace:** Create `RATE_LIMIT_STORE` in both wrangler configs. The `Env` interface gets the binding, and `Variables` gets optional access.

**Usage in routes:** Apply per-route via middleware composition:

```ts
paymentsRouter.post(
  '/create',
  dbGuard(),
  deviceIdGuard(),
  rateLimit({ limit: 10, window: 60 }),
  handler,
);
```

### 4.4 HMAC Request Signing

**Server middleware:** New file `apps/api/src/middleware/hmac-guard.ts`

- Checks for `X-Signature`, `X-Timestamp`, `X-Nonce` headers
- Reads `HMAC_SECRET` from env bindings
- Validates timestamp freshness (max 5-minute drift, configurable)
- Reconstructs signing material from method + path + body + timestamp + nonce
- Computes HMAC-SHA256 and compares via `timingSafeCompare()` (reuse from `admin-auth-guard.ts`)
- Checks nonce against `RATE_LIMIT_STORE` KV for replay detection (TTL = max drift window)
- Returns `INVALID_SIGNATURE` (401) or `DUPLICATE_REQUEST` (409) for replayed nonces

**Client sidecar:** Modify `MobileApiClient.getAuthHeader()` (or add a `signRequest()` wrapper in the `request()` method)

- Shares `HMAC_SECRET` — embedded at build time or fetched at app init
- Signs every outgoing request to the API
- Uses the same HMAC-SHA256 algorithm
- Generates a UUID v4 nonce per request, includes `X-Nonce` header
- Includes `X-Timestamp` as ISO 8601 or Unix epoch seconds
- Computes `X-Signature` over: `{method}:{path}:{body}:{timestamp}:{nonce}`
- For non-POST requests: body defaults to empty string

**CORS updates:** Add `X-Signature`, `X-Timestamp`, `X-Nonce`, and `Retry-After` to the allowed headers list in `cors.ts`.

**Security model:** The HMAC secret is embedded in the mobile app binary. This is not a defense against a motivated reverse engineer — it is a defense against large-scale automated abuse and replay of captured traffic. The nonce + timestamp combination prevents replay of any captured request beyond the freshness window, even if the secret is unknown.

---

## 5. Key Design Decisions

### Why UUID validation for device IDs?

The mobile client always sends UUIDs. Every platform path in `device-service.ts` produces a UUID (Android ID, iOS vendor ID, or generated UUID). If a non-UUID value arrives at the server, it is either:

1. An attacker sending arbitrary data to probe the system
2. A bug in a future client version
3. A misconfigured or tampered client

All three cases should be rejected early. UUID validation is a simple regex check (`/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`) with negligible CPU cost compared to SHA-256 hashing.

The hardcoded `'fallback-device-id'` string in the current mobile client will fail this check — that's intentional. It forces the device ID generation to produce a real UUID or fail closed. The P2 task of fixing the fallback behavior is separate from the P0 validation work.

### Why hybrid rate limiting (Cloudflare + Hono/KV)?

Cloudflare WAF rules are excellent for volumetric protection at the edge: they block the bad traffic before it reaches the worker, saving CPU time and KV operations. But they work at IP granularity, which is too coarse for mobile clients behind NAT (multiple real users sharing one IP).

The Hono/KV middleware adds a second dimension — device identity — which is far more precise. A single IP sending 100 requests from 10 different device IDs (10 req/device) would not trigger IP-level blocking but would be caught by the per-device limit.

KV is the right store because it's already part of the Workers platform, requires zero infrastructure, and the TTL-based key expiration handles cleanup automatically. The tradeoff is eventual consistency (KV reads may be stale within a few seconds), which is acceptable for rate limiting — a few extra requests during a KV propagation delay are not a security concern.

### Why HMAC instead of an API key?

An API key sent in a header is trivially captured and replayed by any attacker on the same network. HMAC signing ties each request to its content, timestamp, and a unique nonce — replay of a captured request fails the timestamp window or the nonce uniqueness check. Tampering with the request body invalidates the signature.

This is a defense-in-depth layer. It does not replace TLS (which protects against network-level interception) but protects against compromised downstream infrastructure, logging systems that capture request data, and replay attacks where TLS is stripped at a proxy.

### Why a separate KV namespace for rate limiting?

The existing `FEEDBACK_STORE` is commented out in both wrangler configs and was never created. It serves a different purpose (feedback idempotency) and may or may not be implemented later. Mixing rate limit state with a potential future feature would create unclear failure modes and make it harder to reason about KV operation costs.

A dedicated `RATE_LIMIT_STORE` keeps concerns separated, makes monitoring clearer, and allows independent TTL and sizing configuration.

---

## 6. Risks & Mitigations

| Risk                                                                                 | Likelihood | Impact | Mitigation                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------ | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **UUID validation breaks legitimate clients** with non-UUID device IDs               | Low        | Medium | Validation is inside `injectDeviceId()` which runs on every route — but the only known client is the Sonora mobile app which sends UUIDs. The `'fallback-device-id'` string in the client code will break — this is intentional (fail-closed) and will be addressed by the P2 fix. |
| **Rate limiting KV operations increase latency** on hot paths                        | Medium     | Medium | KV reads are ~5-15ms in the same region. Each guarded request adds one KV get (counter read) and one KV put (counter increment). For high-traffic routes like `GET /experiences/`, this could add 10-30ms. Mitigation: start with conservative limits and monitor P99 latency.     |
| **Rate limiting KV eventual consistency** allows burst bypass                        | Low        | Low    | KV is eventually consistent within seconds. A fast attacker could burst a few extra requests during propagation. This is acceptable — the rate limiter is a deterrent, not a cryptographic gate. Cloudflare WAF covers the volumetric layer.                                       |
| **HMAC secret leakage** from mobile app binary                                       | Medium     | High   | Embedding the secret in the mobile app is the weakest link. Mitigation: (1) nonce + timestamp prevent replay beyond the freshness window, (2) secret can be rotated without app update if fetched at runtime, (3) consider per-device derived keys in a future iteration.          |
| **HMAC nonce KV grows unbounded**                                                    | Low        | Low    | KV keys have a 5-minute TTL matching the max timestamp drift. Old keys are auto-expired. At 10 req/s, KV holds ~3,000 keys simultaneously — negligible cost.                                                                                                                       |
| **Breaking mobile clients that send custom device IDs** (dev builds, test harnesses) | Medium     | Low    | Dev builds and tests should already send UUIDs. If they don't, the `INVALID_DEVICE_ID` error makes the failure mode explicit and diagnosable.                                                                                                                                      |
| **HMAC breaks existing API clients** (admin panel, scripts)                          | Medium     | Low    | HMAC middleware is opt-in per route, not global. Only routes explicitly guarded require signatures. The admin panel and internal scripts can be excluded or migrated later.                                                                                                        |

---

## 7. First Slice

The minimal viable implementation — the smallest set of changes that delivers meaningful security improvement:

1. **Device ID validation** — modify `injectDeviceId()` to validate format before hashing, add `INVALID_DEVICE_ID` error constant
2. **deviceIdGuard on payments/create** — one-line addition to `POST /payments/create` route chain
3. **Rate limiting middleware** — `rate-limit-guard.ts`, `RATE_LIMIT_STORE` KV config, env binding, applied to top-3 sensitive routes (`/payments/create`, `/experiences/`, `/experiences/:id/access`)
4. **CORS update** — add `X-Signature`, `X-Timestamp`, `X-Nonce`, `Retry-After` headers

**Deliberately deferred from first slice:**

- HMAC server middleware (`hmac-guard.ts`) — requires coordination with mobile app release cycle and thorough testing of the signing/verification round-trip
- HMAC client sidecar in `MobileApiClient` — depends on server middleware being ready and a mobile app release
- Audio streaming rate limiting — the streaming endpoint uses R2 with range requests; rate limiting there has different latency sensitivity and needs separate consideration
- P2 fallback device ID fix — a separate concern, not a security boundary

---

## 8. Future Considerations

- **HMAC full rollout:** Server middleware + client sidecar in a subsequent phase, after the mobile app has been updated to support signing
- **Per-device derived HMAC keys:** Instead of a shared secret, derive a key from `HMAC_SECRET + deviceId` — gives each device a unique signing key, limits blast radius of secret extraction
- **Rate limit tiers per user/plan:** Different limits for free vs. paid users, stored in `RATE_LIMIT_STORE` with user-tier metadata
- **Rate limit headers in responses:** Return `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` for client-side backoff
- **Admin/staging HMAC bypass:** An env var to disable HMAC verification in staging or for internal tools
- **Metrics and monitoring:** Track rate limit hits, HMAC failures, and validation errors as metrics (could be Cloudflare Workers Analytics or a custom logger)
- **Audit log for rate limit breaches:** Log repeated rate limit violations per device for manual review

---

## 9. Technical Architecture

### Middleware execution order (per request)

```
customLogger → configureCors → injectDb → injectDeviceId [with validation]
                                               ↓
                                    deviceIdGuard → rate limit guard → handler
                                               ↓
                                    (future) hmacGuard → handler
```

For routes that need HMAC:

```
injectDeviceId → deviceIdGuard → hmacGuard → handler
```

Rate limiting wraps handler chains per route:

```
paymentsRouter.post('/create', dbGuard(), deviceIdGuard(), rateLimit({...}), hmacGuard, handler)
```

### New files

| File                                          | Purpose                                    |
| --------------------------------------------- | ------------------------------------------ |
| `apps/api/src/middleware/rate-limit-guard.ts` | Rate limiting middleware using KV          |
| `apps/api/src/middleware/hmac-guard.ts`       | HMAC signature verification (future slice) |
| `apps/mobile/src/services/signing-service.ts` | HMAC signing sidecar (future slice)        |

### Modified files

| File                                          | Change                                |
| --------------------------------------------- | ------------------------------------- |
| `apps/api/src/middleware/device-id.ts`        | Add UUID validation before hashing    |
| `apps/api/src/middleware/problem-details.ts`  | Add `INVALID_DEVICE_ID` constant      |
| `apps/api/src/middleware/cors.ts`             | Add allowed headers                   |
| `apps/api/src/middleware/rate-limit-guard.ts` | New file                              |
| `apps/api/src/routes/payments.ts`             | Add `deviceIdGuard()` to `/create`    |
| `apps/api/src/index.ts`                       | Add RATE_LIMIT_STORE to Env/Variables |
| `apps/api/wrangler.toml`                      | RATE_LIMIT_STORE KV binding           |
| `apps/api/wrangler.staging.toml`              | RATE_LIMIT_STORE KV binding           |

### KV key schema

Rate limit counter keys:

```
rate-limit:{route}:{deviceId}:{window-start}
```

Nonce store keys (HMAC replay protection, future):

```
nonce:{nonce-value}
```

TTL = 300 seconds (matching max timestamp drift).

---

## 10. Success Criteria

1. Empty `X-Device-Id` header returns `400 INVALID_DEVICE_ID` instead of being hashed
2. Non-UUID `X-Device-Id` values return `400 INVALID_DEVICE_ID`
3. `POST /payments/create` with missing `X-Device-Id` returns `400 DEVICE_ID_REQUIRED`
4. Exceeding rate limit on a guarded route returns `429 RATE_LIMIT_EXCEEDED` with `Retry-After`
5. Existing passing test suite continues to pass (no regressions)
6. CORS preflight responses include `X-Signature`, `X-Timestamp`, `X-Nonce`, `Retry-After` in `Access-Control-Allow-Headers`
7. KV namespace `RATE_LIMIT_STORE` is created in both wrangler configs and accessible at runtime
