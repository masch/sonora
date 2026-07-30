# Characterization Tests Specification

## Purpose

Define a test-first workflow that captures current endpoint behavior before any refactoring, ensuring that the refactored code produces identical business responses and that any behavioral changes are explicitly surfaced and intentional.

## Requirements

### Requirement: Test-first workflow

Before modifying any route file, the developer MUST write characterization tests for every affected endpoint. These tests MUST pass when run against the **current** (pre-refactoring) codebase. After refactoring, all tests (existing + new characterization) MUST pass.

#### Scenario: Characterization tests pass before refactoring

- GIVEN the current (pre-refactoring) codebase
- WHEN running `vitest run`
- THEN all existing tests pass
- THEN all new characterization tests pass

#### Scenario: All tests pass after refactoring

- GIVEN the refactored codebase
- WHEN running `vitest run`
- THEN all existing tests pass (zero modifications to existing tests)
- THEN all characterization tests pass

### Requirement: POST /payments/create characterization tests

The following test scenarios MUST be captured BEFORE refactoring:

| #   | Scenario                         | What it captures                                       |
| --- | -------------------------------- | ------------------------------------------------------ |
| 1   | Valid body with experienceId     | 200, `{purchaseId, checkoutUrl}` shape, business logic |
| 2   | Missing body (null/undefined)    | Current error status + shape                           |
| 3   | Missing experienceId             | Current error status + shape                           |
| 4   | Malformed JSON body              | Current error status + shape                           |
| 5   | Valid body with redirectUrl      | 200, redirectUrl in metadata                           |
| 6   | Valid body with device ID header | 200, deviceId hashed in DB values                      |

#### Scenario: Test for missing body

- GIVEN a request to `POST /payments/create` with an empty or missing body
- WHEN recording the current response
- THEN the test captures the exact status code and response body

### Requirement: POST /payments/webhook characterization tests

| #   | Scenario                             | What it captures                                               |
| --- | ------------------------------------ | -------------------------------------------------------------- |
| 1   | Valid webhook body with query params | 200, `{status: "ok"}` shape                                    |
| 2   | Missing body                         | Current error status + shape (crashes with 500 vs returns 400) |
| 3   | Invalid JSON body                    | Current error handling (crashes 500 or returns 400)            |
| 4   | Missing data.id query param          | 400, `{error: "Missing data.id"}`                              |
| 5   | Valid webhook with duplicate status  | 200, skips DB update                                           |

### Requirement: POST /payments/experiences/:id/access characterization tests

| #   | Scenario                             | What it captures                                 |
| --- | ------------------------------------ | ------------------------------------------------ |
| 1   | Valid body with all fields           | 201, `{status: "ok"}` shape                      |
| 2   | Missing source                       | Current error (crashes 500 or returns 400)       |
| 3   | Invalid source enum (garbage string) | Current behavior (silently accepted vs rejected) |
| 4   | Missing deviceId header              | 400, `{error: "Device ID is required"}`          |
| 5   | Null email                           | 201, email stored as null                        |

### Requirement: GET /payments/experiences/:id/purchased characterization tests

| #   | Scenario                                         | What it captures                                                     |
| --- | ------------------------------------------------ | -------------------------------------------------------------------- |
| 1   | With valid email query                           | Current response shape                                               |
| 2   | Without email query                              | 400, `{error: "Email is required"}`                                  |
| 3   | With invalid email format (e.g., "not-an-email") | Current behavior (currently passes through, captured for comparison) |

### Requirement: GET /payments/ characterization tests

| #   | Scenario               | What it captures                    |
| --- | ---------------------- | ----------------------------------- |
| 1   | With valid email query | Current response shape              |
| 2   | Without email query    | 400, `{error: "Email is required"}` |

### Requirement: POST /audio/upload characterization tests

| #   | Scenario                                  | What it captures                       |
| --- | ----------------------------------------- | -------------------------------------- |
| 1   | Valid upload with file + key + valid auth | 201, `{success, key, streamUrl}` shape |
| 2   | Missing file                              | 400, current error shape               |
| 3   | Missing key                               | 400, current error shape               |
| 4   | Missing Authorization header              | 401, current error shape               |
| 5   | Invalid Authorization header              | 401, current error shape               |
| 6   | Missing ADMIN_API_KEY env                 | 500, current error shape               |

### Requirement: PUT /api/translations characterization tests

| #   | Scenario                     | What it captures                       |
| --- | ---------------------------- | -------------------------------------- |
| 1   | Valid body with valid auth   | Current response (200, `{updated: N}`) |
| 2   | Invalid body (empty key)     | 422, current `{error, details}` shape  |
| 3   | Missing Authorization header | 401                                    |
| 4   | Wrong Authorization header   | 401                                    |
| 5   | Empty body (parse failure)   | 400                                    |

### Requirement: POST /api/translations/validate characterization tests

| #   | Scenario                     | What it captures           |
| --- | ---------------------------- | -------------------------- |
| 1   | Valid Authorization header   | 200, `{valid: true}` shape |
| 2   | Invalid Authorization header | 401                        |
| 3   | Missing Authorization header | 401                        |

### Requirement: POST /feedback characterization tests (existing coverage)

The existing feedback tests already cover:

- Empty body (422)
- Malformed JSON (422)
- Missing required fields (422)
- Empty message (422)
- Valid feedback (201)
- Duplicate idempotency (201 / 409)
- Message length limit (422)
- Coordinates (201)
- DB persistence (201)
- DB unique violation (409)
- DB non-unique error (500)

No new characterization tests are REQUIRED for feedback.

### Requirement: Middleware unit tests (added during refactoring)

During refactoring, the following middleware unit test files MUST be added:

- `apps/api/src/__tests__/middleware/require-admin-key.test.ts` — covers missing env, missing/invalid/valid auth
- `apps/api/src/__tests__/middleware/validation-error.test.ts` — covers hook behavior, ProblemDetails interface
- `apps/api/src/__tests__/middleware/db-guard.test.ts` — covers db undefined/null/present, RFC 7807 shape
- `apps/api/src/__tests__/middleware/device-id-guard.test.ts` — covers deviceId undefined/empty/present

#### Scenario: Middleware tests pass

- GIVEN the refactored codebase
- WHEN running `vitest run`
- THEN all middleware unit tests MUST pass

### Requirement: Problem-details unit tests

A dedicated test file `apps/api/src/__tests__/middleware/problem-details.test.ts` MUST cover:

- `HTTP` constant values
- `ERRORS` shape (all entries have code, detail, status; 5xx are generic; 4xx are specific)
- `ERRORS_5XX` / `ERRORS_4XX` internal grouping
- `problem()` helper (body, status, logging, optional errors array)
- `success()` helper (default 200, custom status)
- `created()` helper (201)
- `streamResponse()` and `rangeNotSatisfiable()` helpers
