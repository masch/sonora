# Design: API Log Redaction

Change: `api-log-redaction`
Component: `apps/api` (Bun, Hono Workers, Vitest 4.1.10)
Status: designed
Depends on: `spec` (9 requirements, delta format), `proposal` (decisions RESOLVED 2026-08-04)

---

## 1. Context

The API persists sensitive data (auth headers, full bodies, query strings, redirect/webhook
metadata) to Cloudflare Workers Logs. The spec mandates a single shared redaction helper,
redacted middleware request/response logs, a query allowlist, a strict "sensitive data never
appears" invariant, the preserved `ENABLE_API_LOGGING` toggle, redacted `payments.ts`
surfaces, redacted (dormant) `HttpClient` logs, and a byte-for-byte unchanged invalid-signature
warn.

This design resolves the remaining implementation decisions (message URL form, helper
contract, buffering placement, exact call-site rewrites) and performs the **Part A body-field
allowlist inventory** over the real payloads that flow through the middleware.

---

## 2. Part A — Body-field allowlist inventory (REQUIRED audit)

All request/response bodies that flow through the middleware (mounted at `app.use('*',
customLogger())` in `src/index.ts`), classified against the invariant
("opaque IDs and status enums yes; URLs, emails, free text, nested metadata objects no").

### 2.1 Request bodies (JSON content-type only — form/multipart never extracted)

| Endpoint                       | Real top-level fields                                                             | Class                          | Decision                                                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `POST /payments/create`        | `experienceId` (uuid), `redirectUrl` (url, optional)                              | UUID / signed URL              | `experienceId` non-sensitive but **excluded** (see 2.4); `redirectUrl` **SENSITIVE — excluded**                          |
| `POST /payments/webhook`       | `type` ('payment'), `data` (nested `{id}`), `action` (string), passthrough extras | constant / nested / event name | `type` **IN allowlist**; `data` nested — never extracted; `action` **excluded** (redundant with `type`/`event`; see 2.4) |
| `POST /experiences/:id/access` | `source` (enum), `email` (PII), `platform` (enum)                                 | enum / PII / enum              | `email` **SENSITIVE — excluded**; `source`, `platform` **excluded** (see 2.4)                                            |
| `POST /audio/upload`           | multipart form (`file`, `key`)                                                    | binary + filename              | not JSON — never extracted                                                                                               |
| `POST /feedback`               | `FeedbackPostBodySchema` (rating/comment/email class)                             | free text + PII                | nothing allowlisted → `{}`                                                                                               |
| `POST /api/translations/...`   | array of `{lang, key, value}`                                                     | free text content              | **array body** → nothing extracted                                                                                       |
| `GET /audio/stream`            | query only (`key`, `token` — JWT)                                                 | signed                         | query allowlist `{page,limit,sync}` — `key`/`token` **never logged**                                                     |

### 2.2 Response bodies

| Endpoint                                              | Real top-level fields                                                                               | Class                         | Decision                                                                                                                |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `POST /payments/create`                               | `purchaseId`, `checkoutUrl` (MP signed URL)                                                         | UUID / **SENSITIVE URL**      | `purchaseId` **IN**; `checkoutUrl` excluded                                                                             |
| `POST /payments/webhook`                              | `status: 'ok'`                                                                                      | constant                      | `status` **IN**                                                                                                         |
| `GET /payments/status/:purchaseId`                    | `purchaseId`, `status`, `experienceId`, `provider`, `amount`, `currency`, **`email`**               | IDs/enums/money/PII           | `purchaseId`, `status` **IN**; `email` **PII — excluded**; `experienceId`/`provider`/`currency`/`amount` excluded (2.4) |
| `GET /payments/experiences/:id/purchased`             | `purchased` (bool), `purchase` (nested)                                                             | bool / nested                 | nested `purchase` never extracted; `purchased` excluded (2.4)                                                           |
| `GET /payments/purchases`                             | `purchases` (array)                                                                                 | array                         | **array body** → nothing extracted                                                                                      |
| `POST /experiences/:id/access`                        | `status: 'ok'`                                                                                      | constant                      | `status` **IN**                                                                                                         |
| `GET /experiences`                                    | array of experience objects incl. **signed `audioUrl`** (`?key=..&token=..`) and nested `waypoints` | array + signed URLs           | **array body** → nothing extracted (signed tokens never logged)                                                         |
| `GET /audio/upload` (201)                             | `success` (bool), `key`, `streamUrl` (URL)                                                          | bool / filename / URL         | all excluded (`streamUrl` URL, `key` filename)                                                                          |
| `GET /audio/stream`, `/audio/public/:key`             | binary `audio/mpeg` or problem JSON                                                                 | binary                        | not JSON → not buffered; problem `{code, detail, status, errors}` → only numeric `status` extracted                     |
| problem responses (all 4xx/5xx)                       | `code`, `detail`, `status`, `errors[]`                                                              | constant / free text / number | `status` **IN** (numeric HTTP code); `code`, `detail`, `errors` excluded (free text; `detail` may embed `err.message`)  |
| health / themes / config / translations / association | `{valid, cleared, updated, environment, ...}` etc.                                                  | booleans/free text            | nothing allowlisted → `{}`                                                                                              |

