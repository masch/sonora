# Proposal: API Log Redaction

Status: proposed
Change: `api-log-redaction`
Component: `apps/api` (Expo SDK 56 monorepo, Bun, Hono Workers)

## Intent

Stop sensitive data — auth headers, full request/response bodies, and query strings — from
persisting to Cloudflare Workers Logs (7-day retention) across **all** logging surfaces in
`apps/api`. Replace raw logging with a single shared redaction policy (header/query/body
allowlists) applied unconditionally in every environment, while preserving the
`ENABLE_API_LOGGING` on/off toggle.

## Business problem

Today the API persists the following to Workers Logs (7-day retention, readable by anyone
with account access):

- **Full request URL including query string** — `deviceId`, signed audio URLs, `email`,
  `data.id` (middleware `logger.ts`, `c.req.url`).
- **All request headers** — `Authorization`, `Cookie`, `X-Api-Key`, `X-Device-Id`,
  `X-Request-Id` (`logger.ts` `c.req.header()`).
- **Full parsed JSON request bodies** — buyer PII, JWTs, device IDs (`logger.ts`).
- **Full JSON/text response bodies** — signed audio URLs, MP checkout URLs, tokens
  (`logger.ts`, buffered and reconstructed).
- **Outbound request data** — `HttpClient` logs merged headers (bearer tokens), full request
  bodies, and full response text (`lib/http-client.ts`). Latent risk: zero production call
  sites; MP traffic goes through the official SDK, not this client.
- **Redirect and webhook metadata** — `routes/payments.ts` logs `receivedRedirectUrl`
  (may carry query strings), full `existingMeta`/`incomingMeta`/`mergedMetadata` webhook
  objects (buyer PII, redirect URLs, device IDs), and raw redirect URLs / `Referer` in the
  return endpoint (lines 297–398).

Leaked classes: auth tokens, session cookies, buyer PII (email), signed/opaque URLs, device
IDs. This is a data-protection and credential-leak risk, not a cosmetic logging issue.

## Target outcome

Logs contain only non-sensitive, debugging-useful metadata:

- Message: `method` + `path` (query string stripped).
- Metadata: `status`, `duration`.
- Safe header allowlist: `content-type`, `user-agent`.
- Safe query-param allowlist (e.g. `page`, `limit`, `sync`) — everything else omitted.
- Safe body-field extraction (opaque IDs, status enums) — never full bodies.

The same rule applies in dev and prod. `ENABLE_API_LOGGING` remains the on/off toggle
(current semantics `!== 'false'`, ON by default, secret via Makefile targets), but redaction
is unconditional whenever logging is enabled.

## Scope

### In scope

1. **New shared redaction helper** — single source of truth for the policy: header
   allowlist, query-param allowlist, safe body-field extraction, URL sanitizer (strip
   query). Placement: `apps/api/src/lib/log-redaction.ts` (recommended; see Decision gap 1).
2. **`src/middleware/logger.ts`** — primary live leak. Request/response logs emit
   method/path/status/duration + allowlisted headers, query params, and body fields only.
   Warn paths (lines 24/32) strip the query from embedded URLs; the malformed-JSON fallback
   stops logging raw body text and logs an omit marker instead.
3. **`src/lib/http-client.ts`** — dormant (zero production call sites), same policy:
   never log merged headers, request body, or response text; strip query from message and
   error-log URLs.
4. **`src/routes/payments.ts`** — every sensitive call site:
   - Line ~132 `receivedRedirectUrl`: origin-only or omitted (Decision gap 5); never the
     full URL with query.
   - Line ~250 webhook metadata (`existingMeta`, `incomingMeta`, `mergedMetadata`): never
     logged as objects; log presence flags/status only.
   - Return endpoint (lines 297–398): `purchase.metadata` objects, `rawRedirectUrl`,
     `finalTargetUrl`, and the raw `Referer` header redacted to non-sensitive summaries
     (origin or omit).
5. **Audit, keep as-is**: spec-required invalid-signature warn (`payments/mercadopago.ts`
   ~93–99) logs only `ts`, `x-request-id`, `data.id`, failure reason — already
   non-sensitive, compliant with `openspec/specs/api/spec.md` (Requirements:
   _Metrics and logging on invalid signature_).
