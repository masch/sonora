# API Specification

## Requirements

### Requirement: Version environment variables

The API `Env` interface MUST include three optional bindings:

| Binding                | Type   | Default   | Description                              |
| ---------------------- | ------ | --------- | ---------------------------------------- |
| `MINIMUM_APP_VERSION`  | string | `"1.0.0"` | Minimum app version to enforce           |
| `BLOCK_OLDER_VERSIONS` | string | `"false"` | Enables blocking (parsed as boolean)     |
| `GRACE_PERIOD_DAYS`    | string | `"0"`     | Grace window in days (parsed as integer) |

Defaults MUST be defined in `wrangler.toml` under `[vars]` and MAY be overridden at runtime via Cloudflare dashboard env vars.

### Requirement: Version fields in config response

The `GET /config` endpoint MUST include an `appVersion` object in its response body.

- `minimumVersion` — string from `MINIMUM_APP_VERSION`
- `blockOlderVersions` — boolean parsed from `BLOCK_OLDER_VERSIONS`
- `gracePeriodDays` — integer parsed from `GRACE_PERIOD_DAYS`

The response SHALL satisfy the updated `RemoteConfigPayloadSchema`.

#### Scenario: Config endpoint returns appVersion section

- GIVEN env vars `MINIMUM_APP_VERSION=2.0.0`, `BLOCK_OLDER_VERSIONS=true`, `GRACE_PERIOD_DAYS=7`
- WHEN the client requests `GET /config`
- THEN the response body includes `appVersion: { minimumVersion: "2.0.0", blockOlderVersions: true, gracePeriodDays: 7 }`

#### Scenario: Missing env vars fall back to defaults

- GIVEN no version-related env vars are set in wrangler.toml
- WHEN the client requests `GET /config`
- THEN the response body includes `appVersion: { minimumVersion: "1.0.0", blockOlderVersions: false, gracePeriodDays: 0 }`

### Requirement: Webhook signature validation

The `processWebhook` method MUST validate the `X-Signature` header using HMAC-SHA256 before fetching payment details. Invalid signatures MUST throw a generic external error (`InvalidSignature`) and log detailed internal diagnostics at `warn` level.

The `X-Signature` format MUST be parsed as `ts=<timestamp>,v1=<hmac_hex>` where `ts` is a Unix timestamp in seconds. The message template for HMAC-SHA256 MUST be `id:{data.id_url};request-id:{x-request-id};ts:{ts};` where `data.id_url` = `data.id` in lowercase.