### 2.3 Definitive allowlist (locked)

```
BODY_FIELD_ALLOWLIST = { purchaseId, status, event, providerPaymentId,
                         merchant_order_id, externalReference, type }
```

Justification per field, verified against real payloads:

- `purchaseId` — our UUID (`purchases.id`), also `externalReference` alias in webhook results. Opaque, non-sensitive.
- `status` — purchase-status enum, `'ok'` constant, or numeric HTTP code in problem bodies. Non-sensitive.
- `event` — `WebhookResult.event` (purchase-status enum after `mapWebhookEventToStatus`). Non-sensitive.
- `providerPaymentId` — MP payment ID, opaque numeric string. Non-sensitive (not a credential).
- `merchant_order_id` / `externalReference` — opaque MP/our identifiers present in webhook result data. Non-sensitive.
- `type` — `'payment'` in webhook bodies; static problem-type URI in problem bodies (constant per error class, API's own URL). Non-sensitive.

### 2.4 Evaluated-and-excluded fields (user confirmation requested — see Risks R-A)

Cleared by the invariant as non-sensitive, but **not** added to the allowlist (default is to
keep the spec-locked set; adding any of these requires user confirmation at tasks time):

- `experienceId` (uuid; real debugging value: joins payment logs to experiences) — **recommend keep excluded**, `purchaseId` suffices.
- `provider`, `currency` (enums) — safe but low value.
- `amount` (money value) — borderline purchase-value data — **recommend excluded**.
- `action` (webhook body event name) — redundant with `type`/`event`.
- `source`, `platform` (access enums), `purchased`, `success` (bools) — trivial.
- `code` (problem error-code string) — constant, but `status` already distinguishes error classes.
- `key` (bucket key/filename) — borderline; excluded.

Rule applied: **any field not clearly non-sensitive stays OUT; anything uncertain is
flagged, never silently included.**

---

## 3. Design decisions

### D1. Message URL form: query-stripped **absolute** URL (flagged)

Middleware messages use `sanitizeUrl(c.req.url)` → `http://localhost/test` (origin+path, no
query), preserving the current message shape and matching the requirement text ("the request
URL with the query string stripped") and the HttpClient scenario
(`https://provider.example.com/api`, absolute). The spec scenarios that read `[API Request]
GET /test` and "the message path is /payments/status/123" are interpreted as shorthand for
"no query string in the message". **Risk item R-M1** asks the user to confirm this
interpretation (absolute) vs path-only messages.

### D2. Buffering placement: inside the toggle gate (buffer only when logging enabled)

The current early return `if (!enableLogging) { await next(); return; }` already wraps the
entire middleware including all buffering. This is exactly what the spec wants: toggle off →
zero buffering overhead, request passes through untouched. The redesign keeps this structure:
no buffering is hoisted outside the gate.

### D3. Response text/ bodies are no longer buffered at all

Current code buffers and reconstructs `text/*` bodies too. New behavior: only
`application/json` content-type responses are buffered+rebuilt; `text/*`/binary/HTML responses
are never read, so no reconstruction is needed and the stream is trivially undisturbed.
(Spec: "Non-JSON response bodies MUST NOT be logged"; audio `audio/mpeg` streams and range
responses are therefore never touched.)

### D4. Error arguments are sanitized to name-only

The shared logger (`packages/shared/src/utils/logger.ts`) is variadic and prints every
argument (`console.log('[WARN]', msg, err)`); Workers serializes Error objects including
`message`/`stack`, which can embed client-supplied URLs. Any warn/error path reachable from
client input (URL parse failures, body-read failures, referer parse failures, outbound fetch
errors incl. `HttpError.message` which embeds response text) passes only
`{ error: err.name }` (+ `status` for `HttpError`) instead of the raw error object. Internal
DB/SDK errors with no client-input reachability (e.g. `Active payment status fallback check
failed`, `Failed to read purchase metadata`) keep the current `{ error }` shape — flagged in
R-M2.

---

## 4. Helper API — `apps/api/src/lib/log-redaction.ts` (new file)

Sole source of truth for the policy. Exports the allowlist constants + 4 functions.

```ts
export const HEADER_ALLOWLIST = new Set(['content-type', 'user-agent', 'x-request-id']);
export const QUERY_ALLOWLIST = new Set(['page', 'limit', 'sync']);
export const BODY_FIELD_ALLOWLIST = new Set([
  'purchaseId',
  'status',
  'event',
  'providerPaymentId',
  'merchant_order_id',
  'externalReference',
  'type',
]);
export const UNPARSEABLE_URL = '<unparseable>';
export const UNPARSEABLE_BODY = '<unparseable-body>';
```

### `sanitizeUrl(url: string): string`

```ts
export function sanitizeUrl(url: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url); // absolute (http/https OR custom scheme)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return `${parsed.origin}${parsed.pathname}`; // origin+path; query+hash+userinfo dropped
    }
    // custom scheme (e.g. sonora://app/return/success/uuid): keep scheme+host+path
    return parsed.host
      ? `${parsed.protocol}//${parsed.host}${parsed.pathname}`
      : `${parsed.protocol}${parsed.pathname}`;
  } catch {
    // Not absolute: relative path or garbage
    const stripped = url.split('?')[0].split('#')[0];
    return url.startsWith('/') ? stripped : UNPARSEABLE_URL;
  }
}
```

Edge cases covered:

- Absolute http(s) with query → `origin + pathname` (`https://api.example.com/audio/play?deviceId=…&url=…` → `https://api.example.com/audio/play`).
- Query-less URL → unchanged (origin+pathname equals input for plain http(s) URLs without trailing slash differences — normalize to origin+pathname always, so `https://x/p` stays `https://x/p`).
- URL-embedded signed sub-URL (`?url=https%3A…%3Ftoken%3Dxyz`) → whole query dropped, token never logged.
- Userinfo (`https://user:pass@host/p`) → `URL.origin` excludes userinfo → `https://host/p`.
- Custom scheme `sonora://app/return/success/uuid?extra=1` → `sonora://app/return/success/uuid` (scheme+host+path, query dropped). Covers `PAYMENT_ROUTES.nativeRedirect` output in payments.ts.
- Scheme without host (`sonora:return/…`) → `sonora:return/…`.
- Relative path `/payments/status/123?email=x` → `/payments/status/123`.
- Unparseable garbage `not a url at all ?token=secret` → `'<unparseable>'` (raw input never returned; starts with neither `/` nor parseable).
- Empty string → `''` (no-op).