6. **Tests** — rewrite ~7/8 assertions in `middleware/__tests__/logger.test.ts` that assert
   sensitive logging; add "sensitive data never appears in logged output" assertions to
   `lib/http-client` tests and `payments` tests; new unit tests for the shared helper.
   Test command: `make api-test` (bun test, vitest 4.1.10).

### Non-goals

- Cloudflare Workers Logs 7-day retention policy — unchanged.
- No log pipeline / Logpush / drain / structured-logging schema.
- No sampling infrastructure (only if trivial — flagged below).
- No change to `ENABLE_API_LOGGING` toggle semantics or the Makefile secret targets.
- No change to shared logger level semantics (`packages/shared/src/utils/logger.ts`).
- No OpenTelemetry/span-attribute counterpart of #390 — none exists in the repo; the shared
  helper _is_ the policy artifact aligned with the #390 sensitive-data policy.
- `scripts/migrations/migrate-cli.ts` (local CLI, not Workers) and
  `middleware/problem-details.ts` 5xx detail logging (server-side, caller-provided) —
  out of scope.
- Retroactive purging of already-persisted logs — operational action, flagged in Risks.

## Business rules

1. **Single shared helper** — one implementation of the allowlists; no ad-hoc redaction at
   call sites. The helper is the canonical policy source going forward (design time decides
   the exact field sets).
2. **URL sanitization** — the query string is stripped from every URL before it appears in a
   message or metadata (covers `c.req.url`, `HttpClient` `baseUrl + path`, and warn/error
   messages embedding URLs).
3. **Header allowlist** — `content-type`, `user-agent` only. Never
   `authorization`, `cookie`, `x-api-key`, `x-device-id`, or any other header.
4. **Query-param allowlist** — proposed set `page`, `limit`, `sync`. Never `email`,
   `data.id`, tokens, or unrecognized params (Decision gap 3).
5. **Body extraction** — allowlisted top-level fields only, with the principle _opaque IDs
   and status enums yes; URLs, emails, free text, nested metadata objects no_. Proposed
   starting set: `purchaseId`, `status`, `event`, `providerPaymentId`, `merchant_order_id`,
   `externalReference`, `type`. JSON parse failure logs an omit marker, never the raw text.
6. **Environment parity** — identical redaction rule in dev and prod; redaction is
   unconditional. `ENABLE_API_LOGGING !== 'false'` toggle behavior preserved exactly.
7. **payments.ts object rule** — redirect URLs and metadata objects are never logged whole;
   only origin-derived values or presence/status flags.
8. **Response stream integrity** — if the middleware still buffers response bodies to
   extract allowlisted fields, the buffer-and-rebuild pattern (or `Response.clone()`) MUST be
   preserved so real network clients receive an undisturbed body (covered by the existing
   real-node-server test).

## Edge cases

- **URLs with query strings** in `c.req.url`, redirect/notification/back URLs, and the
  `Referer` header — sanitize to path / origin before logging, in both messages and
  metadata.
- **Nested PII in metadata objects** (`existingMeta`/`incomingMeta`/`mergedMetadata`,
  purchase `metadata`) — never flattened or logged; presence flags only.
- **Malformed JSON request body** — current code logs the raw string; new behavior logs an
  omit marker and never the raw text.
- **Response stream reconstruction** — buffering must not drain/lock the stream for real
  clients; keep the existing reconstruction pattern and its regression test.
- **MP webhook signature flow** — the redaction work must not alter header/payload access
  for `processWebhook`; the spec-required invalid-signature warn stays byte-for-byte
  equivalent.
- **Empty states** — missing query params, empty bodies, empty metadata objects: helper
  no-ops gracefully.
- **Non-JSON content types** — no body extraction attempted (matches current behavior).
- **`ENABLE_API_LOGGING: 'false'`** — suppresses all logging as today; redaction tests must
  not remove this toggle test.

## Implications / impact

- **Modules changed**: `middleware/logger.ts`, `lib/http-client.ts`, `routes/payments.ts`,
  new `lib/log-redaction.ts` (or `packages/shared` — gap 1).
