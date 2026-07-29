# Mobile API Security Hardening — First Slice: Tasks

**Change:** `sec-api-mobile-security-hardening`
**Slice:** Device ID validation, P0 guard fix, Rate limiting, CORS updates

## Review Workload Forecast

| Field                   | Value                                                                        |
| ----------------------- | ---------------------------------------------------------------------------- |
| Estimated changed lines | ~480–550                                                                     |
| 400-line budget risk    | High                                                                         |
| Chained PRs recommended | Yes                                                                          |
| Suggested split         | PR 1 (Foundation) → PR 2 (Device validation) → PR 3 (Rate limiting + deploy) |
| Delivery strategy       | ask-on-risk                                                                  |
| Chain strategy          | pending                                                                      |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

---

## PR 1 — Foundation: Error constants, CORS headers, Env + wrangler configs

Rough estimate: ~80–100 changed lines. Safe deploy — no behavioral change for well-behaved clients.

### T1.1 — Add HTTP.TOO_MANY_REQUESTS and error constants to problem-details.ts

**Files:** `apps/api/src/middleware/problem-details.ts`
**Dependencies:** None
**Acceptance criteria:**

- `HTTP.TOO_MANY_REQUESTS === 429`
- `ERRORS.INVALID_DEVICE_ID` added to `ERRORS_4XX` with `code: 'INVALID_DEVICE_ID'`, `status: HTTP.BAD_REQUEST`
- `ERRORS.RATE_LIMIT_EXCEEDED` added to `ERRORS_4XX` with `code: 'RATE_LIMIT_EXCEEDED'`, `status: 429`
- `ERRORS` flat merge includes the new constants
- `ERRORS_4XX` shape tests pass (every entry has code, detail, status; 4xx have non-generic detail)
- Existing `problem-details.test.ts` suite continues to pass
  **Estimated lines changed:** ~8
  **Test evidence required:** `✓ problem-details.test.ts` passes (no new test file needed; extend existing describe blocks)

### T1.2 — Add X-Signature, X-Timestamp, X-Nonce, Retry-After to CORS headers

**Files:** `apps/api/src/middleware/cors.ts`
**Dependencies:** None
**Acceptance criteria:**

- `DEFAULT_HEADERS` includes `'X-Signature'`, `'X-Timestamp'`, `'X-Nonce'`, `'Retry-After'`
- `EXPOSED_HEADERS` includes `'Retry-After'`
- CORS preflight with `Access-Control-Request-Headers: x-signature, x-timestamp, x-nonce, retry-after` returns them in `Access-Control-Allow-Headers`
- `Access-Control-Expose-Headers` includes `Retry-After`
- Existing `cors.test.ts` suite continues to pass
  **Estimated lines changed:** ~5
  **Test evidence required:** New describe block in `cors.test.ts` verifying the four new headers are present in allow-headers and expose-headers

### T1.3 — Add RATE_LIMIT_STORE and RATE_LIMITING_ENABLED to Env interface

**Files:** `apps/api/src/index.ts`
**Dependencies:** None
**Acceptance criteria:**

- `Env` interface has `RATE_LIMIT_STORE?: KVNamespace` (optional)
- `Env` interface has `RATE_LIMITING_ENABLED?: string` (optional)
- TypeScript compiles without errors
- No functional changes — this is purely additive type declaration
  **Estimated lines changed:** ~4
  **Test evidence required:** `✓ typecheck` passes

### T1.4 — Add KV namespace binding to wrangler configs

**Files:**

- `apps/api/wrangler.toml`
- `apps/api/wrangler.staging.toml`
  **Dependencies:** T1.3
  **Acceptance criteria:**
- Both configs have `[[kv_namespaces]]` block with `binding = "RATE_LIMIT_STORE"`
- `id` field contains placeholder `<namespace-id>` (to be replaced after KV creation in T3.5)
- Configs parse without error
- No functional change until namespace IDs are filled in
  **Estimated lines changed:** ~10 (5 per file)
  **Test evidence required:** TOML is valid (manual check or `wrangler deploy --dry-run`)

---

## PR 2 — Device ID validation + guard placement

Rough estimate: ~130–150 changed lines. Behavior change — invalid device IDs now rejected.

### T2.1 — Add UUID v4 validation to injectDeviceId()

**Files:** `apps/api/src/middleware/device-id.ts`
**Dependencies:** T1.1 (needs `ERRORS.INVALID_DEVICE_ID` and `HTTP.BAD_REQUEST`)
**RED test criteria (BEFORE implementation):**