### `sanitizeHeaders(headers: Record<string, string>): Record<string, string>`

```ts
export function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (HEADER_ALLOWLIST.has(lower)) out[lower] = value;
  }
  return out; // canonical lowercase keys; only content-type, user-agent, x-request-id
}
```

Case-insensitive by lowercasing both sides; output keys canonical-lowercase for deterministic
test assertions. Multi-value headers arrive comma-joined from `Headers.entries()` — fine.

### `extractSafeBodyFields(body: unknown): Record<string, unknown>`

```ts
export function extractSafeBodyFields(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const out: Record<string, unknown> = {};
  for (const key of BODY_FIELD_ALLOWLIST) {
    if (!(key in body)) continue;
    const value = (body as Record<string, unknown>)[key];
    out[key] =
      typeof value === 'object' && value !== null
        ? Array.isArray(value)
          ? '<array>'
          : '<object>'
        : value;
  }
  return out;
}
```

- Top-level only; nested objects are never traversed.
- Array bodies (`translations` bulk, `experiences` list, `purchases` list) → `{}`.
- Non-object JSON (`'123'`, `'"str"'`, `null`) → `{}`.
- Non-scalar values at allowlisted keys (defense against weird payloads where e.g. `status`
  is an object) → replaced with `<object>` / `<array>` type markers, never serialized.
- Scalars pass through (`purchaseId`, `status`, `event`, …), `null` passes through, `undefined`/missing keys are omitted.