- **Tests changed**: ~7/8 assertions in `logger.test.ts` rewritten to assert redaction
  (they currently assert full-body/URL logging); `http-client.test.ts` gains negative
  assertions; `payments.test.ts` verified to be behavior-only (no payload-dependent
  assertions found — spies are `mockImplementation` no-ops); new helper unit tests.
- **Deployment/ops**: no wrangler/config/secret changes; `ENABLE_API_LOGGING` Makefile
  targets unchanged; Workers Logs continue to capture console output, now redacted.
- **Debugging capability loss**: the main risk. Mitigated by the explicit allowlists
  (method/path/status/duration + safe headers + safe query params + safe body fields), which
  preserve the debugging signals that drive issue triage without exposing credentials/PII.
- **Existing sensitive logs are not retroactively scrubbed**: 7-day retention means old
  entries expire naturally; manual purge (if desired) is an operational task outside this
  change (flagged).

## Risks

1. **Redaction regression at future call sites** — mitigated by the shared helper being the
   only sanctioned path and by "sensitive data never appears" negative tests.
2. **Response body extraction reintroduces stream issues** — keep proven buffer-and-rebuild;
   the real-node-server stream test guards it.
3. **Over-redaction** (losing needed debugging signal) — allowlist sets are explicit and
   reviewed; adjust by extending the helper, not by raw logging.
4. **Scope drift** — http-client is dormant; the change is policy consistency, not fixing a
   live leak there. payments.ts surfaces are the second live concern.
5. **Repo path hazard** — real repo is `/var/home/masch/dev/js/sonora`, not the session
   scaffold cwd; apply must target the real path.

## Rollback

- Pure code change: revert the commit(s); no data migration, no secret/env rotation.
- Old sensitive logs in Workers Logs are not restored by rollback — they remain subject to
  the 7-day retention; no retroactive leak is introduced by rolling forward or back.

## Success criteria

1. No sensitive value (authorization header value, cookie, PII, query token, redirect URL,
   full metadata object) appears in any logged output with logging enabled, in dev or prod.
2. Allowlisted debugging fields (method, path, status, duration, `content-type`,
   `user-agent`, safe query params, safe body fields) still appear.
3. Response stream integrity preserved — existing real-node-server test passes.
4. `make api-test` green: rewritten `logger.test.ts` (redaction + toggle), new helper and
   http-client negative assertions, `payments.test.ts` unchanged behavior.
5. Invalid-signature warn log unchanged and spec-compliant.
6. `ENABLE_API_LOGGING: 'false'` suppresses all logging (toggle semantics preserved).

## Decision gaps (RESOLVED — user confirmation 2026-08-04)

1. **Helper placement**: `apps/api/src/lib/log-redaction.ts` (recommended — no consumer
   outside the API today) vs `packages/shared` (only if mobile/admin reuse is planned).
   → RESOLVED at design phase; recommendation stands unless design finds a shared consumer.
2. **Middleware body extraction**: keep buffering to extract allowlisted fields from
   request/response JSON bodies (recommended — preserves response debugging), vs drop
   middleware body logging entirely (simpler; status/duration only).
   → **USER DECISION: keep allowlisted safe body fields** (buffer + rebuild pattern for
   request and response streams).
3. **Query-param allowlist**: proposed `{page, limit, sync}` — confirm nothing else is
   legitimately needed for debugging (e.g. `data.id` is deliberately excluded; the spec-required
   signature warn already covers diagnostics).
   → **USER DECISION: allowlist is `{page, limit, sync}`**; everything else omitted.
4. **`x-request-id` correlation**: scope names `content-type` + `user-agent`; optionally add
   `x-request-id` (non-sensitive, already used in webhook logs) for end-to-end correlation.
   → **USER DECISION: include `x-request-id`** in the header allowlist (end-to-end trace
   correlation).
5. **`receivedRedirectUrl` handling**: log parsed origin only (retains routing context) vs
   omit entirely (deep-link URLs may be considered sensitive routing data).
   → **USER DECISION: log redirect/target URLs with query string stripped** (origin + path
   only, never query) for `receivedRedirectUrl`, `rawRedirectUrl`, `finalTargetUrl`.