- Write failing test cases in `__tests__/device-id.test.ts` for:
  - Empty string `""` → 400 `INVALID_DEVICE_ID` (no `deviceId` set)
  - Whitespace-only `"   "` → 400 `INVALID_DEVICE_ID`
  - Length > 256 chars → 400 `INVALID_DEVICE_ID`
  - Non-UUID string `"fallback-device-id"` → 400 `INVALID_DEVICE_ID`
  - UUID v1 `550e8400-e29b-11d4-a716-446655440000` → 400 `INVALID_DEVICE_ID`
  - UUID with curly braces `{550e8400-...}` → 400 `INVALID_DEVICE_ID`
  - UUID nil all zeros → 400 `INVALID_DEVICE_ID` (version field 0, not 4)
  - Valid UUID v4 → passes, `c.var.deviceId` set to SHA-256 hash
  - Valid UUID v4 uppercase → passes (case-insensitive)
    **GREEN implementation:**
- Define `UUID_V4_REGEX` as module-level constant (compiled once)
- Add validation block BEFORE `hashDeviceId()`:
  1. `if (!rawDeviceId) { await next(); return; }` — missing header passes through
  2. `if (rawDeviceId === '')` → `c.json()` with 400 `INVALID_DEVICE_ID`
  3. `if (/^\s+$/.test(rawDeviceId))` → 400
  4. `if (rawDeviceId.length > 256)` → 400
  5. `if (!UUID_V4_REGEX.test(rawDeviceId))` → 400
  6. Valid → hash + set `c.var.deviceId` + `await next()`
- Rejections use `c.json()` directly (as per design), NOT via `problem()` — but `device-id.ts` must import `ERRORS.INVALID_DEVICE_ID` from `problem-details.ts` for consistent error shape
  **REFACTOR:** Ensure the UUID regex is the exact specified pattern: `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`
  **Acceptance criteria:**
- All 12+ test cases pass (8 rejection, 2 pass, missing header, uppercase)
- Existing `device-id.test.ts` tests (hashDeviceId, injectDeviceId with valid header, missing header) still pass
- `c.var.deviceId` is NEVER set on rejection
  **Estimated lines changed:** ~30 (code) + ~80 (tests)
  **Test evidence required:** `✓ vitest run apps/api/src/__tests__/device-id.test.ts` — all tests pass

### T2.2 — Add deviceIdGuard() to POST /payments/create chain

**Files:** `apps/api/src/routes/payments.ts`
**Dependencies:** T2.1 (deviceIdGuard() already exists in `device-id-guard.ts`; guard depends on `injectDeviceId()` validation being in place)
**Acceptance criteria:**

- Import `deviceIdGuard` from `'../middleware/device-id-guard'` (already imported — just check)
- Import `rateLimit` and `RATE_LIMIT_DEFAULTS` from `'../middleware/rate-limit-guard'` (will be added in PR 3, but we add the import now for the guard only)
- `POST /payments/create` chain becomes: `paymentsGuard() → dbGuard() → deviceIdGuard() → zValidator(...) → handler`
- `deviceIdGuard()` placed BETWEEN `dbGuard()` and `zValidator()`
- Missing `X-Device-Id` → 400 `DEVICE_ID_REQUIRED` (via `deviceIdGuard()`)
- Invalid device ID → 400 `INVALID_DEVICE_ID` (via `injectDeviceId()` — caught before guard)
- Valid device ID with valid payment body → 200/201 success (full chain passes)
- The webhook return/callback routes are NOT affected (no deviceIdGuard)
  **Estimated lines changed:** ~5
  **Test evidence required:** Integration test in `payments-security.test.ts` covering valid device ID, missing device ID, invalid device ID on `POST /payments/create`

---

## PR 3 — Rate limiting + KV deployment

Rough estimate: ~280–320 changed lines. KV namespace must be created before deploy.

### T3.1 — Create rate-limit-guard.ts middleware

**Files:**

- `apps/api/src/middleware/rate-limit-guard.ts` (NEW)
  **Dependencies:** T1.1 (needs `ERRORS.RATE_LIMIT_EXCEEDED` and `HTTP.TOO_MANY_REQUESTS`), T1.3 (needs `Env` with `RATE_LIMIT_STORE`)
  **RED test criteria (BEFORE implementation):**
- Write failing tests in `apps/api/src/middleware/__tests__/rate-limit-guard.test.ts` for:
  - First request within limit → passes, `X-RateLimit-Remaining: limit-1`
  - Request at boundary (count === limit-1) → passes, `X-RateLimit-Remaining: 0`
  - Request exceeding limit → 429 `RATE_LIMIT_EXCEEDED` with `Retry-After`
  - Different routes have independent counters
  - Different device IDs have independent counters
  - KV returns non-integer → defaults to 0 (reset)
  - KV.get() throws → fail-closed 429
  - KV.put() throws → fail-closed 429
  - No deviceId (anon) → uses `"anon"` as identity key
  - Missing KV binding → pass through (dev local)
  - `Retry-After` header accuracy (within 1s of window reset)
  - Response headers on success: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
    **GREEN implementation:**
