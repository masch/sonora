# Mobile API Security Hardening — Technical Design

**Change:** `sec-api-mobile-security-hardening`
**Slice:** First (Device ID validation, P0 guard fix, Rate limiting, CORS updates)
**Status:** Draft

---

## 1. Module Structure

### 1.1 File Inventory

| File                                          | Action       | Role                                                                                                                  |
| --------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/middleware/device-id.ts`        | **Modified** | Add validation block before SHA-256 hashing                                                                           |
| `apps/api/src/middleware/rate-limit-guard.ts` | **Created**  | New KV-backed rate limit middleware                                                                                   |
| `apps/api/src/middleware/problem-details.ts`  | **Modified** | Add `INVALID_DEVICE_ID`, `RATE_LIMIT_EXCEEDED`, `HTTP.TOO_MANY_REQUESTS`                                              |
| `apps/api/src/middleware/cors.ts`             | **Modified** | Add `X-Signature`, `X-Timestamp`, `X-Nonce` to `DEFAULT_HEADERS`; add `Retry-After` to `EXPOSED_HEADERS`              |
| `apps/api/src/routes/payments.ts`             | **Modified** | Add `deviceIdGuard()` + `rateLimit()` to `POST /payments/create`; add `rateLimit()` to `POST /experiences/:id/access` |
| `apps/api/src/routes/experiences.ts`          | **Modified** | Add `rateLimit()` to `GET /experiences/`                                                                              |
| `apps/api/src/index.ts`                       | **Modified** | Add `RATE_LIMIT_STORE?: KVNamespace` to `Env` interface                                                               |
| `apps/api/wrangler.toml`                      | **Modified** | Add `[[kv_namespaces]]` for `RATE_LIMIT_STORE`                                                                        |
| `apps/api/wrangler.staging.toml`              | **Modified** | Add `[[kv_namespaces]]` for `RATE_LIMIT_STORE`                                                                        |

### 1.2 Module Responsibilities and Exports

```
device-id.ts
  - hashDeviceId(deviceId: string): Promise<string>   // unchanged
  - injectDeviceId(): MiddlewareHandler                 // modified: adds validation
  - INVALID_DEVICE_ID_REGEX                             // internal: UUID v4 pattern

rate-limit-guard.ts
  - rateLimit(config: RateLimitConfig): MiddlewareHandler
  - RateLimitConfig (interface)
  - buildRateLimitKey(prefix, deviceId, windowStart)   // internal helper
  - DEFAULT_RATE_LIMITS (exported constants)

problem-details.ts
  - ERRORS.INVALID_DEVICE_ID      // added to ERRORS_4XX
  - ERRORS.RATE_LIMIT_EXCEEDED    // added to ERRORS_4XX
  - HTTP.TOO_MANY_REQUESTS = 429  // added to HTTP

cors.ts
  - configureCors(): MiddlewareHandler  // modified DEFAULT_HEADERS + EXPOSED_HEADERS

index.ts (Env interface)
  - RATE_LIMIT_STORE?: KVNamespace     // added
  - RATE_LIMITING_ENABLED?: string     // 'false' = global kill switch for emergencies
