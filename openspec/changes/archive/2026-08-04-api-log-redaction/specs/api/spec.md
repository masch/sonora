# Delta for api

## ADDED Requirements

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
