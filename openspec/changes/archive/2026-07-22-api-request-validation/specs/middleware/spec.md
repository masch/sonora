# Middleware Specification

## Purpose

Eliminate duplicated inline patterns by defining reusable, testable middleware for authentication, database guarding, and device identity.

Three middleware factories are provided, each in its own file under `apps/api/src/middleware/`.

## 1. `requireAdminKey()` — Admin authentication

### Requirement: requireAdminKey middleware existence

The system MUST provide a reusable middleware `requireAdminKey()` in `apps/api/src/middleware/require-admin-key.ts`. It MUST be a factory function that returns a Hono `MiddlewareHandler`, typed to the application's `Bindings` and `Variables`.

#### Scenario: Middleware is importable

- GIVEN any route file
- WHEN the file imports `requireAdminKey` from `apps/api/src/middleware/require-admin-key.ts`
- THEN the import MUST resolve to a callable factory function

### Requirement: Missing ADMIN_API_KEY behavior

When `ADMIN_API_KEY` is not set in the environment (neither `c.env` nor `process.env`), the middleware MUST return a 500 response with Problem Details format indicating server misconfiguration. It MUST NOT call `next()`.

#### Scenario: Missing env returns 500 misconfig

- GIVEN a request to an admin-protected route
- WHEN `ADMIN_API_KEY` is not set in the runtime environment
- THEN the response status MUST be 500
- THEN the response body MUST be `{"code": "MISCONFIG", "detail": "An unexpected error occurred", "status": 500}`

### Requirement: Invalid or missing Authorization header behavior

When `ADMIN_API_KEY` is set but the request has no `Authorization` header or the header value is not `Bearer ${ADMIN_API_KEY}`, the middleware MUST return a 401 response. It MUST NOT call `next()`.

#### Scenario: Missing Authorization header

- GIVEN `ADMIN_API_KEY` is set in the environment
- WHEN a request is made without an `Authorization` header
- THEN the response status MUST be 401
- THEN the response body MUST be `{"code": "UNAUTHORIZED", "detail": "Valid authentication is required.", "status": 401}`

#### Scenario: Invalid Authorization header

- GIVEN `ADMIN_API_KEY` is set in the environment
- WHEN a request has `Authorization: Bearer wrong-key`
- THEN the response status MUST be 401
- THEN the response body MUST be `{"code": "UNAUTHORIZED", "detail": "Valid authentication is required.", "status": 401}`

#### Scenario: Valid bearer token passes through

- GIVEN `ADMIN_API_KEY` is set to `"my-secret-key"`
- WHEN a request has `Authorization: Bearer my-secret-key`
- THEN the middleware MUST call `next()` and not return a response

### Requirement: Usage count

The `requireAdminKey()` middleware MUST be used by exactly **three** routes:

- `POST /audio/upload`
- `PUT /api/translations`
- `POST /api/translations/validate`

No other routes SHALL use it. No inline copies of admin auth logic SHALL remain after the change.

#### Scenario: Audio upload uses middleware

- GIVEN the audio router
- WHEN `POST /audio/upload` is defined
- THEN `requireAdminKey()` MUST be in the middleware chain before the handler

#### Scenario: Translations PUT uses middleware

- GIVEN the translations router
- WHEN `PUT /api/translations` is defined
- THEN `requireAdminKey()` MUST be in the middleware chain before the handler

#### Scenario: Translations validate uses middleware

- GIVEN the translations router
- WHEN `POST /api/translations/validate` is defined
- THEN `requireAdminKey()` MUST be in the middleware chain before the handler

#### Scenario: Zero inline admin auth copies remain

- GIVEN the complete codebase after the change
- WHEN searching for inline `ADMIN_API_KEY` checks outside of `require-admin-key.ts`
- THEN no matches MUST be found in route handler code

### Requirement: Middleware ordering independence

The `requireAdminKey()` middleware MUST NOT depend on other middleware having run first. It MUST work correctly regardless of whether it is placed before or after `injectDb()` and `injectDeviceId()` middleware.

#### Scenario: Middleware works without DB

- GIVEN a request to an admin-protected route
- WHEN `requireAdminKey()` is evaluated before `injectDb()`
- THEN the auth check runs successfully with no DB dependency