```

### 1.3 Dependency Graph

```
problem-details.ts  ←── device-id.ts  (INVALID_DEVICE_ID constant)
problem-details.ts  ←── rate-limit-guard.ts  (RATE_LIMIT_EXCEEDED constant)
problem-details.ts  ←── device-id-guard.ts  (DEVICE_ID_REQUIRED — unchanged)
index.ts (Env)      ←── rate-limit-guard.ts  (RATE_LIMIT_STORE binding)
rate-limit-guard.ts ←── routes/payments.ts  (rateLimit middleware)
rate-limit-guard.ts ←── routes/experiences.ts  (rateLimit middleware)
device-id-guard.ts  ←── routes/payments.ts  (deviceIdGuard — unchanged, new placement)
```

No circular dependencies. `device-id.ts` imports from `problem-details.ts` now (for `INVALID_DEVICE_ID` constant and `c.json()`).

---

## 2. Middleware Design

### 2.1 Modified `injectDeviceId()`

**Signature unchanged** — still `injectDeviceId(): MiddlewareHandler`. Validation is added as a gate **before** the hashing step.

**Validation order** (first match wins — `return` short-circuits):

```
1. Header missing (undefined)        → pass through, no deviceId set, await next()
2. Empty string ""                    → return 400 INVALID_DEVICE_ID
3. Whitespace-only /^\s+$/           → return 400 INVALID_DEVICE_ID
4. Length > 256 characters            → return 400 INVALID_DEVICE_ID
5. Empty or exceeds 256 chars   → return 400 INVALID_DEVICE_ID
6. Valid UUID v4                      → SHA-256 hash, set c.set('deviceId', hashed), await next()
```

**Why `c.json()` instead of `problem()`:** The `injectDeviceId()` middleware is mounted globally via `app.use('*', injectDeviceId())`. Although `problem(c, err)` would work (it's a pure function calling `c.json()`), using `c.json()` directly avoids importing the `problem` helper into the device-id module and makes the rejection explicit at the point of return — the middleware has no route context, so the simplest possible rejection path is preferred.

```typescript
// device-id.ts — validation block pseudocode
if (!rawDeviceId) {
  await next();
  return;
}
if (rawDeviceId === '') {
  return c.json({ code: 'INVALID_DEVICE_ID', detail: '...', status: 400 }, 400);
}
if (/^\s+$/.test(rawDeviceId)) {
  return c.json({ code: 'INVALID_DEVICE_ID', detail: '...', status: 400 }, 400);
}
if (rawDeviceId.length > 256) {
  return c.json({ code: 'INVALID_DEVICE_ID', detail: '...', status: 400 }, 400);
}
if (!UUID_V4_REGEX.test(rawDeviceId)) {
  return c.json({ code: 'INVALID_DEVICE_ID', detail: '...', status: 400 }, 400);
}
// Valid — proceed with hashing
const hashed = await hashDeviceId(rawDeviceId);
c.set('deviceId', hashed);
await next();
```

**UUID v4 regex** (exact, case-insensitive):

```
/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
```

### 2.2 `rate-limit-guard.ts` Design

**Two-tier configuration:** global defaults + per-endpoint optional overrides. Every field in the per-endpoint config is optional — if omitted, the global default applies.

**Global defaults (env var kill switch + code fallback):**

```typescript
interface RateLimitingGlobals {
  enabled: boolean; // global kill switch, default: true
  defaultLimit: number; // default: 30
  defaultWindowSeconds: number; // default: 60
}
```

The middleware reads global config from env var `RATE_LIMITING_ENABLED` (set to `'false'` in Cloudflare dashboard to disable globally, no deploy needed) and code defaults for limit/window.

**Per-endpoint config (all fields optional — only override what you need):**

```typescript
export interface RateLimitConfig {
  limit?: number; // override defaultLimit per endpoint
  windowSeconds?: number; // override defaultWindowSeconds per endpoint
  enabled?: boolean; // disable per-endpoint (e.g., public routes)
  keyPrefix?: string; // route identifier for isolated counters
}
```

**Resolution order (highest priority first):**

```
1. c.env.RATE_LIMITING_ENABLED === 'false'  → disabled (global kill switch)
2. No KV binding                              → pass through (dev local)
3. config.enabled === false                    → endpoint-specific disable
4. config.limit ?? global.defaultLimit          → effective limit
5. config.windowSeconds ?? global.defaultWindowSeconds  → effective window
```

**Exports:**

```typescript
export const rateLimit = (config?: RateLimitConfig): MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}>;

// Usage examples:
// rateLimit()                                    → global defaults (30 req / 60s)
// rateLimit({})                                  → same, global defaults
// rateLimit({ limit: 5 })                        → override limit, rest global
// rateLimit({ limit: 10, windowSeconds: 30 })    → full override
// rateLimit({ enabled: false })                  → endpoint without rate limit
```

**Per-route named constants (recommended for readability):**

```typescript
export const RATE_LIMIT_DEFAULTS = {
  PAYMENTS_CREATE: { limit: 10, windowSeconds: 60, keyPrefix: 'payments:create' },
  EXPERIENCES_ACCESS: { limit: 20, windowSeconds: 60, keyPrefix: 'experiences:access' },
  EXPERIENCES_LIST: { limit: 30, windowSeconds: 60, keyPrefix: 'experiences:list' },
} as const;
```

**Internal helper:**

```typescript
function buildRateLimitKey(prefix: string, deviceId: string, windowStart: number): string {
  return `rate-limit:${prefix}:${deviceId}:${windowStart}`;
}
```

**Algorithm (middleware body):**

```
1. Resolve global enabled from c.env.RATE_LIMITING_ENABLED
2. If disabled globally → pass through
3. If no KV binding → pass through (dev local)
4. Resolve effective config: enabled ?? true, limit ?? global.defaultLimit, windowSeconds ?? global.defaultWindowSeconds
5. If effective.enabled === false → pass through (endpoint-specific)
6. Resolve deviceId from c.var.deviceId || 'anon'
7. Calculate windowStart = Math.floor(now/1000 / windowSeconds) * windowSeconds
8. Build KV key via buildRateLimitKey()
9. Try:
   a. GET key from KV → parse count (default 0)
   b. Compute remaining = max(0, limit - count)
   c. Set response headers:
      - X-RateLimit-Limit: String(limit)
      - X-RateLimit-Remaining: String(remaining)
      - X-RateLimit-Reset: String(windowStart + windowSeconds)
   d. If count >= limit:
      - Set Retry-After: String(resetTime - nowInSeconds)
      - Return 429 with RATE_LIMIT_EXCEEDED body
   e. Increment: PUT String(count + 1) with expirationTtl = windowSeconds + 5
   f. await next()