- Export `RateLimitConfig` interface with optional fields: `limit?`, `windowSeconds?`, `enabled?`, `keyPrefix?`
- Export `rateLimit(config?)` middleware handler
- Export `RATE_LIMIT_DEFAULTS` named constants (PAYMENTS_CREATE, EXPERIENCES_ACCESS, EXPERIENCES_LIST)
- Export `buildRateLimitKey()` helper
- Resolution chain: global kill switch (`c.env.RATE_LIMITING_ENABLED === 'false'`) → missing binding → per-endpoint `enabled: false` → `config.limit ?? global.defaultLimit` → `config.windowSeconds ?? global.defaultWindowSeconds`
- KV interaction: get-then-put with `expirationTtl: config.windowSeconds + 5`
- Fail-closed on KV error with 429 + `Retry-After`
- Response headers on success: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Response headers on 429: `Retry-After`
- Use `c.var.deviceId || 'anon'` for the identity key component
  **REFACTOR:** Ensure windowStart calculation uses `Math.floor(Date.now()/1000 / config.windowSeconds) * config.windowSeconds` for consistent window alignment
  **Acceptance criteria:**
- All ~14 test cases pass
- Middleware handles global disable via env var
- Middleware handles missing binding (dev pass-through)
- Response headers present and correct on both pass and reject paths
- Error log emitted on KV failure
  **Estimated lines changed:** ~120 (code) + ~150 (tests)
  **Test evidence required:** `✓ vitest run apps/api/src/middleware/__tests__/rate-limit-guard.test.ts` — all tests pass

### T3.2 — Add rateLimit() to POST /payments/create

**Files:** `apps/api/src/routes/payments.ts`
**Dependencies:** T3.1 (needs `rateLimit` middleware and `RATE_LIMIT_DEFAULTS`), T2.2 (needs `deviceIdGuard()` in chain)
**Acceptance criteria:**

- `POST /payments/create` chain: `paymentsGuard() → dbGuard() → deviceIdGuard() → rateLimit(RATE_LIMIT_DEFAULTS.PAYMENTS_CREATE) → zValidator(...) → handler`
- Rate limit runs AFTER deviceIdGuard() (device ID must be set for rate limit counter)
- Rate limit runs BEFORE Zod validation (body parsed only after rate limit check passes)
- 10 req / 60s window with `keyPrefix: 'payments:create'`
- Response headers present on success: `X-RateLimit-Limit: 10`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- 429 rejection returns RFC 7807 `RATE_LIMIT_EXCEEDED` with `Retry-After`
  **Estimated lines changed:** ~5 (add middleware to chain) + shared test coverage in T3.4
  **Test evidence required:** (covered by integration test in T3.4)

### T3.3 — Add rateLimit() to GET /experiences/ and POST /experiences/:id/access

**Files:**

- `apps/api/src/routes/experiences.ts`
- `apps/api/src/routes/payments.ts` (POST /experiences/:id/access is already on paymentsRouter)
  **Dependencies:** T3.1
  **Acceptance criteria for GET /experiences/:**
- Chain: `dbGuard() → deviceIdGuard() → jwtGuard() → rateLimit(RATE_LIMIT_DEFAULTS.EXPERIENCES_LIST) → handler`
- 30 req / 60s window with `keyPrefix: 'experiences:list'`
- Import `rateLimit` and `RATE_LIMIT_DEFAULTS` in `experiences.ts`
  **Acceptance criteria for POST /experiences/:id/access:**
- Chain: `paymentsGuard() → dbGuard() → deviceIdGuard() → rateLimit(RATE_LIMIT_DEFAULTS.EXPERIENCES_ACCESS) → zValidator(...) → handler`
- 20 req / 60s window with `keyPrefix: 'experiences:access'`
  **Estimated lines changed:** ~10 (5 per file)
  **Test evidence required:** (covered by integration test in T3.4)

### T3.4 — Write integration tests for rate-limited route chains

**Files:**

