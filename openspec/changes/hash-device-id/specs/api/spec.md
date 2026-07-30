# Delta for API

Delta against `openspec/specs/api/spec.md`.

## ADDED Requirements

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

The existing `hashDeviceId()` function MUST remain exported from `apps/api/src/index.ts` for backward compatibility (used by tests and the migration script), but it MUST NOT be called inside `injectDeviceId()`.

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

The `devicePlatform` field is set by `injectDeviceId()` middleware from the `X-Device-Platform` header.

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
  // Invalid values are silently ignored — no rejection, just not set
}
```

Validation rules for `X-Device-Platform`:

| Condition                               | Action                                                  |
| --------------------------------------- | ------------------------------------------------------- |
| Header is missing (`undefined`)         | `devicePlatform` remains unset — optional, no rejection |
| Value is one of `ios`, `android`, `web` | Set `c.var.devicePlatform` to the value                 |
| Value is any other string               | Silently ignored — `devicePlatform` remains unset       |

Invalid platform values MUST NOT produce an error response — the header is advisory and optional for backward compatibility.

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

This allows a transition period where old clients send `platform` in the body while new clients send it in the header.

#### Scenario: Header platform is persisted

- GIVEN a request with `X-Device-Platform: android`
- AND `devicePlatform` is set by middleware
- WHEN `POST /payments/experiences/:id/access` runs
- THEN the inserted `experienceAccesses` record has `platform: "android"`

#### Scenario: Header takes precedence over body

- GIVEN a request with `X-Device-Platform: ios` (header)
- AND `body.platform: "android"` (body)
- WHEN `POST /payments/experiences/:id/access` runs
- THEN the inserted `experienceAccesses` record has `platform: "ios"` (header wins)

#### Scenario: No header falls back to body platform

- GIVEN a request with no `X-Device-Platform` header
- AND `body.platform: "web"` is provided
- WHEN `POST /payments/experiences/:id/access` runs
- THEN the inserted `experienceAccesses` record has `platform: "web"`

#### Scenario: No platform source leaves field null

- GIVEN a request with no `X-Device-Platform` header
- AND `body.platform` is `null` or absent
- WHEN `POST /payments/experiences/:id/access` runs
- THEN the inserted `experienceAccesses` record has `platform: null`

### Requirement: Platform persistence in purchase creation

The `POST /payments/create` route handler MUST persist the platform from `c.var.devicePlatform` into the `purchases` record.

The `platform` field in the `purchases.insert` values MUST be set to `c.var.devicePlatform` when available, or `'unknown'` when absent (since the column is NOT NULL with no default).

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

This ensures web clients can include `X-Device-Platform` in their requests without triggering CORS preflight failures.

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

## MODIFIED Requirements

No existing requirements in `openspec/specs/api/spec.md` are modified by this change. The existing version env vars, config response, webhook signature, and replay protection requirements are unaffected.

## REMOVED Requirements

No existing requirements are removed.