10. Catch KV error:
    - Log: "Rate limit KV error — failing closed"
    - Return 429 with RATE_LIMIT_EXCEEDED body
```

**KV interaction pattern:** Get-then-put (not atomic). This means under extreme concurrent requests, the counter can undercount by a small amount. This is acceptable for rate limiting — the worst case is a few extra requests slip through during a burst, which Cloudflare WAF (coarse IP-based layer) already covers. We prefer this over introducing a coordinator or accepting the latency of a distributed lock.

**KV unavailability strategy:**

| Scenario                           | Behavior                        | Rationale                                                                                  |
| ---------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------ |
| `RATE_LIMIT_STORE` binding missing | Pass through (no rate limiting) | Local dev without KV; safe because dev traffic is negligible                               |
| `KV.get()` throws                  | Fail closed → 429               | KV is infrastructure; if it's down, degraded mode is safer than allowing unlimited traffic |
| `KV.put()` throws                  | Fail closed → 429               | Counter not updated, but limit was already checked; closed is the conservative path        |

**Response body on 429 (RFC 7807 style):**

```json
{
  "code": "RATE_LIMIT_EXCEEDED",
  "detail": "Too many requests. Please try again later.",
  "status": 429
}
```

KV error variant detail: `"Service temporarily unavailable. Please try again later."`

---

## 3. Route Changes

### 3.1 POST /payments/create

**Current chain:**

```
paymentsGuard() [use *] → dbGuard() → zValidator('json', ...) → handler
```

**New chain:**

```
paymentsGuard() [use *] → dbGuard() → deviceIdGuard() → rateLimit(PAYMENTS_CREATE) → zValidator('json', ...) → handler
```

**Why this order:** `deviceIdGuard()` must run before `rateLimit()` because the rate limiter uses `c.var.deviceId` as the counter key. `rateLimit()` runs before Zod validation to reject early without parsing the body on rate-limited requests.

```typescript
paymentsRouter.post(
  '/create',
  dbGuard(),
  deviceIdGuard(),
  rateLimit(RATE_LIMIT_DEFAULTS.PAYMENTS_CREATE),
  zValidator('json', CreatePaymentBodySchema, validationHook),
  async (c) => {
    /* handler — unchanged */
  },
);
```

### 3.2 GET /experiences/

**Current chain:**

```
dbGuard() → deviceIdGuard() → jwtGuard() → handler
```

**New chain:**

```
dbGuard() → deviceIdGuard() → jwtGuard() → rateLimit(EXPERIENCES_LIST) → handler
```

**Why after `jwtGuard()`:** `jwtGuard()` sets `c.var.jwtSecret` and `c.var.audioLinkExpirySeconds` needed by the handler. The rate limiter does not depend on these, but placing it after keeps the ordering convention consistent: auth → rate limiting → handler.

### 3.3 POST /experiences/:id/access (on paymentsRouter)

**Current chain:**

```
paymentsGuard() [use *] → dbGuard() → deviceIdGuard() → zValidator('param', ...) → zValidator('json', ...) → handler
```

**New chain:**

```
paymentsGuard() [use *] → dbGuard() → deviceIdGuard() → rateLimit(EXPERIENCES_ACCESS) → zValidator('param', ...) → zValidator('json', ...) → handler
```

### 3.4 POST /payments/create — rateLimit (already covered in 3.1, listed here for completeness)

---

## 4. KV Design

### 4.1 Key Construction

```typescript
function buildRateLimitKey(prefix: string, deviceId: string, windowStart: number): string {
  return `rate-limit:${prefix}:${deviceId}:${windowStart}`;
}
```

**Example keys:**

```
rate-limit:payments:create:anon:1719878400
rate-limit:payments:create:a1b2c3d4e5f6...:1719878400
rate-limit:experiences:list:a1b2c3d4e5f6...:1719878400
```

**`windowStart` calculation:**

```typescript
const windowStart = Math.floor(Date.now() / 1000 / config.windowSeconds) * config.windowSeconds;
```

This produces the Unix timestamp of the window boundary. For a 60s window at T=0, windows are `[0, 60), [60, 120), ...`.

### 4.2 TTL

`config.windowSeconds + 5` — the extra 5 seconds accounts for:

- Clock skew between Workers and KV (KV uses its own clock for TTL expiry)
- The gap between TTL expiry and the next request that would create a new entry

Without the buffer, a key could expire just before the window ends, resetting the counter early for a client whose clock is slightly ahead.

### 4.3 KV Binding

Wrangler config (both `wrangler.toml` and `wrangler.staging.toml`):

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT_STORE"
id = "<namespace-id>"
```