- `apps/api/src/routes/__tests__/payments-security.test.ts` (create if doesn't exist)
- `apps/api/src/__tests__/security-middleware-chain.test.ts` (new)
  **Dependencies:** T3.1, T3.2, T3.3
  **Test cases:**
- `POST /payments/create` with valid `X-Device-Id` + valid body → 200/201 (full chain passes)
- `POST /payments/create` with missing `X-Device-Id` → 400 `DEVICE_ID_REQUIRED`
- `POST /payments/create` with invalid device ID → 400 `INVALID_DEVICE_ID`
- `POST /payments/create` exceeding rate limit (10 requests) → 429 on 11th
- `GET /experiences/` exceeding rate limit (30 requests) → 429 on 31st
- `POST /payments/webhook` without device ID → continues to work (no deviceIdGuard on webhook)
- Different routes have independent rate limit counters
- KV failure → fail-closed 429 on guarded routes
- `Retry-After` header present and valid on 429 responses
- All rate limit response headers present on success responses
  **Acceptance criteria:**
- All integration tests pass against the full app
- Tests use Hono's `app.fetch()` with env bindings injection
- KV is mocked via in-memory MockKVNamespace
  **Estimated lines changed:** ~100 (tests)
  **Test evidence required:** `✓ vitest run apps/api/src/__tests__/security-middleware-chain.test.ts` and `✓ vitest run apps/api/src/routes/__tests__/payments-security.test.ts` — all pass

### T3.5 — Create KV namespaces and update wrangler configs

**Dependencies:** T1.4 (needs wrangler configs with placeholder IDs)
**Commands:**

```bash
# Production namespace
npx wrangler kv:namespace create "RATE_LIMIT_STORE"
# → copy returned ID into wrangler.toml

# Staging namespace
npx wrangler kv:namespace create "RATE_LIMIT_STORE" --env staging
# → copy returned ID into wrangler.staging.toml

# Optional: preview namespace for wrangler dev
npx wrangler kv:namespace create "RATE_LIMIT_STORE" --env preview
# → add as preview_id in both configs (optional)
```

**Files to update:**

- `apps/api/wrangler.toml`
- `apps/api/wrangler.staging.toml`
  **Acceptance criteria:**
- KV namespaces exist in Cloudflare accounts (production + staging)
- Namespace IDs are present in both wrangler configs (not `<namespace-id>` placeholders)
- `npx wrangler deploy --dry-run` validates the config
- (Optional) `preview_id` present for `wrangler dev` support
  **Estimated lines changed:** ~10 (replace placeholders with real IDs)

### T3.6 — Deploy to staging, verify, then production

**Dependencies:** All of PR 3 (T3.1 through T3.5)
**Steps:**

1. Deploy to staging: `npx wrangler deploy --env staging`
2. Smoke-test staging routes with valid and invalid device IDs
3. Verify CORS preflight includes new headers
4. Verify rate limit counters work (send requests until 429)
5. Deploy to production: `npx wrangler deploy`
   **Acceptance criteria:**

- Staging deployment passes all acceptance criteria
- Production deployment passes all acceptance criteria
- Existing functionality continues to work
- Metrics/error monitoring confirms no unexpected errors
  **Estimated lines changed:** 0 (deployment, not code)

---

## Rollback Boundaries

| PR   | Rollback Boundary                                                                                   |
| ---- | --------------------------------------------------------------------------------------------------- |
| PR 1 | Revert `problem-details.ts`, `cors.ts`, `index.ts`, `wrangler.toml`, `wrangler.staging.toml`        |
| PR 2 | Revert `device-id.ts` + `payments.ts` (deviceIdGuard placement only). No DB migration needed.       |
| PR 3 | Revert `rate-limit-guard.ts` (delete) + revert route files + remove KV binding or keep fail-closed. |

---

## Dependency Graph (task-level)

```
T1.1 (error constants)
  ├── T1.2 (CORS headers)        — no dependency
  ├── T1.3 (Env interface)        — no dependency
  │    └── T1.4 (wrangler configs)
  └── T2.1 (device-id validation) — depends on T1.1
       └── T2.2 (deviceIdGuard on payments) — depends on T2.1

T3.1 (rate-limit-guard)           — depends on T1.1, T1.3
  ├── T3.2 (rateLimit on POST /payments/create)     — depends on T3.1, T2.2
  ├── T3.3 (rateLimit on experiences routes)        — depends on T3.1
  ├── T3.4 (integration tests)                      — depends on T3.1, T3.2, T3.3
  ├── T3.5 (KV namespace creation)                  — depends on T1.4
  └── T3.6 (deploy)                                 — depends on T3.1–T3.5
```

## Test Files Summary

| Test File                                                    | Source            | Coverage                                             |
| ------------------------------------------------------------ | ----------------- | ---------------------------------------------------- |
| `apps/api/src/__tests__/device-id.test.ts`                   | Existing — extend | Device ID validation + hashing                       |
| `apps/api/src/middleware/__tests__/rate-limit-guard.test.ts` | NEW               | Rate limit middleware logic                          |
| `apps/api/src/middleware/__tests__/cors.test.ts`             | Existing — extend | CORS new headers                                     |
| `apps/api/src/__tests__/problem-details.test.ts`             | Existing — extend | New error constants                                  |
| `apps/api/src/__tests__/security-middleware-chain.test.ts`   | NEW               | Full chain integration (inject → guard → rate limit) |

<!-- sdd-owner: implementation -->
