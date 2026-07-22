# Error Format Specification

## Purpose

Standardize all API error responses to RFC 7807–style (Problem Details) so that every client parses a single predictable shape. This implementation differs from strict RFC 7807 by using `code` (machine-readable string) and `detail` (human-readable) instead of `type` (URI) and `title`, because no client ever consumed the URI.

5xx error `detail` is always sanitized — never leaks internal details to the client. The specific `code` is preserved for server-side logging.

## Requirements

### Requirement: ProblemDetails type

The system MUST define a `ProblemDetails` TypeScript type that all error responses conform to.

```typescript
interface ProblemDetails {
  code: string; // Machine-readable error code, e.g. "DB_NOT_AVAILABLE", "VALIDATION_ERROR"
  detail: string; // Human-readable description. For 5xx: always "An unexpected error occurred"
  status: number; // HTTP status code
  errors?: Array<{
    path: string; // Field path (e.g., "experienceId", "email")
    message: string; // Zod issue message unchanged
  }>;
}
```

#### Scenario: ProblemDetails renders as valid JSON

- GIVEN any API route that returns an error
- WHEN the response body is parsed as JSON
- THEN the result MUST have a `code` string, `detail` string, and `status` number matching the HTTP status
- THEN if `errors` is present it MUST be an array of objects each with a `path` string and `message` string

### Requirement: Error codes (not URIs)

The system uses short machine-readable `code` strings instead of RFC 7807 `type` URIs. The `detail` field provides the human-readable message.

| HTTP Status | code                   | detail                                                           |
| ----------- | ---------------------- | ---------------------------------------------------------------- |
| 400         | `BAD_REQUEST`          | Specific per-validation (e.g., "The key parameter is required.") |
| 401         | `UNAUTHORIZED`         | "Valid authentication is required."                              |
| 401         | `TOKEN_REQUIRED`       | "An access token is required."                                   |
| 401         | `INVALID_TOKEN`        | "Invalid or expired token."                                      |
| 404         | `NOT_FOUND`            | "The requested resource was not found."                          |
| 404         | `EXPERIENCE_NOT_FOUND` | "The experience was not found."                                  |
| 404         | `PURCHASE_NOT_FOUND`   | "The purchase was not found."                                    |
| 409         | `DUPLICATE_REQUEST`    | "This request has already been processed."                       |
| 422         | `VALIDATION_ERROR`     | "The request contains invalid fields."                           |
| 500         | `INTERNAL_ERROR`       | "An unexpected error occurred"                                   |
| 500         | `DB_NOT_AVAILABLE`     | "An unexpected error occurred"                                   |
| 500         | `FETCH_FAILED`         | "An unexpected error occurred"                                   |
| 500         | `MISCONFIG`            | "An unexpected error occurred"                                   |

#### Scenario: Validation error returns 422 with VALIDATION_ERROR

- GIVEN a request with a missing required field
- WHEN the route returns a 422 response
- THEN the `code` field MUST be `"VALIDATION_ERROR"` and `detail` MUST be `"The request contains invalid fields."`

#### Scenario: Unauthorized error returns 401 with UNAUTHORIZED

- GIVEN a request without a valid Authorization header on an admin-protected route
- WHEN the route returns a 401 response
- THEN the `code` field MUST be `"UNAUTHORIZED"` and `detail` MUST be `"Valid authentication is required."`

#### Scenario: Server misconfiguration returns 500 with MISCONFIG

- GIVEN a request when `ADMIN_API_KEY` env var is not set
- WHEN an admin-protected route returns a 500 response
- THEN the `code` field MUST be `"MISCONFIG"`
- THEN the `detail` field MUST be `"An unexpected error occurred"` (generic, no internal leak)

#### Scenario: Internal server error returns 500 with INTERNAL_ERROR

- GIVEN a request that causes an unhandled exception
- WHEN the global `onError` handler returns a 500 response
- THEN the `code` field MUST be `"INTERNAL_ERROR"`
- THEN `detail` MUST be `"An unexpected error occurred"`

### Requirement: 5xx detail is always sanitized

Every error with status >= 500 MUST use a generic `detail` of `"An unexpected error occurred"`. The specific `code` (e.g., `DB_NOT_AVAILABLE`, `FETCH_FAILED`, `MISCONFIG`) is preserved for server-side debugging but the human-readable message never leaks internal details.

#### Scenario: DB_NOT_AVAILABLE detail is generic

- GIVEN a route when the database connection is missing
- WHEN the route returns 500
- THEN `detail` MUST be `"An unexpected error occurred"`, not "Database connection unavailable"
- THEN `code` MUST still be `"DB_NOT_AVAILABLE"` (specific code for logging)