The namespace must be created beforehand:

```
npx wrangler kv:namespace create "RATE_LIMIT_STORE"  # production
npx wrangler kv:namespace create "RATE_LIMIT_STORE" --env staging  # staging
```

**Env interface:**

```typescript
export interface Env {
  // ... existing fields ...
  RATE_LIMIT_STORE?: KVNamespace;
  RATE_LIMITING_ENABLED?: string; // 'false' = global kill switch
}
```

Both marked optional so local dev without bindings doesn't crash. The middleware checks `RATE_LIMIT_STORE` presence and passes through if absent. `RATE_LIMITING_ENABLED` defaults to `'true'` — set to `'false'` in Cloudflare dashboard to disable all rate limiting globally without a deploy.

---

## 5. Error Design

### 5.1 `INVALID_DEVICE_ID`

| Property      | Value                                                 |
| ------------- | ----------------------------------------------------- |
| `code`        | `INVALID_DEVICE_ID`                                   |
| `detail`      | `"The X-Device-Id header contains an invalid value."` |
| `status`      | `400` (added as `HTTP.BAD_REQUEST`)                   |
| **Raised in** | `injectDeviceId()` middleware (device-id.ts)          |

**Trigger conditions:**

- Empty string (`""`)
- Whitespace-only (`/^\s+$/`)
- Length > 256 characters
- Empty or exceeds 256 characters

**Response body:**

```json
{
  "code": "INVALID_DEVICE_ID",
  "detail": "The X-Device-Id header contains an invalid value.",
  "status": 400
}
```

### 5.2 `RATE_LIMIT_EXCEEDED`

| Property      | Value                                          |
| ------------- | ---------------------------------------------- |
| `code`        | `RATE_LIMIT_EXCEEDED`                          |
| `detail`      | `"Too many requests. Please try again later."` |
| `status`      | `429` (added as `HTTP.TOO_MANY_REQUESTS`)      |
| `Retry-After` | Number of seconds until the window resets      |
| **Raised in** | `rateLimit()` middleware (rate-limit-guard.ts) |

**Response body:**

```json
{
  "code": "RATE_LIMIT_EXCEEDED",
  "detail": "Too many requests. Please try again later.",
  "status": 429
}
```

On KV error, detail changes to `"Service temporarily unavailable. Please try again later."`.

### 5.3 `DEVICE_ID_REQUIRED` (existing — unchanged)

| Property      | Value                                             |
| ------------- | ------------------------------------------------- |
| `code`        | `DEVICE_ID_REQUIRED`                              |
| `detail`      | `"The X-Device-Id header is required."`           |
| `status`      | `400`                                             |
| **Raised in** | `deviceIdGuard()` middleware (device-id-guard.ts) |

This is **only** triggered when `X-Device-Id` is entirely missing. Invalid values are caught earlier by `injectDeviceId()` with `INVALID_DEVICE_ID`.

---

## 6. Configuration Design

### 6.1 Rate Limit Defaults per Route

```typescript
// apps/api/src/middleware/rate-limit-guard.ts
export const RATE_LIMIT_DEFAULTS = {
  PAYMENTS_CREATE: { limit: 10, windowSeconds: 60, keyPrefix: 'payments:create' },
  EXPERIENCES_ACCESS: { limit: 20, windowSeconds: 60, keyPrefix: 'experiences:access' },
  EXPERIENCES_LIST: { limit: 30, windowSeconds: 60, keyPrefix: 'experiences:list' },
} as const;
```