### `sanitizeQuery(query: Record<string, string>): Record<string, string>`

```ts
export function sanitizeQuery(query: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (QUERY_ALLOWLIST.has(key)) out[key] = value;
  }
  return out; // exactly { page?, limit?, sync? }
}
```

Covers `data.id`, `email`, `deviceId`, `token`, `key`, `url`, `extra` and every other query
param being omitted from logged metadata.

---

## 5. Middleware redesign — `apps/api/src/middleware/logger.ts`

### 5.1 Structure (gate wraps everything, including buffering — D2)

```ts
export const customLogger = (): MiddlewareHandler => {
  return async (c, next) => {
    const enableLogging = c.env?.ENABLE_API_LOGGING !== 'false'; // unchanged semantics
    if (!enableLogging) {
      await next();
      return;
    } // pass-through, zero overhead

    const method = c.req.method;
    const sanitizedUrl = sanitizeUrl(c.req.url); // D1: origin+path
    const startTime = Date.now();

    // ── Request side ──────────────────────────────────────────────
    const contentType = c.req.header('content-type');
    const reqMeta: Record<string, unknown> = {
      headers: sanitizeHeaders(c.req.header() as Record<string, string>),
      query: sanitizeQuery(c.req.query()),
    };

    if (contentType && contentType.includes('application/json') && c.req.raw.body) {
      try {
        const clonedReq = c.req.raw.clone(); // required: clone before read
        const raw = await clonedReq.text();
        try {
          reqMeta.body = extractSafeBodyFields(JSON.parse(raw)); // allowlisted fields only
        } catch {
          reqMeta.body = UNPARSEABLE_BODY; // omit marker, never raw text
        }
      } catch (e) {
        logger.warn(`Failed to read request body for logging: ${method} ${sanitizedUrl}`, {
          error: e instanceof Error ? e.name : 'unknown',
        }); // sanitized URL + name-only error
      }
    }
    logger.info(`[API Request] ${method} ${sanitizedUrl}`, reqMeta);

    // ── Response side ─────────────────────────────────────────────
    await next();
    const duration = Date.now() - startTime;

    const resMeta: Record<string, unknown> = { status: c.res.status };
    const resContentType = c.res.headers.get('content-type');
    if (c.res.body && resContentType && resContentType.includes('application/json')) {
      try {
        const bodyBytes = await c.res.arrayBuffer(); // buffer exactly once
        try {
          const text = new TextDecoder().decode(bodyBytes);
          resMeta.body = extractSafeBodyFields(JSON.parse(text));
        } catch {
          // JSON content-type but unparseable text: no body fields logged
        }
        c.res = new Response(bodyBytes, c.res); // rebuild: status/headers copied, byte-identical body
      } catch (e) {
        logger.warn('Failed to buffer response body for logging', {
          error: e instanceof Error ? e.name : 'unknown',
        });
      }
    }
    logger.info(
      `[API Response] ${method} ${sanitizedUrl} - ${c.res.status} (${duration}ms)`,
      resMeta,
    );
  };
};
```

### 5.2 Key mechanics

- **Request buffering** via `c.req.raw.clone()` before any read — handler stream untouched
  (same pattern as today). Non-JSON content types and body-less requests skip buffering and
  the `body` key is omitted entirely.
- **Malformed JSON** → `body: '<unparseable-body>'`; the raw text never enters any log call
  (spec scenario 4).
- **Response rebuild** — `new Response(bodyBytes, c.res)` copies `status`/`statusText`/
  `headers` from the original and installs a fresh stream over the exact buffered bytes
  (`ArrayBuffer`), preserving byte identity for the real network client (guarded by the
  real-node-server test). Reconstruction happens **regardless of JSON parse outcome** once
  bytes are buffered — a JSON-content-type response with unparseable text is still delivered
  byte-identical, just with no body fields logged.
- **Non-JSON responses** (`text/html`, `audio/mpeg`, redirects/204 with null body, raw
  `Response('raw-content')`) are never buffered and never reconstructed — stream untouched,
  `body` key omitted.
- **Warn paths** embed `sanitizedUrl` (query-stripped) and pass name-only error info (D4);
  the old behavior of passing the raw `Error` object is removed.
- **Metadata shape** is exact and test-friendly:
  - Request: `{ headers, query }` or `{ headers, query, body }`.
  - Response: `{ status }` or `{ status, body }`.

---

