# Explore — api-log-redaction

status: success

> Note: the delegated cwd `/var/home/masch/dev/sonora` is an empty placeholder scaffold. The real repo is at `/var/home/masch/dev/js/sonora`. All findings reference the real repo.

## 1. What is logged today

### `apps/api/src/middleware/logger.ts` (`customLogger`)

- Gate (line 6): `const enableLogging = c.env?.ENABLE_API_LOGGING !== 'false';` — **ON by default**; opt-out only when the Worker secret is exactly the string `'false'`. Secret set via Makefile targets `api-deploy-staging-log-toggle` / `api-deploy-production-log-toggle` (Makefile:523–530, `bunx wrangler secret put ENABLE_API_LOGGING`). Not declared in `wrangler.toml` `[vars]`; absent from `.dev.vars*` (dev defaults ON).
- Request log (line 37): `logger.info(\`[API Request] ${method} ${url}\`, { headers: c.req.header(), body: parsedRequestBody })`
  - `url = c.req.url` (line 13) → **includes query string** (deviceId, signed audio URLs, etc.).
  - `c.req.header()` → **ALL headers**: `authorization`, `cookie`, `x-api-key`, `x-device-id`, `x-request-id`, …
  - Body (lines 17–33): clones `c.req.raw`, reads text when content-type is `application/json`, JSON.parses → **full parsed request body** (buyer PII, device IDs, JWT payloads).
- Response log (line 71): `logger.info(\`[API Response] ${method} ${url} - ${c.res.status} (${duration}ms)\`, { status: c.res.status, body: responseBody })`
  - Body (lines 42–56): buffers `c.res.arrayBuffer()` when content-type is json/text, parses; reconstructs `c.res = new Response(bodyBytes, c.res)` to avoid stream draining → **full response body** (signed audio URLs, checkout URLs, tokens).
  - Status + duration are already present in the message (safe fields).
- Emission: `logger` from `@sonora/shared` → `packages/shared/src/utils/logger.ts` → `console.log/warn/error` with `[LEVEL]` prefix. Level filter: `__DEV__ === false` → warn/error only, otherwise all. In Workers, console output lands in Workers Logs.

### `apps/api/src/lib/http-client.ts` (`HttpClient`)

- Request log (line 49): `logger.info(\`[HTTP Request] ${method} ${url}\`, { headers, body: options.body })`
  - `url = baseUrl + path` → includes query string if present.
  - `headers` = merged Content-Type + `config.headers` + `options.headers` → **Authorization bearer tokens**.
  - `body` = full request body object → buyer data.
- Response log (line 76): `logger.info(\`[HTTP Response] ${method} ${url} - ${res.status} (${duration}ms)\`, { status, body: responseText })` → **full response text**.
- Error log (line 93): `logger.error(\`[HTTP Request Error] ... ${url} ...\`, err)`.
- **`HttpClient` has ZERO production call sites.** Only imported by its own test. The MercadoPago integration uses the official `mercadopago` SDK (`apps/api/src/payments/mercadopago.ts`: `MercadoPagoConfig`/`Payment`/`Preference`, v3.2.0) — not `HttpClient`. The risk is dormant (library with tests), not a live MP leak.

## 2. Usage sites

- `customLogger`: registered `apps/api/src/index.ts:77` — `app.use('*', customLogger())`, FIRST middleware (before CORS / db-injector / device-id), so it sees every request including auth headers. `Env.ENABLE_API_LOGGING?: string` declared at `index.ts:43`.
- `HttpClient`: no production usage; tests only.

## 3. Existing tests + test command

- `apps/api/src/middleware/__tests__/logger.test.ts` (vitest, mocks `@sonora/shared` logger): 8 tests. **Currently asserts full-body/URL logging** (e.g. request `body: { name: 'masch', role: 'admin' }`, response `'<h1>Hello</h1>'`, `ENABLE_API_LOGGING: 'false'` suppresses everything). ~7 of 8 tests must be rewritten when bodies/headers stop being logged.
- `apps/api/src/__tests__/http-client.test.ts` (vitest): 11 tests; does NOT mock the logger and asserts nothing about log output → no breakage, but "sensitive data never logged" assertions should be added.
- `apps/api/src/__tests__/payments.test.ts` (~lines 397–401): spies `logger.info`/`logger.warn` (`vi.spyOn(...).mockImplementation(() => {})`); verify no assertion depends on specific logged payloads.
- **Test command**: `apps/api/package.json` → `"test": "vitest run"`; canonical `make api-test` → `cd apps/api && bun run test` (Makefile:299–301). vitest 4.1.10. No vitest config file in the repo (defaults `**/*.test.ts`). Typecheck: `bun --filter @sonora/api typecheck`; lint: `bun --filter @sonora/api lint` (no-console rule; shared logger is the allowed target).