| Route                          | Limit | Window | Key prefix           |
| ------------------------------ | ----- | ------ | -------------------- |
| `POST /payments/create`        | 10    | 60s    | `payments:create`    |
| `POST /experiences/:id/access` | 20    | 60s    | `experiences:access` |
| `GET /experiences/`            | 30    | 60s    | `experiences:list`   |

### 6.2 How Routes Configure Custom Limits

Routes pass their per-endpoint config to the middleware call. Every field is optional — only override what differs from global defaults:

```typescript
// Via named constant (recommended for clarity)
rateLimit(RATE_LIMIT_DEFAULTS.PAYMENTS_CREATE);

// Partial override — global defaults for anything not specified
rateLimit({ limit: 5 }); // 5 req / 60s (global window)
rateLimit({ limit: 10, windowSeconds: 30 }); // 10 req / 30s

// Endpoint without rate limiting
rateLimit({ enabled: false });

// Explicit empty config = global defaults
rateLimit({});

// No config = global defaults
rateLimit();
```

**Resolution chain (highest priority first):**

```
1. RATE_LIMITING_ENABLED env var = false   → disables EVERYTHING globally
2. Missing KV binding                       → pass through (dev local)
3. Per-endpoint config.enabled = false      → disables just this endpoint
4. Per-endpoint config.limit / windowSeconds → override global defaults
5. Global code defaults (30 req / 60s)      → fallback
```

The `keyPrefix` ensures counter isolation per route. Two routes with the same prefix would share a counter — but we intentionally use unique prefixes. The device ID dimension (`deviceId` or `anon`) is embedded in the key automatically by the middleware.

### 6.3 Wrangler KV Binding Configuration

```toml
# wrangler.toml and wrangler.staging.toml
[[kv_namespaces]]
binding = "RATE_LIMIT_STORE"
id = "<namespace-id>"
preview_id = "<preview-namespace-id>"  # optional, for wrangler dev
```

The `preview_id` is recommended but optional. When running `wrangler dev` without a preview namespace, the middleware sees `RATE_LIMIT_STORE` as undefined and passes through — this is acceptable for local development.

---

## 7. CORS Design

### 7.1 Headers to Add

```typescript
// Current DEFAULT_HEADERS (allowed request headers)
const DEFAULT_HEADERS = [
  'Content-Type',
  'Authorization',
  'Range',
  'Cache-Control',
  'Pragma',
  'X-Device-Id',
];

// New DEFAULT_HEADERS
const DEFAULT_HEADERS = [
  'Content-Type',
  'Authorization',
  'Range',
  'Cache-Control',
  'Pragma',
  'X-Device-Id',
  'X-Signature', // future HMAC request signature
  'X-Timestamp', // future HMAC timestamp
  'X-Nonce', // future HMAC nonce
  'Retry-After', // also allow as request header (harmless, expected in response)
];

// EXPOSED_HEADERS (response headers readable by client JS)
const EXPOSED_HEADERS = [
  'Content-Length',
  'Content-Range',
  'ETag',
  'x-audio-etag',
  'Retry-After', // ← ADD: enables client JS to read rate limit retry time
];
```

**Why `Retry-After` in both lists:**

- `allowHeaders` (`DEFAULT_HEADERS`): Allows the client to send `Retry-After` as a request header (harmless, prevents CORS errors if a client SDK ever sends it).
- `exposeHeaders` (`EXPOSED_HEADERS`): **Required** for the client to read the `Retry-After` response header from JS. Without this, browser fetch API hides it from the client.

`X-Signature`, `X-Timestamp`, `X-Nonce` are added in `DEFAULT_HEADERS` only (they are request headers the client will send for HMAC in future slices).

### 7.2 How to Test CORS Preflight

CORS preflight (OPTIONS request) can be tested with:

```typescript
// Integration test
const res = await app.request('/experiences/', {
  method: 'OPTIONS',
  headers: {
    Origin: 'https://example.com',
    'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'x-signature, x-timestamp, x-nonce, retry-after',
  },
});

expect(res.status).toBe(204); // or 200 depending on Hono cors behavior
expect(res.headers.get('Access-Control-Allow-Headers')).toMatch(/x-signature/i);
expect(res.headers.get('Access-Control-Allow-Headers')).toMatch(/x-timestamp/i);
expect(res.headers.get('Access-Control-Allow-Headers')).toMatch(/x-nonce/i);
expect(res.headers.get('Access-Control-Allow-Headers')).toMatch(/retry-after/i);
```

Manual test:

```bash
curl -X OPTIONS https://sonora-api.staging.workers.dev/experiences/ \
  -H "Origin: https://sonora.app" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: x-signature, x-timestamp, x-nonce, retry-after" \
  -I
```

Expect response headers:

```
access-control-allow-headers: Content-Type, Authorization, Range, Cache-Control, Pragma, X-Device-Id, X-Signature, X-Timestamp, X-Nonce, Retry-After
access-control-expose-headers: Content-Length, Content-Range, ETag, x-audio-etag, Retry-After
```

---

## 8. Error Handling Strategy

### 8.1 KV Failure → Fail Closed

| Scenario                           | Behavior                                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `KV.get()` throws                  | Return 429 `RATE_LIMIT_EXCEEDED` with `Retry-After: windowSeconds`                                         |
| `KV.put()` throws                  | Return 429 `RATE_LIMIT_EXCEEDED` (limit check already passed, but counter state is unknown — conservative) |
| `RATE_LIMIT_STORE` binding missing | Pass through (fail open) — only happens in local dev without `wrangler dev` pointing to a KV namespace     |

**Rationale for fail-closed on KV error in production:** The rate limit is a security control, not a UX feature. When the KV store is degraded, allowing unlimited requests is riskier than rejecting traffic until the store recovers. The 5xx fallback for missing binding (local dev) is a concession to developer experience — the dev environment has negligible traffic and no attacker pressure.

**Exception:** If the binding is missing entirely (not deployed, local dev), we pass through. This is not a failure state — it's a configuration state. Once deployed with the binding, any KV error is treated as a failure.

### 8.2 Invalid Device ID → Fail Closed

Always fail closed with 400 `INVALID_DEVICE_ID`. No degradation path for any validation failure:

| Validation                           | Response                                   |
| ------------------------------------ | ------------------------------------------ |
| Empty string                         | 400 INVALID_DEVICE_ID                      |
| Whitespace-only                      | 400 INVALID_DEVICE_ID                      |
| Length > 256                         | 400 INVALID_DEVICE_ID                      |
| Non-UUID format                      | 400 INVALID_DEVICE_ID                      |
| Missing header (on guarded routes)   | 400 DEVICE_ID_REQUIRED (via deviceIdGuard) |
| Missing header (on unguarded routes) | Pass through (deviceId remains unset)      |

### 8.3 Logging Strategy

**Rate limit hits** (server-side, via `@sonora/shared` logger):

```
[RATE_LIMIT] key={key} count={count} limit={limit} deviceId={deviceId} prefix={prefix}
```

- Level: `warn` (first offense in window), `error` (KV failure)
- Include: route, deviceId (truncated or hashed — already hashed by injectDeviceId), limit, current count
- Do NOT include: raw X-Device-Id value, client IP (not available in Workers without `cf-connecting-ip`)

**Validation failures:**

```
[INVALID_DEVICE_ID] reason={empty|whitespace|too_long|invalid_format}
```

- Level: `info` (expected client behavior for buggy or malicious clients)
- Never log the raw value of the X-Device-Id header (could contain PII or attack payloads)

**KV errors:**

```
[RATE_LIMIT] KV error — failing closed: {error.message}
```

- Level: `error`
- This should trigger an alert if sustained

---

## 9. Test Strategy

### 9.1 Unit Tests

**injectDeviceId validation (`device-id.test.ts`):**

| Test case              | Header value                                           | Expected                                       |
| ---------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| Missing header         | (undefined)                                            | `c.var.deviceId` is undefined, `next()` called |
| Empty string           | `""`                                                   | 400 response, `INVALID_DEVICE_ID` code         |
| Whitespace-only        | `"   "`                                                | 400 response, `INVALID_DEVICE_ID` code         |
| Length > 256           | (257-char string)                                      | 400 response, `INVALID_DEVICE_ID` code         |
| Non-UUID format        | `"not-a-uuid"`                                         | 400 response, `INVALID_DEVICE_ID` code         |
| Near-UUID format       | `"550e8400-e29b-41d4-a716-44665544000Z"` (invalid hex) | 400 response                                   |
| Valid UUID v4          | `"550e8400-e29b-41d4-a716-446655440000"`               | `c.var.deviceId` is a 64-char hex SHA-256 hash |
| UUID v4 with uppercase | `"550E8400-E29B-41D4-A716-446655440000"`               | Accepted (case-insensitive regex), hashed      |

**rateLimit guard (`rate-limit-guard.test.ts`):**