## 6. Payments.ts transformations — exact call sites

Import `sanitizeUrl` from `../lib/log-redaction`.

| #   | Current log                                                                                                                                       | New log                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `[PAYMENTS] Creating payment checkout` `{ purchaseId, experienceId, receivedRedirectUrl: redirectUrl }`                                           | `{ purchaseId, experienceId, receivedRedirectUrl: redirectUrl ? sanitizeUrl(redirectUrl) : undefined }` — query stripped (origin+path)                                                                                                                                                     |
| 2   | `[WEBHOOK] Updating purchase status & preserving metadata` `{ purchaseId, newStatus, existingMeta, incomingMeta, mergedMetadata }` (full objects) | `{ purchaseId: result.externalReference, newStatus, existingMetadataPresent: Object.keys(existingMeta).length > 0, incomingMetadataPresent: Object.keys(incomingMeta).length > 0, mergedMetadataCount: Object.keys(mergedMetadata).length }` — presence flags/count only; no object values |
| 3   | `[PAYMENTS] Return endpoint loaded purchase metadata` `{ purchaseId, status, foundPurchase, metadata: purchase?.metadata }` (full object)         | `{ purchaseId, status, foundPurchase: !!purchase, hasMetadata: !!(purchase?.metadata && Object.keys(purchase.metadata).length > 0) }` — presence flag only                                                                                                                                 |
| 4   | `[PAYMENTS] Failed to parse targetUrl in return endpoint, falling back` `{ purchaseId, status, rawRedirectUrl: meta.redirectUrl, error }`         | `{ purchaseId, status, rawRedirectUrl: sanitizeUrl(meta.redirectUrl), error: error instanceof Error ? error.name : 'unknown' }` (name-only error, D4)                                                                                                                                      |
| 5   | `[PAYMENTS] Return endpoint redirecting` `{ purchaseId, status, rawRedirectUrl: meta.redirectUrl, finalTargetUrl: targetUrl }`                    | both `sanitizeUrl(...)` — `rawRedirectUrl` and `finalTargetUrl` origin+path only; custom-scheme `sonora://…` preserved scheme+host+path                                                                                                                                                    |
| 6   | `[PAYMENTS] Return endpoint targetUrl resolved to empty…` `{ purchaseId, status, rawRedirectUrl: meta.redirectUrl }`                              | `rawRedirectUrl: sanitizeUrl(meta.redirectUrl)`                                                                                                                                                                                                                                            |
| 7   | `[PAYMENTS] Failed to parse Referer header in return endpoint` `{ referer, error }` (raw header value!)                                           | `{ purchaseId, status, refererOrigin: sanitizeUrl(referer), error: error instanceof Error ? error.name : 'unknown' }` — never the raw header                                                                                                                                               |
| 8   | `[PAYMENTS] Return endpoint falling back to referer origin` `{ purchaseId, status, refererOrigin: url.origin }`                                   | **unchanged** — already origin-only (spec scenario satisfied as-is)                                                                                                                                                                                                                        |
| 9   | `[PAYMENTS] Return endpoint falling back to default callback URL` `{ purchaseId, status, defaultFallbackUrl }`                                    | `defaultFallbackUrl: sanitizeUrl(defaultFallbackUrl)` — built from `${baseUrl}${PAYMENT_ROUTES.CALLBACK}`; baseUrl is `new URL(c.req.url).origin` (already query-free) but sanitize for defense-in-depth                                                                                   |

**Deliberately untouched:**

- `[WEBHOOK] Duplicate notification` and `[METRIC:invalid_webhook_transition_total]` — already
  log only `purchaseId`, `providerPaymentId`, `event`, `status`(class), `'x-request-id'`,
  `reason` — all allowlist-class identifiers, non-sensitive. No change.
- `[WEBHOOK] Missing external_reference in webhook result` — `providerPaymentId` + `event`
  only — non-sensitive. No change.
- `[PAYMENTS] Failed to parse request URL origin for backUrls` / `for return fallback` —
  `{ error }` where the parse input is `c.req.url` (server-owned, always parseable); error is
  not client-supplied input. Keep, but for consistency apply name-only error (cheap).
- `Active payment status fallback check failed:` — MP SDK error, no client-input reachability
  (payment IDs are opaque) — kept as-is (R-M2).
- `[PAYMENTS] Failed to read purchase metadata for return redirect` — DB error, no
  client-input reachability — kept as-is (R-M2).
