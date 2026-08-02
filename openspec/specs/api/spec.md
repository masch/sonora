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