| Test case                   | Setup                                           | Expected                                               |
| --------------------------- | ----------------------------------------------- | ------------------------------------------------------ |
| Under limit                 | KV returns `"5"`, limit=10                      | `X-RateLimit-Remaining: 5`, calls `next()`             |
| At limit                    | KV returns `"10"`, limit=10                     | 429, `X-RateLimit-Remaining: 0`, `Retry-After` present |
| Over limit                  | KV returns `"15"`, limit=10                     | 429, `X-RateLimit-Remaining: 0`, `Retry-After` present |
| First request (no KV entry) | KV returns `null`, limit=10                     | `X-RateLimit-Remaining: 10`, calls `next()`            |
| KV unavailable              | `KV.get()` throws                               | 429, `Retry-After: <windowSeconds>`                    |
| No RATE_LIMIT_STORE         | binding missing in env                          | Pass through, calls `next()`                           |
| Different device IDs        | KV returns `"10"` for deviceA, null for deviceB | DeviceA: 429; DeviceB: passes through                  |
| Different routes            | Same device, different prefix                   | Independent counters, no cross-interference            |

**Rate limit header tests:**

| Response Header         | Present when             | Value                            |
| ----------------------- | ------------------------ | -------------------------------- |
| `X-RateLimit-Limit`     | Always (if KV available) | The configured limit             |
| `X-RateLimit-Remaining` | Always (if KV available) | `limit - count` before increment |
| `X-RateLimit-Reset`     | Always (if KV available) | Unix timestamp of window end     |
| `Retry-After`           | Only when 429            | Seconds until window reset       |

### 9.2 Integration Tests

Using Hono's test helper (`app.request()`):

**Request chain: inject + guard + rate limit on POST /payments/create:**

```typescript
// Valid request — full chain passes
const res = await app.request('/payments/create', {
  method: 'POST',
  headers: {
    'X-Device-Id': '550e8400-e29b-41d4-a716-446655440000',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ experienceId: '550e8400-e29b-41d4-a716-446655440000' }),
});

// Missing device ID — caught by deviceIdGuard
const res = await app.request('/payments/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ experienceId: '...' }),
});
expect(res.status).toBe(400);
expect(await res.json()).toMatchObject({ code: 'DEVICE_ID_REQUIRED' });
```

**Device ID validation on any route:**

```typescript
const res = await app.request('/experiences/', {
  headers: { 'X-Device-Id': '' },
});
expect(res.status).toBe(400);
expect(await res.json()).toMatchObject({ code: 'INVALID_DEVICE_ID' });
```

**Rate limiting on GET /experiences/:**

```typescript
// Send 31 requests — 30 should pass, 31st should 429
for (let i = 0; i < 30; i++) {
  const res = await app.request('/experiences/', {
    headers: { 'X-Device-Id': VALID_UUID },
  });
  expect(res.status).toBe(200); // or whatever experiences returns without DB
}
const res = await app.request('/experiences/', {
  headers: { 'X-Device-Id': VALID_UUID },
});
expect(res.status).toBe(429);
```

### 9.3 Mocking KV in Tests

Create a lightweight in-memory mock that implements the KV namespace operations used by the middleware:

```typescript
// test-utils.ts
class MockKVNamespace implements KVNamespace {
  private store = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() / 1000 > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: options?.expirationTtl ? Date.now() / 1000 + options.expirationTtl : Infinity,
    });
  }

  // For testing: inspect state
  _entries(): number {
    return this.store.size;
  }
  _clear(): void {
    this.store.clear();
  }
}

// Use in tests
const mockKv = new MockKVNamespace();
const app = createApp({
  RATE_LIMIT_STORE: mockKv,
} as Env);
```

The mock implements only `get` and `put` — the only KV methods used by the middleware. It supports `expirationTtl` for TTL-aware tests. A `_clear()` method resets state between tests.

For KV failure tests, inject a mock that throws:

```typescript
const brokenKv = {
  get: () => Promise.reject(new Error('KV unavailable')),
  put: () => Promise.reject(new Error('KV unavailable')),
};
```

### 9.4 CORS Preflight Test

```typescript
describe('CORS — new headers', () => {
  it('allows X-Signature, X-Timestamp, X-Nonce, Retry-After in preflight', async () => {
    const res = await app.request('/experiences/', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://sonora.app',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': [
          'x-signature',
          'x-timestamp',
          'x-nonce',
          'retry-after',
        ].join(', '),
      },
    });
    const allowHeaders = res.headers.get('Access-Control-Allow-Headers')?.toLowerCase() || '';
    expect(allowHeaders).toContain('x-signature');
    expect(allowHeaders).toContain('x-timestamp');
    expect(allowHeaders).toContain('x-nonce');
    expect(allowHeaders).toContain('retry-after');
  });

  it('exposes Retry-After response header', async () => {
    const res = await app.request('/experiences/', {
      method: 'OPTIONS',
      headers: { Origin: 'https://sonora.app', 'Access-Control-Request-Method': 'GET' },
    });
    const exposeHeaders = res.headers.get('Access-Control-Expose-Headers') || '';
    expect(exposeHeaders).toContain('Retry-After');
  });
});
```

