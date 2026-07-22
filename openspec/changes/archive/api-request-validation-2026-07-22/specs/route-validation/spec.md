# Route Validation Specification

## Purpose

Add runtime input validation to every API route that currently relies on TypeScript casts or ad-hoc checks, using `@hono/zod-validator` with `zValidator` and shared Zod schemas in `@sonora/shared`. Standardize all success and error responses using `problem()`, `success()`, and `created()` helpers.

## Requirements

### Requirement: @hono/zod-validator dependency

The `@sonora/api` package MUST declare `@hono/zod-validator` as a runtime dependency in `apps/api/package.json`.

#### Scenario: Dependency is installed

- GIVEN `apps/api/package.json`
- WHEN inspecting `dependencies`
- THEN `@hono/zod-validator` MUST be listed

### Requirement: Zod schemas in @sonora/shared

All request validation schemas MUST live in `@sonora/shared` and MUST be exported from the package's public API surface. No route file SHALL define inline Zod schemas for request validation.

#### Scenario: payment schemas exported

- GIVEN `packages/shared/src/schemas/payments.ts`
- WHEN importing from `@sonora/shared`
- THEN `CreatePaymentBodySchema`, `WebhookBodySchema`, `LogAccessBodySchema`, and `EmailQuerySchema` MUST be exported

#### Scenario: audio schemas exported

- GIVEN `packages/shared/src/schemas/audio.ts`
- WHEN importing from `@sonora/shared`
- THEN `AudioUploadBodySchema` MUST be exported

### Requirement: CreatePaymentBodySchema

The schema for `POST /payments/create` body MUST validate:

| Field          | Type     | Required | Constraint  |
| -------------- | -------- | -------- | ----------- |
| `experienceId` | `string` | yes      | UUID format |
| `redirectUrl`  | `string` | no       | URL format  |

#### Scenario: Valid payment create body passes validation

- GIVEN a request body `{"experienceId": "550e8400-e29b-41d4-a716-446655440000", "redirectUrl": "https://example.com/callback"}`
- WHEN the request is validated against `CreatePaymentBodySchema`
- THEN validation passes
- THEN the handler receives `experienceId` and `redirectUrl` via `c.req.valid('json')`

#### Scenario: Missing experienceId fails validation

- GIVEN a request body `{}`
- WHEN the request is validated against `CreatePaymentBodySchema`
- THEN validation fails with a `ZodError` including issue at path `"experienceId"`

#### Scenario: Invalid experienceId UUID fails validation

- GIVEN a request body `{"experienceId": "not-a-uuid"}`
- WHEN the request is validated against `CreatePaymentBodySchema`
- THEN validation fails with a `ZodError` including issue at path `"experienceId"`

#### Scenario: Invalid redirectUrl URL fails validation

- GIVEN a request body `{"experienceId": "550e8400-e29b-41d4-a716-446655440000", "redirectUrl": "not-a-url"}`
- WHEN the request is validated against `CreatePaymentBodySchema`
- THEN validation fails with a `ZodError` including issue at path `"redirectUrl"`

### Requirement: WebhookBodySchema

The schema for `POST /payments/webhook` body MUST validate the minimal webhook shape (Mercado Pago compatible).

| Field     | Type     | Required | Constraint |
| --------- | -------- | -------- | ---------- |
| `type`    | `string` | no       | —          |
| `data.id` | `string` | no       | —          |
| `action`  | `string` | no       | —          |

The schema MUST be permissive: optional fields exist to catch basic structural errors (e.g., non-JSON body) but do not reject unknown fields. The `data.id` query-param validation (for the URL) remains as-is in the handler and is NOT part of this schema.

#### Scenario: Valid webhook body passes validation

- GIVEN a request body `{"type": "payment", "data": {"id": "987654"}, "action": "payment.created"}`
- WHEN the request is validated against `WebhookBodySchema`
- THEN validation passes

#### Scenario: Invalid JSON body fails validation

- GIVEN a malformed request body (not valid JSON)
- WHEN `zValidator('json', WebhookBodySchema)` processes the request
- THEN the request fails before reaching the handler
- THEN the response is 422 with Problem Details format

### Requirement: LogAccessBodySchema

The schema for `POST /payments/experiences/:id/access` body MUST validate:

| Field      | Type                                 | Required | Constraint                            |
| ---------- | ------------------------------------ | -------- | ------------------------------------- |
| `source`   | `"free"` \| `"paid"` \| `"restored"` | yes      | MUST be one of `ACCESS_SOURCES`       |
| `email`    | `string`                             | no       | Valid email format if present         |
| `platform` | `"ios"` \| `"android"` \| `"web"`    | no       | MUST be one of `PLATFORMS` if present |

#### Scenario: Free source passes validation

- GIVEN a request body `{"source": "free", "email": "user@example.com", "platform": "ios"}`
- WHEN validated against `LogAccessBodySchema`
- THEN validation passes

#### Scenario: Invalid source fails validation

- GIVEN a request body `{"source": "invalid_source"}`
- WHEN validated against `LogAccessBodySchema`
- THEN validation fails with issue at path `"source"`

#### Scenario: Missing source fails validation

- GIVEN a request body `{"email": "user@example.com"}`
- WHEN validated against `LogAccessBodySchema`
- THEN validation fails with issue at path `"source"`

#### Scenario: Invalid email format fails validation

- GIVEN a request body `{"source": "free", "email": "not-an-email"}`
- WHEN validated against `LogAccessBodySchema`
- THEN validation fails with issue at path `"email"`

#### Scenario: null email passes validation

- GIVEN a request body `{"source": "free", "email": null}`
- WHEN validated against `LogAccessBodySchema`
- THEN validation passes (email is optional and nullable)

### Requirement: EmailQuerySchema

The schema for `GET /payments/experiences/:id/purchased` and `GET /payments/` query parameters MUST validate:

| Field   | Type     | Required | Constraint         |
| ------- | -------- | -------- | ------------------ |
| `email` | `string` | yes      | Valid email format |

#### Scenario: Valid email query passes

- GIVEN query string `?email=user@example.com`
- WHEN validated against `EmailQuerySchema`
- THEN validation passes

#### Scenario: Missing email query fails

- GIVEN a request with no query parameters
- WHEN validated against `EmailQuerySchema`
- THEN validation fails with issue at path `"email"`

#### Scenario: Invalid email format fails

- GIVEN query string `?email=not-email`
- WHEN validated against `EmailQuerySchema`
- THEN validation fails with issue at path `"email"`

### Requirement: AudioUploadBodySchema

The schema for `POST /audio/upload` multipart form data MUST validate:

| Field  | Type     | Required | Constraint                    |
| ------ | -------- | -------- | ----------------------------- |
| `file` | `File`   | yes      | MUST be an instance of `File` |
| `key`  | `string` | yes      | MUST be a non-empty string    |

The validator MUST use `zValidator('form', ...)` for multipart/form-data.

#### Scenario: Valid upload passes validation

- GIVEN a multipart form with a file and a non-empty key
- WHEN validated against `AudioUploadBodySchema` via `zValidator('form', ...)`
- THEN validation passes

#### Scenario: Missing file fails validation

- GIVEN a multipart form with only a `key` field
- WHEN validated against `AudioUploadBodySchema`
- THEN validation fails with issue at path `"file"`

#### Scenario: Missing key fails validation

- GIVEN a multipart form with only a `file` field
- WHEN validated against `AudioUploadBodySchema`
- THEN validation fails with issue at path `"key"`

#### Scenario: Empty key fails validation

- GIVEN a multipart form with a file and `key=""`
- WHEN validated against `AudioUploadBodySchema`
- THEN validation fails with issue at path `"key"`

### Requirement: Admin routes via middleware

The following routes SHALL use `requireAdminKey()` middleware INSTEAD of the `zValidator` for auth:

- `POST /audio/upload` — uses `requireAdminKey()` + `zValidator('form', AudioUploadBodySchema)`
- `PUT /api/translations` — uses `requireAdminKey()` + `zValidator('json', TranslationBulkPayloadSchema)` + `dbGuard()`
- `POST /api/translations/validate` — uses `requireAdminKey()` only (no body needed)

The `requireAdminKey()` middleware MUST be placed in the route handler's middleware chain. The exact ordering relative to `zValidator` MAY be either before or after, as both are stateless.

#### Scenario: Translations validate uses only requireAdminKey

- GIVEN the route definition for `POST /api/translations/validate`
- WHEN inspecting its middleware chain
- THEN `requireAdminKey()` MUST be present
- THEN NO `zValidator` MUST be present (the route accepts no body)

### Requirement: Feedback route validation

The `POST /feedback` route MUST replace its custom `validateBody()` helper with `zValidator('json', FeedbackPostBodySchema)`. The existing `FeedbackPostBodySchema` in `@sonora/shared` SHALL be reused. The custom `validateBody()` function MUST be removed.