- The **invalid-signature warn in `src/payments/mercadopago.ts` (lines 93–98)** —
  `logger.warn('[METRIC:invalid_signature_total] Invalid signature', { ts, 'x-request-id',
'data.id', reason })` — **byte-for-byte unchanged**; `mercadopago.test.ts` untouched.

`webhook` route still reads `data.id` from the query string for signature validation
(`c.req.query('data.id')`); only the _logging_ excludes it. `detectProviderFromPayload`,
`provider.createCheckout`, `processWebhook` network/SDK behavior: unchanged.

---

## 7. HttpClient changes — `apps/api/src/lib/http-client.ts`

Log-only changes; network behavior (fetch call, merged headers, body string, HttpError
throwing) untouched. Import `sanitizeUrl` and `sanitizeHeaders`.

```ts
// request log — headers: allowlisted only; body: NEVER logged
logger.info(`[HTTP Request] ${method} ${sanitizeUrl(url)}`, {
  headers: sanitizeHeaders(headers),
});

// response log — status only; response text NEVER logged
logger.info(`[HTTP Response] ${method} ${sanitizeUrl(url)} - ${res.status} (${duration}ms)`, {
  status: res.status,
});

// response-text-read warn — name-only error (D4)
logger.warn('Failed to read response body text for logging:', {
  error: e instanceof Error ? e.name : 'unknown',
});

// error log — query-stripped URL in message; error name + status only (D4)
logger.error(`[HTTP Request Error] ${method} ${sanitizeUrl(url)} - Failed after ${duration}ms:`, {
  error: err instanceof Error ? err.name : 'unknown',
  status: err instanceof HttpError ? err.status : undefined,
});
```

Rationale for name-only error args: `HttpError.message` embeds the response body slice
(`HTTP ${status}: ${body.slice(0,200)}`) and fetch `TypeError` messages can embed the request
URL; both can carry tokens/PII, so the raw error is never a log argument. The `HttpError`
object itself still throws as today (programmatic surface, not a log surface).

---

## 8. Test plan

Command: `make api-test` → `cd apps/api && bun run test` (vitest run).

### 8.1 New helper unit tests — `apps/api/src/lib/__tests__/log-redaction.test.ts`

- `sanitizeUrl`: absolute w/ query (spec scenario incl. signed sub-URL), query-less unchanged,
  unparseable garbage → `'<unparseable>'` and raw input absent, relative path stripping,
  custom scheme `sonora://…`, empty string, userinfo stripping.
- `sanitizeHeaders`: exactly the 3 allowlisted (mixed casing input, e.g. `Authorization`,
  `authorization`), sensitive absent; empty input → `{}`.
- `extractSafeBodyFields`: spec scenario (`name`/`email`/nested `metadata` absent,
  `purchaseId`/`status` present); top-level only; nested object value at allowlisted key →
  `'<object>'`; array body → `{}`; non-object JSON → `{}`; `undefined`/`null`/`{}` no-op;
  `merchant_order_id`/`externalReference`/`type`/`event`/`providerPaymentId` pass through.
- `sanitizeQuery`: `{page, limit, sync}` only; `email`, `data.id`, `token` omitted.

### 8.2 Middleware test rewrite — `apps/api/src/middleware/__tests__/logger.test.ts`

Rewrite the ~7/8 assertions that assert sensitive logging; **keep the toggle test and the
real-node-server stream test unchanged**:

1. `logs GET requests without body` — response `body: 'ok'` assertion → `body` key absent
   (text/plain not JSON); keep request `body` absent; message stays
   `[API Request] GET http://localhost/test`.
2. `does not log when ENABLE_API_LOGGING is false` — **UNCHANGED** (toggle semantics).
3. `logs POST requests with valid JSON body` — payload now includes allowlisted fields
   (`{ name, email, purchaseId: 'uuid-1', status: 'pending' }`); assert request metadata body
   exactly `{ purchaseId: 'uuid-1', status: 'pending' }`, response body extraction likewise;
   assert `name`/`email` absent from serialized log calls.
4. `handles malformed JSON request body gracefully` — assert `body: '<unparseable-body>'` and
   `{invalid-json` absent from **all** log calls.
5. `handles non-JSON response bodies` — assert `body` key absent and the client still receives
   full `<h1>Hello</h1>` (in-app `app.request`, no real server needed since stream is untouched).