## 4. Redaction/sanitization utilities

**None for logging.** Search for redact/sanitize/allowlist/sensitive found only: prototype-pollution key sanitization (`apps/api/src/scripts/sync-helpers.ts` `setNested`), admin login char sanitization (`apps/admin`), mobile device-ID hashing, and problem-details 5xx detail sanitization. No shared redaction helper, no log allowlist helper.

## 5. Issue #390 / sensitive-data policy

- **No reference to #390 anywhere in repo content** (grep "390" → only git hashes / bun.lock false positives). No security-policy doc exists in-repo. Closest: `docs/admin_auth_architecture.md` (CodeQL `js/clear-text-storage-of-sensitive-data` remediation — client-side memory, not logging).
- No OpenTelemetry/span-attribute code found in apps/api — the repo's only observability is console logging via the shared logger. The "span attributes and logs share the same rules" requirement from #390 has no in-repo counterpart; the proposal must define the allowlist policy itself.
- Spec precedent: `openspec/specs/api/spec.md` (~line 107) REQUIRES invalid-signature warn logs with `ts`, `x-request-id`, `data.id`, reason — a deliberate bounded allowlist. `openspec/specs/logger/spec.md` defines the shared logger (4 levels, env-aware suppression, no-console rule).

## 6. Cloudflare Workers Logs consumption

- `apps/api/wrangler.toml` + `wrangler.staging.toml`: `[observability.logs] enabled = true, invocation_logs = true` → console output captured to Workers Logs (7-day retention).
- **No log drain / Logpush / Workers Logs export config found** (no logpush, no drain binding in any wrangler config).
- No structured logging schema: the shared logger prints `[INFO] msg, ...metadata`; Workers console renders args, but there is no enforced JSON schema.

## Adjacent logging surface (scope note for #390 shared rules)

- `apps/api/src/routes/payments.ts`: line 132 `[PAYMENTS] Creating payment checkout` logs `receivedRedirectUrl` (may carry query params); line 250 `[WEBHOOK] Updating purchase status & preserving metadata` logs `existingMeta`/`incomingMeta`/`mergedMetadata` (webhook metadata; may include buyer email/redirectUrl).
- `apps/api/src/payments/mercadopago.ts` lines 93–104: invalid-signature warn (spec-required fields) + staging bypass warn.
- `apps/api/src/middleware/problem-details.ts:199`: `logger.error(\`[${err.code}] ${logDetail}\`)` — server-side only, caller-provided.
- `apps/api/src/routes/audio.ts:205`: error-only.

## Risks

1. Repo location: cwd is a placeholder; real repo at `/var/home/masch/dev/js/sonora`. Apply must target the real path.
2. `logger.test.ts` asserts current sensitive logging → rewrite ~7/8 tests in the same change.
3. `ENABLE_API_LOGGING` semantics: `!== 'false'` (ON by default). Redaction stops sensitive data regardless of the toggle; keep toggle behavior and secret-based Makefile targets. Note `__DEV__ === false` suppresses info in production builds, but Workers don't set `__DEV__` (no define found in wrangler.toml) → info logs DO reach Workers Logs today.
4. `HttpClient` is unused in production — the issue framing ("logs MP traffic") doesn't match current wiring; proposal should state true scope: middleware = live leak; http-client = dormant risk with tests.
5. Query strings: `c.req.url` and `baseUrl + path` include query → strip query from message AND metadata.
6. Response buffering (stream-integrity reconstruction) must be preserved when removing body logging.
7. Adjacent surfaces (payments metadata logs, spec-required signature logs) are outside the 2-file scope but share the concern — proposal decides: shared redaction helper + apply, or explicit scope-out.
8. No shared redaction utility exists → new utility needed; placement decision (`packages/shared` vs `apps/api/src/lib`) belongs to proposal/design.

## Deliverables suggested for proposal (from issue #392 goals)

- Non-sensitive metadata only: method, path (no query), status, duration.
- No full header sets, no full bodies, no query strings, no secrets.
- Sampled/allowlisted fields for debugging.
- Keep `ENABLE_API_LOGGING` opt-out behavior.
- Tests asserting sensitive data never appears in logged output (both modules).