---

## 10. Implementation Order

```
Step 1: Add error constants
  - problem-details.ts: add HTTP.TOO_MANY_REQUESTS, ERRORS.INVALID_DEVICE_ID, ERRORS.RATE_LIMIT_EXCEEDED
  (No dependencies, unblocks everything)

Step 2: Device ID validation
  - device-id.ts: add validation block before hashDeviceId(), import ERRORS
  - DeviceId middleware now rejects invalid IDs — safe to deploy alone (previously passed through)
  (Depends on: Step 1)

Step 3: CORS headers
  - cors.ts: add X-Signature, X-Timestamp, X-Nonce to DEFAULT_HEADERS; add Retry-After to EXPOSED_HEADERS
  (No dependencies, can be deployed independently)

Step 4: Rate limit guard
  - rate-limit-guard.ts: create full module with rateLimit(), buildRateLimitKey(), RATE_LIMIT_DEFAULTS
  (Depends on: Step 1)

Step 5: Env + wrangler configs
  - index.ts: add RATE_LIMIT_STORE?: KVNamespace and RATE_LIMITING_ENABLED?: string to Env
  - wrangler.toml + wrangler.staging.toml: add [[kv_namespaces]] for RATE_LIMIT_STORE
  - Requires: create KV namespaces via wrangler CLI
  (No code dependencies, but must be done before deployment of steps that use rate limiting)

Step 6: Route changes — POST /payments/create
  - payments.ts: add deviceIdGuard() + rateLimit() to POST /payments/create
  (Depends on: Steps 2, 4)

Step 7: Route changes — GET /experiences/
  - experiences.ts: add rateLimit() to GET /experiences/
  (Depends on: Step 4)

Step 8: Route changes — POST /experiences/:id/access
  - payments.ts: add rateLimit() to POST /experiences/:id/access
  (Depends on: Step 4)

Step 9: Tests
  - device-id tests: 6+ cases
  - rate-limit-guard tests: 8+ cases
  - CORS preflight tests: 2 cases
  - Integration tests: full chain on guarded routes
  (Depends on: Steps 2, 3, 4 — can start in parallel with Steps 6-8)

Step 10: Create KV namespaces + deploy
  - wrangler kv:namespace create "RATE_LIMIT_STORE"
  - wrangler kv:namespace create "RATE_LIMIT_STORE" --env staging
  - Insert namespace IDs into wrangler configs
  - Deploy to staging → test → deploy to production
```

**Deployment safety note:** Steps 1–3 can be deployed independently without any behavioral change (validation is purely additive — previously invalid headers were hashed without validation, now they're rejected, which is a behavior change but a backward-incompatible one we want). Step 4 (rate limit guard) has no effect until Step 5 (KV binding) is configured. Deploy Steps 1–3 → create KV namespaces → deploy Steps 4–8 together.

---

## Appendix A: Out-of-Scope (Deferred to Future Slices)

- HMAC request signing middleware (`hmac-guard.ts`) — needs mobile client coordination
- Client-side signing sidecar in mobile app
- IP-based rate limiting (handled by Cloudflare WAF)
- Dynamic rate limit adjustment (e.g., per-user tiers, surge pricing)
- Rate limit state sharing across edge locations (KV is global, so this already works)
- Device ID revocation/rotation

## Appendix B: Open Questions

1. **KV namespace creation:** Should the preview_id be added to wrangler.toml for `wrangler dev`? Recommendation: add it if the team uses `wrangler dev` with a remote KV namespace; otherwise the "missing binding → pass through" fallback is acceptable.

2. **Monitor P99 latency:** KV adds 10–30ms on guarded routes. Should we add a `X-RateLimit-Latency` header or just rely on `wrangler tail` + dashboard? Recommendation: start with dashboard monitoring, add a custom metric only if we see degradation.

3. **Rate limit counter reset at deployment:** Deploying a new version resets all counters (new isolate, new KV reads). Acceptable — it's a one-time burst, and Cloudflare WAF is still in place.