The route handler MUST read the validated body from `c.req.valid('json')` instead of calling `c.req.json()` directly.

The Zod schema for `message` MUST include `.max(1000, 'message must not exceed 1000 characters')`. This replaces the previous env-var-based `FEEDBACK_MAX_LENGTH` check.

#### Scenario: Valid feedback still succeeds

- GIVEN a valid feedback payload
- WHEN `POST /feedback` is called
- THEN the response is 201 with `{"status": "ok"}` as before

#### Scenario: Invalid feedback still fails with 422

- GIVEN an empty or invalid feedback payload
- WHEN `POST /feedback` is called
- THEN the response is 422
- THEN the response format is Problem Details

#### Scenario: Message over 1000 chars is rejected by Zod

- GIVEN a feedback payload with a 1001-character message
- WHEN `POST /feedback` is called
- THEN the response is 422
- THEN the `errors` array includes a validation error for `message`

### Requirement: Validation error hook

Every route that uses `zValidator` MUST attach a `hook` that converts `ZodError` into Problem Details format. The hook function `(result, c) => Response | void` SHALL return a 422 response when `result.success === false`.

The hook MUST be defined once (in `apps/api/src/middleware/validation-error.ts`) and shared across all routes.

#### Scenario: Hook returns 422 on validation failure

- GIVEN a request that fails `zValidator` validation
- WHEN the validation hook fires
- THEN the response is 422
- THEN the response body conforms to Problem Details with `code: "VALIDATION_ERROR"`, `detail: "The request contains invalid fields."`, and `errors` array

### Requirement: `dbGuard()` for database-dependent routes

Routes that require a database connection MUST use `dbGuard()` middleware in their chain. The `dbGuard()` runs BEFORE the route handler and rejects early if `c.var.db` is unavailable, returning `DB_NOT_AVAILABLE`.

Routes using `dbGuard()`:

- `GET /payments/*` (all endpoints)
- `POST /payments/*` (all endpoints except return redirects)
- `GET /experiences/`
- `GET /themes/`
- `GET /feedback/`
- `PUT /api/translations`

Exception: `GET /api/translations/:lang` checks language code before db availability, so it keeps the inline `if (!db)` guard.

#### Scenario: dbGuard blocks request when db unavailable

- GIVEN a request to a `dbGuard()`-protected route
- WHEN `c.var.db` is undefined
- THEN the response is 500 with `code: "DB_NOT_AVAILABLE"`

### Requirement: `deviceIdGuard()` for device-required routes

Routes that require the `X-Device-Id` header MUST use `deviceIdGuard()` middleware in their chain. It MUST run AFTER the global `injectDeviceId()` middleware.

Routes using `deviceIdGuard()`:

- `GET /experiences/`
- `POST /payments/experiences/:id/access`

#### Scenario: deviceIdGuard blocks request when header missing

- GIVEN a request to a `deviceIdGuard()`-protected route
- WHEN `X-Device-Id` header is absent
- THEN the response is 400 with `code: "DEVICE_ID_REQUIRED"`

### Requirement: Error propagation to onError

Routes that previously wrapped row DB calls in `try/catch` only to return a generic 5xx error (e.g., `FETCH_FAILED`, `SAVE_FAILED`) MUST remove the `try/catch` and let exceptions propagate to the global `onError` handler.

This is safe because:

- Both the removed catch and `onError` return status >= 500
- Both sanitize the `detail` to the generic message
- The specific error `code` changes from e.g. `FETCH_FAILED` to `INTERNAL_ERROR`, which is indistinguishable to the client

Routes where the `catch` performs non-generic behavior (status change, specific error code, branching logic) MUST keep their `try/catch`.

#### Scenario: Generic catch removed, error propagates to onError

- GIVEN a route that previously had `catch (err) { return problem(c, ERRORS.FETCH_FAILED, msg); }`
- WHEN that route throws at runtime
- THEN the error propagates to the global `onError` handler
- THEN the response is 500 with `code: "INTERNAL_ERROR"` and generic `detail`

#### Scenario: Business-logic catch kept

- GIVEN the `POST /feedback` route's `catch` that checks `isUniqueViolation(err)` for 409
- WHEN a unique violation occurs
- THEN the catch block fires normally, returning 409 with `code: "DUPLICATE_REQUEST"`
- THEN the error does NOT reach `onError`