### Requirement: Validation error details

When a `zValidator` hook rejects a request due to `ZodError`, the response MUST include an `errors` array mapping each Zod issue to a `{path, message}` pair.

The `path` for nested objects MUST use dot notation (e.g., `"data.id"`, `"items.0.lang"`). The `message` MUST be the Zod issue message unchanged.

#### Scenario: Single field validation error returns one entry

- GIVEN a request with an invalid email on an endpoint that validates email format
- WHEN validation fails
- THEN the response `errors` array MUST contain `{"path": "email", "message": "..."}`

#### Scenario: Multiple field validation errors return multiple entries

- GIVEN a request with multiple missing or invalid fields
- WHEN validation fails
- THEN the response `errors` array MUST contain one entry per invalid field

#### Scenario: Nested field validation error uses dot notation

- GIVEN a request with an invalid nested field (e.g., `data.id` inside a webhook body)
- WHEN validation fails
- THEN the `path` MUST be `"data.id"`

#### Scenario: problem() helper accepts optional errors array

- GIVEN a route that encounters a validation or business error with field-level details
- WHEN the route calls `problem(c, ERRORS.VALIDATION, undefined, [{path: 'message', message: 'too long'}])`
- THEN the response MUST include the `errors` array in the body
- THEN `code` and `status` come from `ERRORS.VALIDATION`

### Requirement: Global onError handler

The global `onError` handler in `index.ts` MUST return Problem Details format with `{code, detail, status}`.

#### Scenario: Unhandled exception returns ProblemDetails

- GIVEN any route throws an unhandled exception
- WHEN the global `onError` handler fires
- THEN the response MUST be `{"code": "INTERNAL_ERROR", "detail": "An unexpected error occurred", "status": 500}`
- THEN the response MUST NOT include the `errors` array (internal error details are not exposed to the client)

### Requirement: `problem()` and `ERRORS` constants in `problem-details.ts`

All error responses MUST go through `problem(c, ERRORS.XXX)`. The `problem()` helper ensures `body.status === response.status` and sanitizes 5xx detail.

`ERRORS` constants MUST be defined in `apps/api/src/middleware/problem-details.ts`. They MUST be organized internally into `ERRORS_5XX` and `ERRORS_4XX` for clarity, but exported as a flat `ERRORS` object for ergonomic consumption by routes.

#### Scenario: Every error response uses problem()

- GIVEN the complete codebase after the change
- WHEN searching for `c.json` calls that return error responses in route files
- THEN zero MUST be found (all go through `problem()`)

### Requirement: HTTP status constants

Hardcoded HTTP status numbers MUST NOT appear in route files or middleware. All HTTP status codes MUST reference `HTTP.XXX` constants from `problem-details.ts`:

| Constant                     | Value |
| ---------------------------- | ----- |
| `HTTP.OK`                    | 200   |
| `HTTP.FOUND`                 | 302   |
| `HTTP.BAD_REQUEST`           | 400   |
| `HTTP.UNAUTHORIZED`          | 401   |
| `HTTP.NOT_FOUND`             | 404   |
| `HTTP.CONFLICT`              | 409   |
| `HTTP.UNPROCESSABLE_ENTITY`  | 422   |
| `HTTP.INTERNAL_SERVER_ERROR` | 500   |

### Requirement: Success response helpers

All success responses MUST use `success(c, data)` (default 200) or `created(c, data)` (201) instead of raw `c.json(body, 200)` or `c.json(body, 201)`.

#### Scenario: success() returns typed response

- GIVEN any route that returns a 2xx success
- WHEN the response is sent
- THEN `success(c, data)` MUST be used instead of `c.json(data, 200)`

#### Scenario: created() returns 201

- GIVEN any route that creates a resource
- WHEN the response is sent
- THEN `created(c, data)` MUST be used instead of `c.json(data, 201)`

### Requirement: Backward-compatible business responses

This specification ONLY changes **error** and **success wrapper** responses. All success response bodies (the `data` argument to `success()`/`created()`) MUST remain identical in shape to the pre-change behavior.

#### Scenario: Successful payment creation shape unchanged

- GIVEN a valid `POST /payments/create` request
- WHEN the request succeeds
- THEN the response body MUST be `{"purchaseId": "...", "checkoutUrl": "..."}` as before

#### Scenario: Successful audio upload shape unchanged

- GIVEN a valid `POST /audio/upload` request
- WHEN the request succeeds
- THEN the response body MUST be `{"success": true, "key": "...", "streamUrl": "..."}` as before
