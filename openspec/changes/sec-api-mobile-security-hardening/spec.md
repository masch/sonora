# Mobile API Security Hardening — Specification

**Change:** `sec-api-mobile-security-hardening`
**Issue:** [#351 — Mobile API Security Hardening](https://github.com/masch/sonora/issues/351)
**Slice:** First (Device ID validation, P0 guard fix, Rate limiting, CORS updates)
**Status:** Specification

---

## 1. Functional Requirements

### 1.1 Device ID Validation

The system MUST validate `X-Device-Id` header values BEFORE SHA-256 hashing in `injectDeviceId()`.

#### Validation rules (applied in order, first match wins)

| Priority | Condition                                    | Action                                           | Error Code          |
| -------- | -------------------------------------------- | ------------------------------------------------ | ------------------- |
| 1        | Header is missing (`undefined`)              | Pass through — deviceId remains unset downstream | —                   |
| 2        | Value is empty string `""`                   | Reject with `INVALID_DEVICE_ID`                  | `INVALID_DEVICE_ID` |
| 3        | Value is whitespace-only (matches `/^\s+$/`) | Reject with `INVALID_DEVICE_ID`                  | `INVALID_DEVICE_ID` |
| 4        | Value length > 256 characters                | Reject with `INVALID_DEVICE_ID`                  | `INVALID_DEVICE_ID` |
| 5        | Value does not match UUID v4 format          | Reject with `INVALID_DEVICE_ID`                  | `INVALID_DEVICE_ID` |
| 6        | Value is a valid UUID v4                     | Hash via SHA-256, set `c.var.deviceId`           | —                   |

#### UUID v4 regex

```
/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
```

The regex MUST be compiled once (module-level constant), not re-compiled per request.

#### Scenario: Valid UUID v4 is hashed normally

- GIVEN a request with `X-Device-Id: 550e8400-e29b-41d4-a716-446655440000`
- WHEN `injectDeviceId()` runs
- THEN the header passes all validation checks
- AND `c.var.deviceId` is set to the SHA-256 hex digest of the raw value

#### Scenario: Empty header passes through for downstream guard

- GIVEN a request with no `X-Device-Id` header
- WHEN `injectDeviceId()` runs
- THEN the middleware does NOT produce an `INVALID_DEVICE_ID` error
- AND `c.var.deviceId` remains unset (`undefined`)
- AND a downstream `deviceIdGuard()` on the route will reject with `DEVICE_ID_REQUIRED`

#### Scenario: Empty string is rejected

- GIVEN a request with `X-Device-Id:` (empty string)
- WHEN `injectDeviceId()` runs
- THEN the response is a `400 BAD_REQUEST` with `INVALID_DEVICE_ID`
- AND `c.var.deviceId` is NOT set

#### Scenario: Whitespace-only is rejected

- GIVEN a request with `X-Device-Id: "   "` (three spaces)
- WHEN `injectDeviceId()` runs
- THEN the response is a `400 BAD_REQUEST` with `INVALID_DEVICE_ID`

#### Scenario: Long header value is rejected

- GIVEN a request with `X-Device-Id` value of 257 characters
- WHEN `injectDeviceId()` runs
- THEN the response is a `400 BAD_REQUEST` with `INVALID_DEVICE_ID`

#### Scenario: Non-UUID value is rejected

- GIVEN a request with `X-Device-Id: fallback-device-id`
- WHEN `injectDeviceId()` runs
- THEN the response is a `400 BAD_REQUEST` with `INVALID_DEVICE_ID`

#### Scenario: UUID v1 format is rejected

- GIVEN a request with `X-Device-Id: 550e8400-e29b-11d4-a716-446655440000` (UUID v1, version field = `1`)
- WHEN `injectDeviceId()` runs
- THEN the response is a `400 BAD_REQUEST` with `INVALID_DEVICE_ID`

---

### 1.2 Device Guard on POST /payments/create

The system MUST add `deviceIdGuard()` to the `POST /payments/create` handler chain, between `dbGuard()` and the Zod validation middleware.

#### Scenario: Payment create with valid device ID succeeds

- GIVEN a request to `POST /payments/create` with a valid `X-Device-Id` header and a valid payment body
- WHEN the request is processed
- THEN `deviceIdGuard()` passes
- AND the handler creates a purchase record with `c.var.deviceId` stored in the `deviceId` column

#### Scenario: Payment create without device ID is rejected

- GIVEN a request to `POST /payments/create` with no `X-Device-Id` header
- WHEN the request is processed
- THEN `deviceIdGuard()` rejects with `400 DEVICE_ID_REQUIRED`
- AND `deviceId` is stored as `null` in the purchase record

#### Middleware chain for POST /payments/create (after this change)

```
paymentsGuard() → dbGuard() → deviceIdGuard() → zValidator(...) → handler
```

---

### 1.3 Rate Limiting

#### Routes, limits, and windows

| Route                          | Limit | Window     | KV Key Pattern                                                      |
| ------------------------------ | ----- | ---------- | ------------------------------------------------------------------- |
| `POST /payments/create`        | 10    | 60 seconds | `rate-limit:POST-/payments/create:{deviceId}:{windowStart}`         |
| `POST /experiences/:id/access` | 20    | 60 seconds | `rate-limit:POST-/experiences/{id}/access:{deviceId}:{windowStart}` |
| `GET /experiences/`            | 30    | 60 seconds | `rate-limit:GET-/experiences/:{deviceId}:{windowStart}`             |

#### Rate limit middleware behavior

1. Read the current counter from `RATE_LIMIT_STORE` KV using the computed key.
2. If the key is absent, the count is 0.
3. If the count ≥ limit, reject with `429 RATE_LIMIT_EXCEEDED` and `Retry-After` header (seconds until window expiry).
4. If the count < limit, increment (KV `put` with `expirationTtl` = window seconds), and continue to handler.
5. If the KV operation fails (timeout, error), the middleware MUST fail CLOSED: reject with `429 RATE_LIMIT_EXCEEDED` and log a server-side warning.

#### Response headers

Every rate-limited route MUST include these headers on success (set by middleware when passing through):

- `X-RateLimit-Limit`: the maximum requests per window (number)
- `X-RateLimit-Remaining`: remaining requests in the window (number)
- `X-RateLimit-Reset`: Unix timestamp (seconds) when the window resets

On rejection (429), the response MUST include:

- `Retry-After`: seconds until the window resets (integer, rounded up)

#### Error response for rate limit exceeded

```json
{
  "code": "RATE_LIMIT_EXCEEDED",
  "detail": "Too many requests. Please try again later.",
  "status": 429
}
```

#### Scenario: Request within limit passes

- GIVEN a device identity that has made 5 requests to `POST /payments/create` in the current 60-second window
- WHEN the 6th request arrives
- THEN the rate limit middleware increments the counter to 6
- AND passes the request through to the handler

#### Scenario: Request exceeding limit is rejected

- GIVEN a device identity that has made 10 requests to `POST /payments/create` in the current 60-second window
- WHEN the 11th request arrives
- THEN the rate limit middleware returns a `429` response with `RATE_LIMIT_EXCEEDED`
- AND includes a `Retry-After` header
- AND does NOT call the handler

#### Scenario: Different routes have independent counters

- GIVEN a device identity that has exhausted the limit on `GET /experiences/`
- WHEN the same device sends a request to `POST /payments/create`
- THEN the rate limit for `POST /payments/create` is evaluated independently
- AND the request is allowed if within that route's limit

#### Scenario: KV failure causes fail-closed rejection

- GIVEN the `RATE_LIMIT_STORE` KV namespace is unreachable or throws an error
- WHEN a request arrives on a rate-limited route
- THEN the middleware logs the KV error server-side
- AND returns a `429` response with `RATE_LIMIT_EXCEEDED`
- AND includes a `Retry-After` header
- AND does NOT call the handler

---

### 1.4 CORS Updates

The `Access-Control-Allow-Headers` response on CORS preflight (OPTIONS) and actual requests MUST include these additional headers:

- `X-Signature`
- `X-Timestamp`
- `X-Nonce`
- `Retry-After`

#### Scenario: CORS preflight includes new headers

- GIVEN an OPTIONS request from an allowed origin
- WHEN `configureCors()` processes the preflight
- THEN the `Access-Control-Allow-Headers` response header includes `X-Signature`, `X-Timestamp`, `X-Nonce`, and `Retry-After` alongside existing headers

#### Scenario: CORS configuration is environment-aware

- GIVEN the `ALLOWED_HEADERS` env var is set
- WHEN `configureCors()` builds the CORS middleware
- THEN the env-var headers override the defaults
- AND the new headers (`X-Signature`, `X-Timestamp`, `X-Nonce`, `Retry-After`) MUST be present in the env-var value for production deployments

---

## 2. Non-Functional Requirements

### 2.1 Latency Impact

| Operation                               | Target Latency      | Measurement              |
| --------------------------------------- | ------------------- | ------------------------ |
| Device ID validation (regex check)      | < 1 µs (negligible) | inline, no I/O           |
| Device ID SHA-256 hashing               | < 1 ms              | crypto.subtle.digest     |
| Rate limit KV read (counter get)        | < 15 ms             | KV get in same region    |
| Rate limit KV write (counter increment) | < 15 ms             | KV put with TTL          |
| Total added latency per guarded request | < 30 ms P99         | monitor after deployment |

### 2.2 Error Response Format

All security-related errors MUST follow RFC 7807 via the existing `problem()` function in `problem-details.ts`:

```typescript
interface ProblemDetails {
  code: string; // Machine-readable error code
  detail: string; // Human-readable description
  status: number; // HTTP status code
  errors?: Array<{ path: string; message: string }>; // Optional field-level errors
}
```

New error constants obey existing conventions:

- 4xx errors (security rejection): specific `detail` that is safe for the client
- 4xx errors: detailed, client-safe messaging
- 5xx errors: generic detail only (no internal leakage)

### 2.3 Backward Compatibility

- Well-behaved clients sending valid UUID v4 `X-Device-Id` headers observe NO behavioral change
- Clients sending `X-Device-Id` with missing, empty, or invalid values that previously succeeded will now get `400 INVALID_DEVICE_ID` — this is INTENTIONAL fail-closed behavior
- Existing passing test suite MUST continue to pass (no regressions)
- All changes are additive; no existing middleware or route handler contracts are modified except `injectDeviceId()`

---

## 3. Middleware Specifications

### 3.1 Modified `injectDeviceId()` — Validation Order

**File:** `apps/api/src/middleware/device-id.ts`

#### Validation sequence (after reading header, before hashing)

```
1. Read raw X-Device-Id header value
2. IF header is undefined (missing) → skip, await next(), return
3. IF value is empty string "" → return problem(c, ERRORS.INVALID_DEVICE_ID)
4. IF value matches /^\s+$/ → return problem(c, ERRORS.INVALID_DEVICE_ID)
5. IF value.length > 256 → return problem(c, ERRORS.INVALID_DEVICE_ID)
6. IF value does not match UUID v4 regex → return problem(c, ERRORS.INVALID_DEVICE_ID)
7. hashDeviceId(value) → c.set('deviceId', hashed) → await next()
```

#### Rejection logic

- All rejections MUST use the existing `problem()` helper with `ERRORS.INVALID_DEVICE_ID`
- On rejection, the middleware MUST call `return` and NOT call `next()`
- The middleware MUST NOT modify `c.var.deviceId` on rejection

#### Exported shape

```typescript
export const injectDeviceId = (): MiddlewareHandler<{ Bindings: Env; Variables: Variables }>
```

No changes to the function signature, only internal validation logic.

### 3.2 New `rate-limit-guard.ts`

**File:** `apps/api/src/middleware/rate-limit-guard.ts`

#### Exported type

```typescript
interface RateLimitConfig {
  limit: number; // Maximum requests allowed
  window: number; // Window in seconds (e.g., 60)
  routePattern: string; // Canonical route pattern for KV key (e.g., "POST-/payments/create")
}
```

#### Exported function

```typescript
export const rateLimit = (config: RateLimitConfig): MiddlewareHandler<{ Bindings: Env; Variables: Variables }>
```

#### KV interaction

1. Construct key: `rate-limit:{config.routePattern}:{c.var.deviceId}:{currentWindowStart}`
   - `currentWindowStart` = `Math.floor(Date.now() / 1000 / config.window) * config.window`
   - Uses the `c.var.deviceId` set by `injectDeviceId()`
   - If `c.var.deviceId` is undefined (no header sent), the rate limiter MUST still operate: use `"anon"` as the device identity key component
2. KV `get` the key, parse as integer (or default to 0)
3. If value >= config.limit:
   - Compute `Retry-After` = `(currentWindowStart + config.window) - Math.floor(Date.now() / 1000)`
   - Return `problem(c, ERRORS.RATE_LIMIT_EXCEEDED)` with 429 status
   - Set `Retry-After` header on the response
4. If value < config.limit:
   - KV `put` with key, value = incremented counter, `expirationTtl: config.window`
   - Set `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers
   - Call `await next()`
5. On KV error (exception or timeout):
   - Log error server-side
   - Return `problem(c, ERRORS.RATE_LIMIT_EXCEEDED)` with 429 (fail-closed)

#### KV operation note

Use `c.env.RATE_LIMIT_STORE` (the KV namespace binding) for all KV operations.

### 3.3 Device guard placement in payment create chain

Before the change:

```
paymentsRouter.post('/create', dbGuard(), zValidator(...), handler)
```

After the change:

```
paymentsRouter.post('/create', dbGuard(), deviceIdGuard(), zValidator(...), handler)
```

The guard MUST be placed AFTER `dbGuard()` (which ensures a DB connection) and BEFORE the Zod validation (which parses the body). This means a request missing its device ID is rejected before any body parsing or business logic runs.

---

## 4. Data Specifications

### 4.1 KV Key Format for Rate Limit Counters

```
rate-limit:{routePattern}:{deviceIdOrAnon}:{windowStart}
```

Where:

- `{routePattern}` = canonical route string with method, e.g., `POST-/payments/create`, `GET-/experiences/`
- `{deviceIdOrAnon}` = `c.var.deviceId` hex digest, or `"anon"` if deviceId is unset
- `{windowStart}` = `Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds`

**Example keys:**

```
rate-limit:POST-/payments/create:a1b2c3d4...:1719792000
rate-limit:GET-/experiences/:anon:1719792000
rate-limit:POST-/experiences/{id}/access:a1b2c3d4...:1719792000
```

For parameterized routes (`/experiences/:id/access`), use the resolved path as stored in the KV key to scope by the actual route rather than the specific ID. The `routePattern` in the `RateLimitConfig` determines the canonical form.

### 4.2 KV Key TTL Strategy

| Key Type           | TTL                     | Rationale                                                                  |
| ------------------ | ----------------------- | -------------------------------------------------------------------------- |
| Rate limit counter | `config.window` seconds | Auto-expires when window ends; old keys for expired windows are irrelevant |
| Nonce (future)     | 300 seconds             | Matches max timestamp drift window; prevents unbounded growth              |

TTL is set via `expirationTtl` on KV `put`. Cloudflare Workers KV automatically garbage-collects expired keys.

### 4.3 Error Constants in problem-details.ts

#### New error constants to add to `ERRORS_4XX`

```typescript
INVALID_DEVICE_ID: {
  code: 'INVALID_DEVICE_ID',
  detail: 'The X-Device-Id header must be a valid UUID v4.',
  status: HTTP.BAD_REQUEST,       // 400
} as const,

RATE_LIMIT_EXCEEDED: {
  code: 'RATE_LIMIT_EXCEEDED',
  detail: 'Too many requests. Please try again later.',
  status: 429,                    // 429 (define HTTP.TOO_MANY_REQUESTS or use literal)
} as const,
```

A new `HTTP.TOO_MANY_REQUESTS = 429` constant SHOULD be added to the `HTTP` object for consistency.

---

## 5. Configuration Specifications

### 5.1 wrangler.toml / wrangler.staging.toml

#### Both files MUST have

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT_STORE"
id = "<your-namespace-id>"
```

The namespace MUST be created in both production and staging Cloudflare accounts BEFORE the binding is uncommented:

```bash
npx wrangler kv:namespace create "RATE_LIMIT_STORE"
# → copy the returned ID
npx wrangler kv:namespace create "RATE_LIMIT_STORE" --env staging
# → copy the returned ID
```

#### File location

- Production: `apps/api/wrangler.toml`
- Staging: `apps/api/wrangler.staging.toml`

### 5.2 Env Interface Additions

**File:** `apps/api/src/index.ts`

```typescript
export interface Env {
  // ... existing properties

  RATE_LIMIT_STORE?: KVNamespace; // Add after FEEDBACK_STORE

  // ... rest unchanged
}
```

The `?` (optional) is intentional: if the binding is missing, rate-limited routes fail closed (logged + 429) rather than crashing with an unhandled binding error.

### 5.3 Variables Interface Additions

**File:** `apps/api/src/index.ts`

The `Variables` interface does NOT need additions for this slice — `c.var.deviceId` is already defined. Rate limit state is stored in KV, not in per-request variables.

---

## 6. Security Specifications

### 6.1 Fail-Closed Behavior on Validation Failure

Any validation failure in the security middleware chain MUST reject the request. The system does NOT silently fall back to a degraded mode:

| Failure                            | Behavior                                   | Status |
| ---------------------------------- | ------------------------------------------ | ------ |
| Invalid device ID format           | Reject with `INVALID_DEVICE_ID`            | 400    |
| Missing device ID on guarded route | Reject with `DEVICE_ID_REQUIRED`           | 400    |
| KV unavailable for rate limit      | Reject with `RATE_LIMIT_EXCEEDED` (logged) | 429    |

### 6.2 Rate Limit Failure Mode

When the rate limit is exceeded:

1. Return HTTP `429 Too Many Requests`
2. Response body is RFC 7807 `RATE_LIMIT_EXCEEDED`
3. `Retry-After` header is set to the integer number of seconds until the current window expires
4. Server-side log entry: `[RATE_LIMIT] Exceeded limit for route {routePattern} device {truncatedDeviceId} — {count}/{limit}`
5. No handler logic is executed

### 6.3 No Silent Degradation

The system MUST NOT silently degrade security for any reason:

- No bypass paths for invalid device IDs
- No fallback that accepts non-UUID device IDs after rejection
- No window where rate limits are not enforced (if the KV namespace is misconfigured, the middleware fails closed)

---

## 7. Test Specifications

### 7.1 Unit Tests for Device ID Validation

**File:** `apps/api/src/middleware/__tests__/device-id.test.ts`

| Test Case                 | X-Device-Id Value                        | Expected Result                             |
| ------------------------- | ---------------------------------------- | ------------------------------------------- |
| Valid UUID v4             | `550e8400-e29b-41d4-a716-446655440000`   | Passes — hash set                           |
| Empty header (missing)    | `undefined`                              | Passes — deviceId unset                     |
| Empty string              | `""`                                     | 400 `INVALID_DEVICE_ID`                     |
| Whitespace-only           | `"   "`                                  | 400 `INVALID_DEVICE_ID`                     |
| Tab character             | `"\t"`                                   | 400 `INVALID_DEVICE_ID`                     |
| String > 256 chars        | 257-character string                     | 400 `INVALID_DEVICE_ID`                     |
| Non-UUID string           | `"fallback-device-id"`                   | 400 `INVALID_DEVICE_ID`                     |
| UUID v1 (wrong version)   | `550e8400-e29b-11d4-a716-446655440000`   | 400 `INVALID_DEVICE_ID`                     |
| UUID v4 uppercase         | `550E8400-E29B-41D4-A716-446655440000`   | Passes — regex is case-insensitive          |
| UUID v4 with curly braces | `{550e8400-e29b-41d4-a716-446655440000}` | 400 `INVALID_DEVICE_ID`                     |
| UUID v4 with no dashes    | `550e8400e29b41d4a716446655440000`       | 400 `INVALID_DEVICE_ID`                     |
| Numeric string            | `"12345"`                                | 400 `INVALID_DEVICE_ID`                     |
| UUID nil (all zeros)      | `00000000-0000-0000-0000-000000000000`   | 400 `INVALID_DEVICE_ID` (version field `0`) |

### 7.2 Unit Tests for Rate Limit Middleware

**File:** `apps/api/src/middleware/__tests__/rate-limit-guard.test.ts`

| Test Case                                      | Expected Result                                                            |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| First request within limit                     | Passes — `X-RateLimit-Remaining` = limit - 1                               |
| Request right at the limit boundary            | Passes — `X-RateLimit-Remaining` = 0                                       |
| Request exceeding limit                        | 429 `RATE_LIMIT_EXCEEDED` with `Retry-After`                               |
| Different route counters are independent       | Request at limit on route A passes on route B                              |
| Different device IDs have independent counters | Device A at limit allows Device B's request                                |
| KV get returns non-integer value               | Default to 0 (reset)                                                       |
| KV put fails (exception)                       | Fail-closed — 429 with logged error                                        |
| Anonymous device (no deviceId)                 | Uses `"anon"` as identity key                                              |
| `Retry-After` header accuracy                  | Header value = window end - current time (within 1s)                       |
| Response headers on success                    | Contains `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` |
| Response headers on rejection                  | Contains `Retry-After`                                                     |

### 7.3 Integration Tests for Device Guard on Payments/Create

**File:** `apps/api/src/routes/__tests__/payments-security.test.ts`

| Test Case                                             | Expected Result                                 |
| ----------------------------------------------------- | ----------------------------------------------- |
| `POST /payments/create` with valid `X-Device-Id`      | 200/201 success                                 |
| `POST /payments/create` with missing `X-Device-Id`    | 400 `DEVICE_ID_REQUIRED`                        |
| `POST /payments/create` with invalid device ID format | 400 `INVALID_DEVICE_ID`                         |
| `POST /payments/webhook` without device ID            | Continues to work (no deviceIdGuard on webhook) |

### 7.4 Test for CORS Preflight with New Headers

**File:** `apps/api/src/middleware/__tests__/cors.test.ts`

| Test Case                                          | Expected Result                                                                                |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| OPTIONS request from allowed origin                | `Access-Control-Allow-Headers` includes `X-Signature`, `X-Timestamp`, `X-Nonce`, `Retry-After` |
| Actual request from allowed origin                 | Response headers include `Access-Control-Allow-Headers` with new headers                       |
| OPTIONS request with `ALLOWED_HEADERS` env var set | New headers are included when env var lists them                                               |
| CORS preflight cacheable                           | `Access-Control-Max-Age` = 86400 unchanged                                                     |

---

## 8. Acceptance Criteria

1. **Empty `X-Device-Id` header returns `400 INVALID_DEVICE_ID`** — previously would hash to a deterministic value that passed `deviceIdGuard()`

2. **Non-UUID `X-Device-Id` values return `400 INVALID_DEVICE_ID`** — `"fallback-device-id"`, numeric strings, UUID v1/v3/v5, non-UUID strings all fail

3. **`POST /payments/create` with missing `X-Device-Id` returns `400 DEVICE_ID_REQUIRED`** — middleware chain includes `deviceIdGuard()` between `dbGuard()` and `zValidator`

4. **Exceeding rate limit on a guarded route returns `429 RATE_LIMIT_EXCEEDED` with `Retry-After`** — KV counter ≥ limit triggers rejection with Retry-After header; response includes `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` on success

5. **Existing passing test suite continues to pass** — no regressions; UUID validation is a new constraint that only affects malformed device IDs

6. **CORS preflight responses include `X-Signature`, `X-Timestamp`, `X-Nonce`, `Retry-After` in `Access-Control-Allow-Headers`** — new headers are listed in `configureCors()` defaults and respected in the env-var override path

7. **KV namespace `RATE_LIMIT_STORE` is created in both wrangler configs** — `kv_namespaces` binding active in production (wrangler.toml) and staging (wrangler.staging.toml); binding name `RATE_LIMIT_STORE`; namespace IDs match their respective Cloudflare accounts

8. **Rate limit KV failure causes fail-closed rejection** — if `RATE_LIMIT_STORE` is unreachable or throws, middleware returns `429 RATE_LIMIT_EXCEEDED` with server-side log entry; does NOT silently pass traffic through

9. **Device ID validation runs BEFORE hashing** — invalid values never reach `hashDeviceId()`, never produce a deterministic hash, and never reach the database

10. **Each guarded route has independent rate limit counters** — exhaustion on one route does not affect other routes for the same device identity

---

## 9. Files Modified / Created

| File                                          | Action   | Change Summary                                                                       |
| --------------------------------------------- | -------- | ------------------------------------------------------------------------------------ |
| `apps/api/src/middleware/device-id.ts`        | Modified | Add UUID v4 validation before SHA-256 hashing                                        |
| `apps/api/src/middleware/problem-details.ts`  | Modified | Add `INVALID_DEVICE_ID` (400), `RATE_LIMIT_EXCEEDED` (429), `HTTP.TOO_MANY_REQUESTS` |
| `apps/api/src/middleware/cors.ts`             | Modified | Add `X-Signature`, `X-Timestamp`, `X-Nonce`, `Retry-After` to `DEFAULT_HEADERS`      |
| `apps/api/src/middleware/rate-limit-guard.ts` | Created  | New rate limit middleware with KV-backed counter                                     |
| `apps/api/src/routes/payments.ts`             | Modified | Add `deviceIdGuard()` to `POST /payments/create` chain                               |
| `apps/api/src/index.ts`                       | Modified | Add `RATE_LIMIT_STORE?: KVNamespace` to `Env` interface                              |
| `apps/api/wrangler.toml`                      | Modified | Add `RATE_LIMIT_STORE` KV namespace binding                                          |
| `apps/api/wrangler.staging.toml`              | Modified | Add `RATE_LIMIT_STORE` KV namespace binding                                          |

---

## 10. Assumptions and Risks

| Assumption / Risk                                                                                            | Impact                                                                                            | Mitigation                                                                                     |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **The mobile client always sends UUID v4 for device IDs** — any non-UUID device ID is attacker data or a bug | Well-behaved clients are unaffected; only broken or malicious clients get `400 INVALID_DEVICE_ID` | Validation at middleware level catches early; `'fallback-device-id'` case is tracked as P2 fix |
| **KV rate limit adds latency** — KV operations are ~5-15ms per read/write                                    | Each guarded request sees ~10-30ms additional P99 latency                                         | Start conservative; monitor P99; Cloudflare WAF provides first line of defense                 |
| **KV eventual consistency** — KV reads may be stale within a few seconds                                     | A fast attacker could burst a few extra requests within the propagation window                    | Acceptable for rate limiting as a deterrent; Cloudflare WAF covers volumetric layer            |
| **Rate limiter without device ID** — requests without `X-Device-Id` still get rate-limited                   | Anonymous requests are lumped under `"anon"` key, losing per-device granularity                   | Better than no rate limiting; device guard ensures most legitimate requests have a device ID   |
| **`RATE_LIMIT_STORE` KV must be created before deployment** — missing binding causes fail-closed rejection   | No traffic on rate-limited routes until KV is created                                             | Documented in acceptance criteria; fail-closed is safer than fail-open                         |