---

## 2. `dbGuard()` — Database availability guard

### Requirement: dbGuard middleware existence

The system MUST provide `dbGuard()` in `apps/api/src/middleware/db-guard.ts`. It MUST be a factory that returns a `MiddlewareHandler`.

#### Scenario: Middleware is importable

- GIVEN any route file
- WHEN the file imports `dbGuard` from `apps/api/src/middleware/db-guard.ts`
- THEN the import MUST resolve to a callable factory function

### Requirement: Behavior when db is unavailable

When `c.var.db` is undefined or null, the middleware MUST return a 500 response with `{"code": "DB_NOT_AVAILABLE", "detail": "An unexpected error occurred", "status": 500}`. It MUST NOT call `next()`.

#### Scenario: No db returns DB_NOT_AVAILABLE

- GIVEN a route that uses `dbGuard()`
- WHEN `c.var.db` is undefined
- THEN the response status MUST be 500
- THEN the response body MUST be `{"code": "DB_NOT_AVAILABLE", "detail": "An unexpected error occurred", "status": 500}`

### Requirement: Behavior when db is available

When `c.var.db` is a valid `DbClient`, the middleware MUST call `next()` and allow the request to proceed.

#### Scenario: db present passes through

- GIVEN a route that uses `dbGuard()`
- WHEN `c.var.db` is a valid `DbClient`
- THEN the middleware MUST call `next()` and not return a response

### Requirement: Route coverage

Every route that requires a database connection MUST use `dbGuard()` in its middleware chain. No route SHALL have inline `if (!db) return problem(c, ERRORS.DB_NOT_AVAILABLE)` guards.

Exception: routes where infrastructure checks MUST come after input validation (e.g., `GET /api/translations/:lang` validates the language code before checking db availability) MAY keep the inline guard.

#### Scenario: Inline db guards removed

- GIVEN the complete codebase after the change
- WHEN searching for `if (!db)` followed by `DB_NOT_AVAILABLE` in route handler code
- THEN no matches MUST be found outside of explicitly excepted endpoints

---

## 3. `deviceIdGuard()` — Device identity guard

### Requirement: deviceIdGuard middleware existence

The system MUST provide `deviceIdGuard()` in `apps/api/src/middleware/device-id-guard.ts`. It MUST be a factory that returns a `MiddlewareHandler`.

#### Scenario: Middleware is importable

- GIVEN any route file
- WHEN the file imports `deviceIdGuard` from `apps/api/src/middleware/device-id-guard.ts`
- THEN the import MUST resolve to a callable factory function

### Requirement: Behavior when device ID is missing

When `c.var.deviceId` is undefined or empty, the middleware MUST return a 400 response with `{"code": "DEVICE_ID_REQUIRED", "detail": "The X-Device-Id header is required.", "status": 400}`. It MUST NOT call `next()`.

#### Scenario: No deviceId returns DEVICE_ID_REQUIRED

- GIVEN a route that uses `deviceIdGuard()`
- WHEN `X-Device-Id` header was not sent (so `c.var.deviceId` is undefined)
- THEN the response status MUST be 400
- THEN the response body MUST be `{"code": "DEVICE_ID_REQUIRED", "detail": "The X-Device-Id header is required.", "status": 400}`

### Requirement: Behavior when device ID is present

When `c.var.deviceId` is a non-empty string (set by the global `injectDeviceId()` middleware), the middleware MUST call `next()` and allow the request to proceed.

#### Scenario: deviceId present passes through

- GIVEN a route that uses `deviceIdGuard()`
- WHEN `X-Device-Id` was sent (so `c.var.deviceId` is set)
- THEN the middleware MUST call `next()` and not return a response

### Requirement: Middleware ordering

`deviceIdGuard()` MUST run AFTER `injectDeviceId()` (the global middleware that reads the header and sets `c.var.deviceId`). Since `injectDeviceId()` is registered at the app level via `app.use('*', injectDeviceId())`, this is always guaranteed.

#### Scenario: Runs after injectDeviceId

- GIVEN the application bootstrap
- WHEN `app.use('*', injectDeviceId())` is registered
- THEN `deviceIdGuard()` at any route level will see the already-set `c.var.deviceId`