6. `handles request body read failures gracefully` — request URL now with query
   (`/error-body?token=abc`); assert warn message contains `POST http://localhost/error-body`
   (no query), `token=abc` absent, and the second arg is the name-only `{ error: 'Error' }`
   shape (not `expect.any(Error)`).
7. `handles raw Response objects gracefully` — assert `body` key absent (text/plain not
   buffered), response intact.
8. `does not disturb the response body stream for a real network client` — **UNCHANGED**
   (byte-identity guard). **Add** a variant route returning
   `{ checkoutUrl: 'https://pay.example.com/checkout?signed=token123', status: 'approved' }`
   and assert the client receives the full body (incl. the URL) while `token123` and
   `checkoutUrl` appear in no log call.

New negative-invariant tests (Requirement: sensitive data never appears — serialize
`vi.mocked(logger.info).mock.calls` + warn/error calls and assert absence):

- Auth header + cookie values absent from every log call.
- Query stripping: `/test?deviceId=abc123&email=buyer@example.com` → message
  `http://localhost/test`, `deviceId=abc123` absent.
- Allowlisted query params: `/experiences?page=2&limit=10&sync=true` → metadata query
  `{ page: '2', limit: '10', sync: 'true' }`.
- Unknown query params omitted: `/payments/status/123?email=..&data.id=987&deviceId=dev-1&token=abc`.
- Header allowlist scenario from the spec (authorization/cookie/x-api-key/x-device-id absent;
  exactly content-type/user-agent/x-request-id present).
- Signed URL token in query (`?url=https%3A…%3Ftoken%3Dsignedsecret`) → `signedsecret` absent.
- Non-JSON request body (`application/x-www-form-urlencoded`) → no body metadata.
- Response sensitive fields scenario (`checkoutUrl`/`token` absent; `providerPaymentId`/
  `status` present) — spec scenario.

### 8.3 HttpClient tests — `apps/api/src/__tests__/http-client.test.ts`

Add `vi.mock('@sonora/shared', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error:
vi.fn() } }))` (currently un-mocked) and:

- Request with `Authorization: Bearer outbound-secret` + body `{ email: 'buyer@example.com' }`
  → serialize all log calls: neither `outbound-secret` nor `buyer@example.com` appears;
  merged headers not logged (only `content-type` may appear).
- Response text containing `outbound-token-xyz` → response log metadata has `status` only;
  `outbound-token-xyz` absent; existing HttpError body-slice assertions on the _thrown_
  error remain valid (programmatic surface).
- Error URL `https://provider.example.com/api?client_secret=abc` → error log message URL is
  `https://provider.example.com/api`; `client_secret=abc` absent.
- Existing behavioral tests (mock fetch, 204, timeout, header merge) unchanged — assert they
  still pass (network behavior untouched).

### 8.4 Unchanged suites

- `mercadopago.test.ts` — invalid-signature warn assertions pass byte-for-byte (must not be
  modified).
- `payments.test.ts` — behavior-only spies (`mockImplementation` no-ops); verify no
  payload-dependent log assertions exist; no modification expected. If any assertion does
  depend on a logged URL/metadata value, it must be updated to the sanitized form — audit
  during apply.
- Schema tests, security-middleware-chain, etc. — untouched.

---

## 9. Edge cases

| Case                                                                     | Handling                                                                                                                                                   |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Non-JSON bodies (form, multipart, text)                                  | never buffered; `body` key omitted from logs; client stream untouched                                                                                      |
| Empty bodies (GET/204/redirects/`null` body)                             | `c.req.raw.body` null / `c.res.body` null → skipped                                                                                                        |
| Array bodies (`translations` bulk, `experiences` list, `purchases` list) | `extractSafeBodyFields` returns `{}` — signed `audioUrl` tokens inside never logged                                                                        |
| Deeply nested PII (webhook `data`, purchase `metadata`, waypoints)       | never traversed; top-level allowlist only; nested value at allowlisted key → `<object>`/`<array>` marker                                                   |
| Query in `backUrls`/`notificationUrl`                                    | these are **constructed** from `new URL(c.req.url).origin` + `PAYMENT_ROUTES` — query-free by construction; `sanitizeUrl` applied defensively where logged |
| Unparseable URLs                                                         | `'<unparseable>'` constant; raw input never returned                                                                                                       |
| Response already consumed / buffer failure                               | `arrayBuffer()` throws → name-only warn, `c.res` left as-is (pre-existing behavior; guarded by stream test)                                                |
| JSON content-type with non-JSON text                                     | bytes still buffered+rebuilt (byte-identity preserved); no body fields logged                                                                              |
| Custom-scheme URLs (`sonora://…`)                                        | scheme+host+path preserved, query dropped                                                                                                                  |
| `ENABLE_API_LOGGING: 'false'`                                            | early return before any buffering/logging; pass-through unchanged                                                                                          |
| Large bodies                                                             | only JSON bodies buffered; audio streams (audio/mpeg) and multipart uploads never buffered; JSON request/response bodies are small in this API             |
| `x-request-id` correlation                                               | retained in header allowlist (user decision) for both request logs and webhook logs                                                                        |