| Element       | Constraint                                                                                    |
| ------------- | --------------------------------------------------------------------------------------------- |
| Algorithm     | HMAC-SHA256 (via MP SDK's `WebhookSignatureValidator`, which uses `crypto.subtle` internally) |
| Key           | UTF-8 encoded `webhookSecret`                                                                 |
| Header source | `X-Signature` request header                                                                  |

#### Scenario: Valid signature processes webhook

- GIVEN a valid `X-Signature` header with matching HMAC-SHA256
- WHEN `processWebhook` receives the webhook payload
- THEN the method proceeds to fetch payment details and returns a `WebhookResult`

#### Scenario: Invalid HMAC rejects with generic error

- GIVEN an `X-Signature` header with mismatched HMAC
- WHEN `processWebhook` validates the signature
- THEN it throws `InvalidSignature` with a generic message (no HMAC details leaked externally)

#### Scenario: Missing or malformed X-Signature header

- GIVEN the request has no `X-Signature` header, or the header format is unparseable
- WHEN `processWebhook` attempts validation
- THEN it throws `InvalidSignature` and logs the raw header for debugging

### Requirement: Fail-fast configuration

The `MercadoPagoProvider` constructor MUST throw `TypeError` if `webhookSecret` is `undefined`, `null`, or an empty string. The factory export MUST NOT fall back to `""` — it MUST propagate the construction failure to startup.

#### Scenario: Missing secret throws at construction

- GIVEN no `MP_WEBHOOK_SECRET` env var is set
- WHEN `MercadoPagoProvider` is constructed with `webhookSecret` as `undefined` or `""`
- THEN the constructor throws `TypeError` with a message indicating the secret is required

#### Scenario: Factory with missing env var fails fast

- GIVEN `MP_WEBHOOK_SECRET` is unset in the environment
- WHEN the factory function creates `MercadoPagoProvider`
- THEN the factory does not construct the provider — it throws at initialization time

### Requirement: Replay protection

The `processWebhook` method MUST reject signatures whose `ts` (millisecond timestamp) falls outside a configurable max age window. The default window MUST be 5 minutes. The window period SHALL be configurable via a `signatureMaxAgeMinutes` parameter.

#### Scenario: Signature within time window is accepted

- GIVEN a valid `X-Signature` with `ts` less than 5 minutes old
- WHEN `processWebhook` validates the signature
- THEN the signature is accepted and processing continues normally

#### Scenario: Expired signature is rejected

- GIVEN a valid `X-Signature` with `ts` more than 5 minutes in the past
- WHEN `processWebhook` validates the signature
- THEN it throws `InvalidSignature` and logs the age discrepancy

#### Scenario: Future timestamp is rejected

- GIVEN a valid `X-Signature` with `ts` more than 5 minutes in the future (clock skew)
- WHEN `processWebhook` validates the signature
- THEN it throws `InvalidSignature`

### Requirement: Metrics and logging on invalid signature

Every invalid signature attempt MUST be logged internally at `warn` level with: `ts` value, `x-request-id`, `data.id`, and failure reason. A metric counter (`invalid_signature_total`) MUST be incremented on every rejection.

#### Scenario: Invalid signature increments counter

- GIVEN a webhook request with an invalid `X-Signature`
- WHEN the validation fails
- THEN the `invalid_signature_total` counter is incremented by exactly 1

#### Scenario: Log contains diagnostic details

- GIVEN a webhook request with an invalid `X-Signature`
- WHEN the validation fails
- THEN the log entry includes `ts`, `x-request-id`, `data.id`, and the specific failure reason

### Requirement: Device ID pass-through middleware

The `injectDeviceId()` middleware MUST stop SHA-256 hashing the incoming `X-Device-Id` header value. The client is now responsible for sending a pre-hashed value. The middleware MUST validate the incoming value and pass it through as-is to `c.var.deviceId`.

Type signature (unchanged):

```typescript
export const injectDeviceId = (): MiddlewareHandler<{ Bindings: Env; Variables: Variables }>
```

#### Validation rules (applied in order, first match wins)

| Priority | Condition                                                                                     | Action                                             | Error Code          |
| -------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------- |
| 1        | Header is missing (`undefined`)                                                               | Pass through — `deviceId` remains unset downstream | —                   |
| 2        | Value is empty string `""`                                                                    | Reject with 400                                    | `INVALID_DEVICE_ID` |
| 3        | Value is whitespace-only (matches `rawDeviceId.trim().length === 0` when original length > 0) | Reject with 400                                    | `INVALID_DEVICE_ID` |
| 4        | Value length > 256 characters                                                                 | Reject with 400                                    | `INVALID_DEVICE_ID` |
| 5        | Non-empty, ≤256 chars, not whitespace-only                                                    | Set `c.var.deviceId` to value as-is (NO hashing)   | —                   |

#### Scenario: Pre-hashed 64-char hex value passes through

- GIVEN a request with `X-Device-Id: a6896270a62b75eaa63ba4724c236adc366bd774d53a252437d0759ca314058b`
- WHEN `injectDeviceId()` runs
- THEN the middleware validates the header (non-empty, ≤256 chars)
- AND `c.var.deviceId` is set to `"a6896270a62b75eaa63ba4724c236adc366bd774d53a252437d0759ca314058b"` (NOT double-hashed)
- AND the middleware calls `next()`

#### Scenario: Missing header passes through for downstream guard

- GIVEN a request with no `X-Device-Id` header
- WHEN `injectDeviceId()` runs
- THEN the middleware does NOT reject
- AND `c.var.deviceId` remains unset (`undefined`)
- AND a downstream `deviceIdGuard()` on the route will reject with `DEVICE_ID_REQUIRED`

#### Scenario: Empty string is rejected

- GIVEN a request with `X-Device-Id: ""`
- WHEN `injectDeviceId()` runs
- THEN the middleware returns 400 with `code: "INVALID_DEVICE_ID"` and `detail: "The X-Device-Id header must not be empty."`
- AND `next()` is NOT called

#### Scenario: Whitespace-only is rejected

- GIVEN a request with `X-Device-Id: "   "`
- WHEN `injectDeviceId()` runs
- THEN the middleware returns 400 with `code: "INVALID_DEVICE_ID"`
- AND `next()` is NOT called

#### Scenario: Overly long value is rejected

- GIVEN a request with `X-Device-Id` containing 257 characters
- WHEN `injectDeviceId()` runs
- THEN the middleware returns 400 with `code: "INVALID_DEVICE_ID"` and `detail: "The X-Device-Id header must be 256 characters or fewer."`
- AND `next()` is NOT called

#### Scenario: Existing tests pass with updated expectations

- GIVEN the existing `device-id.test.ts` tests
- WHEN `injectDeviceId()` processes a valid header
- THEN `c.var.deviceId` is the raw header value (not hashed)
- AND test assertions are updated to expect the raw value instead of the SHA-256 hash

### Requirement: Device platform variable type

The `Variables` interface in `apps/api/src/index.ts` MUST include a new optional `devicePlatform` field:

```typescript
export interface Variables {
  db: DbClient;
  deviceId: string;
  devicePlatform?: 'ios' | 'android' | 'web';
  // ... existing fields
}
```

### Requirement: Device platform header injection in middleware

The `injectDeviceId()` middleware MUST also read the `X-Device-Platform` header and set `c.var.devicePlatform`:

```typescript
// Inside injectDeviceId middleware:
const platformHeader = c.req.header('X-Device-Platform');
if (platformHeader !== undefined) {
  const validPlatforms = ['ios', 'android', 'web'] as const;
  if (validPlatforms.includes(platformHeader as (typeof validPlatforms)[number])) {
    c.set('devicePlatform', platformHeader as 'ios' | 'android' | 'web');
  }
}
```

| Condition                               | Action                                                  |
| --------------------------------------- | ------------------------------------------------------- |
| Header is missing (`undefined`)         | `devicePlatform` remains unset — optional, no rejection |
| Value is one of `ios`, `android`, `web` | Set `c.var.devicePlatform` to the value                 |
| Value is any other string               | Silently ignored — `devicePlatform` remains unset       |

Invalid platform values MUST NOT produce an error response.

#### Scenario: Device platform is set from header

- GIVEN a request with `X-Device-Platform: ios`
- WHEN `injectDeviceId()` runs
- THEN `c.var.devicePlatform` is set to `"ios"`

#### Scenario: Missing platform header leaves variable unset

- GIVEN a request with no `X-Device-Platform` header
- WHEN `injectDeviceId()` runs
- THEN `c.var.devicePlatform` remains `undefined`
- AND the request proceeds normally

#### Scenario: Invalid platform value is silently ignored

- GIVEN a request with `X-Device-Platform: windows`
- WHEN `injectDeviceId()` runs
- THEN `c.var.devicePlatform` remains `undefined`
- AND no error is returned
- AND the request proceeds normally

### Requirement: Platform persistence in experience access logging

The `POST /payments/experiences/:id/access` route handler MUST use `c.var.devicePlatform` (set by middleware from the `X-Device-Platform` header) as the `platform` value when inserting into `experienceAccesses`.

The header value takes precedence over the body field when both are present. When the header is absent, the route MUST fall back to the body's `platform` field (existing behavior).

#### Scenario: Header platform is persisted

- GIVEN a request with `X-Device-Platform: android`
- AND `devicePlatform` is set by middleware
- WHEN `POST /payments/experiences/:id/access` runs
- THEN the inserted `experienceAccesses` record has `platform: "android"`

#### Scenario: Header takes precedence over body

- GIVEN a request with `X-Device-Platform: ios` (header)
- AND `body.platform: "android"` (body, legacy field)
- WHEN `POST /payments/experiences/:id/access` runs
- THEN the inserted `experienceAccesses` record has `platform: "ios"` (header wins; body is ignored)

### Requirement: Platform persistence in purchase creation

The `POST /payments/create` route handler MUST persist the platform from `c.var.devicePlatform` into the `purchases` record.

#### Scenario: Platform is stored on purchase creation

- GIVEN a request with `X-Device-Platform: ios`
- WHEN `POST /payments/create` runs
- THEN the created `purchases` record includes `platform: "ios"`

#### Scenario: No platform header, purchase defaults to 'unknown'

- GIVEN a request with no `X-Device-Platform` header
- WHEN `devicePlatform` is `undefined`
- AND the route handler sets `platform: 'unknown'`
- THEN the created `purchases` record has `platform: 'unknown'`

### Requirement: CORS support for `X-Device-Platform` header

The `X-Device-Platform` header MUST be added to the `DEFAULT_HEADERS` array in `apps/api/src/middleware/cors.ts`.

```typescript
const DEFAULT_HEADERS = [
  'Content-Type',
  'Authorization',
  'Range',
  'Cache-Control',
  'Pragma',
  'X-Device-Id',
  'X-Device-Platform', // ADDED
  'X-Signature',
  'X-Timestamp',
  'X-Nonce',
  'Retry-After',
];
```

#### Scenario: Web client CORS preflight includes x-device-platform

- GIVEN the web client sends an OPTIONS preflight request
- AND `Access-Control-Request-Headers` includes `x-device-platform`
- WHEN `configureCors()` processes the request
- THEN the response `Access-Control-Allow-Headers` includes `x-device-platform`
- AND the preflight succeeds (200 or 204)

#### Scenario: ALLOWED_HEADERS env var includes the new header

- GIVEN `ALLOWED_HEADERS` is set as an environment variable (overriding defaults)
- WHEN CORS is configured
- THEN the custom `ALLOWED_HEADERS` list is used as-is
- AND `X-Device-Platform` MUST be present in that list for web clients to work

### Requirement: Shared log redaction helper

The API MUST provide a single shared redaction helper at `apps/api/src/lib/log-redaction.ts` that is the sole source of truth for the logging redaction policy: the header allowlist, the query-param allowlist, the safe body-field allowlist, and URL sanitization. No call site MAY implement ad-hoc redaction outside this helper.

The helper MUST expose at least three functions:

- `sanitizeUrl(url: string): string` — returns the URL with the query string removed (origin + path for absolute URLs; path only for relative strings). URLs that cannot be parsed MUST be reduced to a non-sensitive fallback (e.g. `<unparseable>`), never the raw input.
- `sanitizeHeaders(headers: Record<string, string>): Record<string, string>` — returns only the allowlisted headers, matched case-insensitively.
- `extractSafeBodyFields(body: unknown): Record<string, unknown>` — returns only explicitly allowlisted top-level fields; nested fields are NEVER extracted.

#### Scenario: sanitizeUrl strips the query string

- GIVEN the URL `https://api.example.com/audio/play?deviceId=abc123&url=https%3A%2F%2Fsigned.example.com%2Fa.mp3%3Ftoken%3Dxyz`
- WHEN `sanitizeUrl` is called
- THEN it returns `https://api.example.com/audio/play` (query string removed)

#### Scenario: sanitizeUrl leaves query-less URLs unchanged

- GIVEN the URL `https://api.example.com/payments/status/123`
- WHEN `sanitizeUrl` is called
- THEN it returns the URL unchanged

#### Scenario: sanitizeUrl falls back safely on unparseable input

- GIVEN the input `not a url at all ?token=secret`
- WHEN `sanitizeUrl` is called
- THEN it returns a non-sensitive fallback value
- AND the raw input does not appear in the result

#### Scenario: sanitizeHeaders returns only the allowlisted headers

- GIVEN a header set containing `content-type`, `user-agent`, `x-request-id`, `authorization`, `cookie`, `x-api-key`, and `x-device-id`
- WHEN `sanitizeHeaders` is called
- THEN the result contains exactly `content-type`, `user-agent`, and `x-request-id`
- AND `authorization`, `cookie`, `x-api-key`, and `x-device-id` are absent

#### Scenario: extractSafeBodyFields returns only allowlisted top-level fields

- GIVEN a body `{ name: 'masch', email: 'buyer@example.com', purchaseId: 'uuid-1', status: 'pending', metadata: { redirectUrl: 'https://example.com/r?signed=1' } }`
- AND the body allowlist contains `purchaseId` and `status`
- WHEN `extractSafeBodyFields` is called
- THEN the result is exactly `{ purchaseId: 'uuid-1', status: 'pending' }`
- AND `name`, `email`, and the nested `metadata` object are absent

#### Scenario: Empty inputs no-op gracefully

- GIVEN an empty body (`undefined`, `null`, or `{}`), a URL with no query, and a header set with no allowlisted members
- WHEN the helper functions are called
- THEN they return empty/safe results without throwing

### Requirement: Middleware request log redaction

The `customLogger` middleware request log MUST emit a message of the form `[API Request] ${method} ${path}` where `path` is the request URL with the query string stripped. The log metadata MUST contain only: allowlisted headers (`content-type`, `user-agent`, `x-request-id`), allowlisted query params (`page`, `limit`, `sync`), and safe body fields extracted from JSON request bodies. Full header sets, full bodies, and query strings MUST NOT be logged.

For JSON request bodies, the middleware MUST buffer the stream via `c.req.raw.clone()`, parse the JSON, and log only the output of `extractSafeBodyFields`. Malformed JSON MUST be logged as a non-sensitive omit marker — never the raw body text. Non-JSON request bodies MUST NOT be logged. Warn paths that embed the request URL in their message MUST embed the sanitized (query-stripped) URL.

#### Scenario: Request URL with query string logs path only

- GIVEN a request to `GET /test?deviceId=abc123&email=buyer@example.com`
- WHEN the middleware logs the request
- THEN the message is `[API Request] GET /test` (no query string)

#### Scenario: Only allowlisted headers are logged

- GIVEN a request with headers `authorization: Bearer secret-token`, `cookie: session=abc`, `x-api-key: key123`, `x-device-id: dev-1`, `content-type: application/json`, `user-agent: SonoraApp/1.0`, and `x-request-id: req-123`
- WHEN the middleware logs the request
- THEN the metadata contains exactly `content-type`, `user-agent`, and `x-request-id`
- AND no `authorization`, `cookie`, `x-api-key`, or `x-device-id` value appears anywhere in the log call

#### Scenario: Request body logs only allowlisted fields

- GIVEN a JSON request body `{ name: 'masch', email: 'buyer@example.com', purchaseId: 'uuid-1', status: 'pending' }`
- WHEN the middleware logs the request
- THEN the metadata body is `{ purchaseId: 'uuid-1', status: 'pending' }`
- AND `name` and `email` do not appear anywhere in the log call

#### Scenario: Malformed JSON logs an omit marker

- GIVEN a JSON content-type request with an unparseable body `{invalid-json`
- WHEN the middleware logs the request
- THEN the log metadata contains a non-sensitive omit marker
- AND the raw text `{invalid-json` does not appear anywhere in the log call

#### Scenario: Non-JSON request body is not logged

- GIVEN a request with content-type `application/x-www-form-urlencoded` and a body containing form data
- WHEN the middleware logs the request
- THEN no body metadata is logged

#### Scenario: Request body read failure warn embeds sanitized URL

- GIVEN a request to `POST /submit?token=abc` whose body clone fails
- WHEN the middleware emits the body-read-failure warn
- THEN the warn message contains `POST /submit` (no query string)
- AND `token=abc` does not appear anywhere in the log call

### Requirement: Middleware response log redaction

The `customLogger` middleware response log MUST emit a message of the form `[API Response] ${method} ${path} - ${status} (${duration}ms)` where `path` is the request URL with the query string stripped. The metadata MUST contain the response `status` and MAY contain safe body fields extracted from JSON response bodies. Full response bodies (JSON or text) MUST NOT be logged.

When a JSON response body is present, the middleware MUST buffer it via `c.res.arrayBuffer()`, extract allowlisted fields, and reconstruct the response with `new Response(bodyBytes, c.res)` so the stream is undisturbed for the real network client. Non-JSON response bodies MUST NOT be logged.

#### Scenario: Sensitive response fields are not logged

- GIVEN a JSON response body `{ checkoutUrl: 'https://pay.example.com/checkout?signed=token123', token: 'jwt-abc', providerPaymentId: '123', status: 'approved' }`
- WHEN the middleware logs the response
- THEN the metadata body is exactly `{ providerPaymentId: '123', status: 'approved' }`
- AND `checkoutUrl` and `token` do not appear anywhere in the log call

#### Scenario: Response stream is undisturbed for a real network client

- GIVEN the middleware is mounted on a real node server
- AND a route returns `{ data: 'real-node-server-data' }` with JSON content type
- WHEN a real HTTP client requests the route
- THEN the client receives status 200 and the exact response body `{ data: 'real-node-server-data' }`

#### Scenario: Non-JSON response body is not logged

- GIVEN a response with content-type `text/html` and body `<h1>Hello</h1>`
- WHEN the middleware logs the response
- THEN no body metadata is logged
- AND the client still receives the full `<h1>Hello</h1>` body

### Requirement: Query parameter allowlist

Logged query parameters MUST be limited to exactly `page`, `limit`, and `sync`. All other query parameters MUST be omitted from logged output, including but not limited to `email`, `data.id`, `deviceId`, and token-bearing parameters. The query string MUST NEVER appear in any log message or metadata, regardless of the parameter names present.

#### Scenario: Allowlisted query params are logged

- GIVEN a request to `GET /experiences?page=2&limit=10&sync=true`
- WHEN the middleware logs the request
- THEN the metadata includes `{ page: '2', limit: '10', sync: 'true' }`

#### Scenario: Unknown query params are omitted

- GIVEN a request to `GET /payments/status/123?email=buyer@example.com&data.id=987&deviceId=dev-1&token=abc`
- WHEN the middleware logs the request
- THEN none of `email`, `data.id`, `deviceId`, or `token` appear anywhere in the log call
- AND the message path is `/payments/status/123` with no query string

### Requirement: Sensitive data never appears in logged output

With logging enabled, sensitive data MUST NEVER appear in any log message, metadata, or error argument produced by `apps/api` logging surfaces. Sensitive data includes: authorization header values, cookies, `x-api-key`, `x-device-id`, bearer tokens, session tokens, PII (emails, names, addresses), device IDs, signed or opaque URLs, query strings, full request/response bodies, and nested metadata objects. Automated tests MUST assert this negatively (e.g. serializing the logged output and asserting the sensitive values are absent).

#### Scenario: Auth header and cookie values are absent from all log calls

- GIVEN a request with `authorization: Bearer supersecret-token` and `cookie: session=supersecret-session`
- WHEN the middleware processes the request and response
- THEN serializing every logged message and metadata object contains neither `supersecret-token` nor `supersecret-session`

#### Scenario: Signed URL query token is absent from all log calls

- GIVEN a request URL containing a signed URL parameter `https://api.example.com/audio?url=https%3A%2F%2Fcdn.example.com%2Fa.mp3%3Ftoken%3Dsignedsecret`
- WHEN the middleware logs the request
- THEN the value `signedsecret` does not appear anywhere in the log call

### Requirement: ENABLE_API_LOGGING toggle semantics

The `ENABLE_API_LOGGING` environment toggle MUST retain its current semantics: logging is enabled unless the value is exactly the string `'false'` (`c.env?.ENABLE_API_LOGGING !== 'false'`; ON by default). When the toggle is off, the middleware MUST NOT emit any log call and MUST pass the request through to the handler unchanged. Log redaction MUST be applied unconditionally in all environments (dev = prod) whenever logging is enabled; there MUST be NO environment flag or setting that bypasses redaction.

#### Scenario: Default (unset) enables logging with redaction

- GIVEN no `ENABLE_API_LOGGING` env var
- WHEN a request with sensitive data is processed
- THEN request and response logs are emitted with redaction applied

#### Scenario: 'false' suppresses all logging

- GIVEN `ENABLE_API_LOGGING: 'false'`
- WHEN a request is processed
- THEN no log call (info, warn, or error) is made by the middleware
- AND the response to the client is unaffected

#### Scenario: Any non-'false' value keeps logging enabled and redacted

- GIVEN `ENABLE_API_LOGGING: 'true'` (or any value other than `'false'`)
- WHEN a request with sensitive data is processed
- THEN logs are emitted and redaction is applied

### Requirement: Payment redirect and webhook metadata redaction

The `payments.ts` route logs MUST NOT contain full redirect URLs, query strings, or webhook/purchase metadata objects. Redirect and target URLs (`receivedRedirectUrl`, `rawRedirectUrl`, `finalTargetUrl`, `defaultFallbackUrl`) MUST be logged with the query string stripped (origin + path only; never query). Webhook metadata objects (`existingMeta`, `incomingMeta`, `mergedMetadata`) and purchase metadata objects (e.g. `purchase.metadata` in the return endpoint) MUST NOT be logged whole; the logs MAY contain presence flags (e.g. whether metadata was present) and MUST retain `purchaseId`/`status`-class identifiers. The raw `Referer` header value MUST NOT be logged; only its parsed origin MAY be logged.

#### Scenario: receivedRedirectUrl query string is stripped

- GIVEN a checkout creation with `redirectUrl: 'https://app.example.com/experience/1?token=abc&email=buyer@example.com'`
- WHEN `[PAYMENTS] Creating payment checkout` is logged
- THEN `receivedRedirectUrl` in the metadata is `https://app.example.com/experience/1`
- AND `token=abc` and `buyer@example.com` do not appear anywhere in the log call

#### Scenario: Webhook metadata objects are never logged whole

- GIVEN a webhook update where `existingMeta` is `{ redirectUrl: 'https://app.example.com/r?signed=1', email: 'buyer@example.com' }` and `incomingMeta` contains payment metadata
- WHEN `[WEBHOOK] Updating purchase status & preserving metadata` is logged
- THEN `purchaseId` and `newStatus` are logged
- AND the metadata objects — or any nested value such as `signed=1` or `buyer@example.com` — do not appear anywhere in the log call
- AND presence/status flags are logged instead

#### Scenario: Return endpoint redirect logs strip query strings

- GIVEN a return redirect where `rawRedirectUrl` is `https://app.example.com/deep/link?deviceId=dev-1` and `finalTargetUrl` is `https://app.example.com/api/payments/return/success/uuid?extra=1`
- WHEN the return endpoint logs the redirect
- THEN the logged `rawRedirectUrl` and `finalTargetUrl` have no query string
- AND `deviceId=dev-1` and `extra=1` do not appear anywhere in the log call

#### Scenario: Purchase metadata is logged as presence only

- GIVEN a return endpoint load where `purchase.metadata` contains a redirect URL with a query string
- WHEN `[PAYMENTS] Return endpoint loaded purchase metadata` is logged
- THEN the metadata object is not logged whole
- AND only a presence flag (e.g. `foundPurchase` / `hasMetadata`) and `purchaseId`/`status` are logged

#### Scenario: Referer header is logged as origin only

- GIVEN a request with `Referer: https://app.example.com/some/path?token=abc`
- WHEN the return endpoint falls back to the referer origin
- THEN only `https://app.example.com` is logged
- AND the raw referer value does not appear anywhere in the log call

### Requirement: HttpClient outbound log redaction

The `HttpClient` MUST apply the same redaction policy to outbound logs, even though it has no production call sites. Request logs MUST NOT include merged headers or request bodies. Response logs MUST NOT include response text. Message URLs (request, response, and error) MUST be query-stripped.

#### Scenario: Outbound request headers and body are not logged

- GIVEN an `HttpClient` request with an `Authorization: Bearer outbound-secret` header and a JSON body `{ email: 'buyer@example.com' }`
- WHEN the request log is emitted
- THEN neither `outbound-secret` nor `buyer@example.com` appears anywhere in the log call

#### Scenario: Outbound response text is not logged

- GIVEN an outbound response whose text contains a token value `outbound-token-xyz`
- WHEN the response log is emitted
- THEN the metadata contains the status only
- AND `outbound-token-xyz` does not appear anywhere in the log call

#### Scenario: Outbound error URL is query-stripped

- GIVEN an outbound request to `https://provider.example.com/api?client_secret=abc`
- WHEN the request fails and the error log is emitted
- THEN the message URL is `https://provider.example.com/api`
- AND `client_secret=abc` does not appear anywhere in the log call

### Requirement: Invalid-signature warn log unchanged

The invalid-signature warn log in `apps/api/src/payments/mercadopago.ts` (`[METRIC:invalid_signature_total] Invalid signature`) MUST remain byte-for-byte equivalent to its current form, logging exactly `ts`, `x-request-id`, `data.id`, and `reason`. It is the sanctioned diagnostic exception: it MUST NOT be altered, redacted, or extended by this change, and MUST remain compliant with the canonical "Metrics and logging on invalid signature" requirement.

#### Scenario: Invalid-signature warn retains its exact diagnostic fields

- GIVEN a webhook request with an invalid `X-Signature`
- WHEN signature validation fails
- THEN `logger.warn` is called with the exact message `[METRIC:invalid_signature_total] Invalid signature` and metadata containing `ts`, `x-request-id`, `data.id`, and `reason`
- AND no additional sensitive values are introduced

#### Scenario: Invalid-signature warn tests pass unchanged

- GIVEN the existing `mercadopago.test.ts` assertions for the invalid-signature warn
- WHEN the redaction change is applied
- THEN those assertions still pass without modification

### Requirement: Workers Observability configuration

The API Worker MUST declare the full Cloudflare Workers Observability stack in its Wrangler configuration (`apps/api/wrangler.toml` for production, `apps/api/wrangler.staging.toml` for staging):

- The master flag `[observability] enabled = true` MUST be present — this is the flag that controls persistence of logs to the Cloudflare dashboard. Setting only `[observability.logs] enabled = true` without the master flag results in `observability.enabled = false` at the Worker API level and logs NOT being persisted to the dashboard (tail/real-time streaming still works).
- `[observability.logs]` MUST enable log collection (`enabled = true`) and MAY set `invocation_logs = true`.
- `[observability.traces]` MUST enable tracing (`enabled = true`) and MAY set a `head_sampling_rate` (default 1 = sample everything).

#### Scenario: master flag present persists dashboard logs

- GIVEN a Worker deployed with `[observability] enabled = true` in its Wrangler config
- WHEN the Worker settings are inspected via the Cloudflare API (`/workers/scripts/{name}/settings`)
- THEN `observability.enabled` is `true`
- AND the Cloudflare dashboard shows persisted logs for recent requests in the Observability → Logs view

#### Scenario: only logs block present does not persist dashboard logs

- GIVEN a Worker deployed with only `[observability.logs] enabled = true` (no master `[observability]` block)
- WHEN the Worker settings are inspected via the Cloudflare API
- THEN `observability.enabled` is `false` even though `observability.logs.enabled` is `true`
- AND `wrangler tail` still streams logs in real time, but the dashboard Logs view is empty

### Requirement: API log redaction documentation

The repository MUST document the API log-redaction flow in `docs/api_logging_redaction.md`, covering:

- The single source of truth: `apps/api/src/lib/log-redaction.ts` (header/query/body allowlists, `sanitizeUrl`).
- The request-side flow (middleware `apps/api/src/middleware/logger.ts`): sanitize URL, allowlist headers/query, clone-and-extract safe body fields.
- The response-side flow: buffer exactly once, extract safe body fields, rebuild with `new Response(bodyBytes, c.res)` (byte-identical for the real client).
- The `ENABLE_API_LOGGING` toggle semantics (`!== 'false'` → enabled by default; `'false'` → no buffering/logging).
- The invariant that sensitive data never appears in logged output, with the test files that enforce it.

The README MUST link this document from its Documentation section.

#### Scenario: README links the redaction doc

- GIVEN the repository README
- WHEN reading the Documentation section
- THEN it includes a link to `docs/api_logging_redaction.md`

#### Scenario: doc describes the response rebuild

- GIVEN `docs/api_logging_redaction.md`
- WHEN reading the response-side flow section
- THEN it states that the response body is buffered once and rebuilt with `new Response(bodyBytes, c.res)` preserving status/headers and exact bytes for the real client