---

## 10. Risks and mitigations

| ID   | Risk                                                                                                                                                                                                                                                                                                                                | Mitigation                                                                                                                                                                                                           |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-A  | **Body-field allowlist additions need user confirmation** (Part A 2.4): `experienceId`, `provider`, `currency`, `amount`, `action`, `source`, `platform`, `purchased`, `success`, `code` are all evaluated-and-excluded; default keeps the spec-locked 7-field set. User must confirm exclusion (or request additions) before apply | ✅ **RESOLVED (user, 2026-08-04): lock the 7-field set.** Tasks phase locks the allowlist per this design; adding a field is a one-line constant change + helper test                                                |
| R-M1 | **Message URL form ambiguity**: spec scenarios read `GET /test` (path-only) but requirement text says "request URL with query stripped" and the HttpClient scenario is absolute. Design picks absolute (`http://localhost/test`)                                                                                                    | ✅ **RESOLVED (user, 2026-08-04): absolute URL without query.** Tasks locks message form to `[API Request] GET http://host/path`                                                                                     |
| R-2  | Redaction regression at future call sites                                                                                                                                                                                                                                                                                           | Shared helper is the only sanctioned path; negative "never appears" invariant tests                                                                                                                                  |
| R-3  | Response reconstruction breaks streams                                                                                                                                                                                                                                                                                              | Proven `new Response(bodyBytes, c.res)` pattern; real-node-server byte-identity test kept + new sensitive-payload variant                                                                                            |
| R-4  | Over-redaction loses debugging signal                                                                                                                                                                                                                                                                                               | Explicit allowlists preserve method/path/status/duration + safe headers/query/body fields; extend via helper, never raw logging                                                                                      |
| R-5  | Error objects leak URLs/PII via `message`/`stack`                                                                                                                                                                                                                                                                                   | D4: name-only error args on all client-input-reachable paths; raw errors kept only for internal DB/SDK paths with no client-input reachability ✅ **RESOLVED (user, 2026-08-04): name-only + keep 2 internal paths** |
| R-6  | `payments.test.ts` may have an un-audited payload-dependent log assertion                                                                                                                                                                                                                                                           | Apply-time audit: any such assertion updated to sanitized form; spies are otherwise no-ops                                                                                                                           |
| R-7  | Repo path hazard                                                                                                                                                                                                                                                                                                                    | Apply must target `/var/home/masch/dev/js/sonora`, not the session cwd                                                                                                                                               |

---

## 11. Files touched

| File                                                             | Change                                                                                       |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `apps/api/src/lib/log-redaction.ts`                              | **new** — helper + allowlist constants                                                       |
| `apps/api/src/lib/__tests__/log-redaction.test.ts`               | **new** — helper unit tests                                                                  |
| `apps/api/src/middleware/logger.ts`                              | redesign request/response logs (Section 5)                                                   |
| `apps/api/src/middleware/__tests__/logger.test.ts`               | rewrite ~7/8 assertions + new negative invariant tests; keep toggle + real-node-server tests |
| `apps/api/src/lib/http-client.ts`                                | log-only redaction (Section 7)                                                               |
| `apps/api/src/__tests__/http-client.test.ts`                     | add logger mock + negative assertions                                                        |
| `apps/api/src/routes/payments.ts`                                | 9 call-site transformations (Section 6)                                                      |
| `apps/api/src/payments/mercadopago.ts`                           | **no change** (invalid-signature warn byte-for-byte)                                         |
| `apps/api/src/__tests__/mercadopago.test.ts`, `payments.test.ts` | no change expected (audit payments.test.ts at apply)                                         |

Rollout: pure code change; no wrangler/config/secret changes; revert = revert commit.
