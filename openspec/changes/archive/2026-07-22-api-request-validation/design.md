# API Request Validation — Design

## Overview

Standardize HTTP request validation across the Hono API using `@hono/zod-validator`, consolidate inline admin auth into a reusable middleware, and normalize all error responses to RFC 7807 (Problem Details).

---

## 1. Middleware Chain Architecture

### Global middleware (unchanged order in `index.ts`)

```
customLogger() → configureCors() → injectDb() → injectDeviceId()
```

All global middleware is mounted via `app.use('*', ...)` and runs on every request. No changes to global middleware order.

### Route-level middleware (new pattern)

Each route declares its middleware chain inline in the route definition.
Available guards:

- `requireAdminKey()` — admin authentication (Bearer token)
- `dbGuard()` — database availability check
- `deviceIdGuard()` — device identity check (after global `injectDeviceId()`)

Typical patterns:

```
# Admin route with DB
requireAdminKey() → dbGuard() → zValidator → handler

# Route requiring device + DB
dbGuard() → deviceIdGuard() → zValidator → handler

# Public route with DB only
dbGuard() → handler
```

**Ordering rationale**: Guards that reject early (auth, db) come before `zValidator`
to avoid parsing bodies for requests that will be rejected anyway. `deviceIdGuard()`
runs AFTER `injectDeviceId()` (global middleware), so it always sees the hashed value.

### Where validation errors are caught

The `zValidator` `hook` option fires when `result.success === false`. The hook returns a 422 RFC 7807 response **before** the route handler executes. This means:

- Malformed JSON → 422 (not 400)
- Missing required fields → 422
- Invalid enum values → 422
- Invalid UUID format → 422

### Validation error location flow

```
Request → global middleware → authGuard → dbGuard → zValidator hook (422 if fail) → handler
```

---

## 2. RFC 7807 Integration Design

### 2.1 ProblemDetails Type

Defined in `apps/api/src/middleware/problem-details.ts`:

```typescript
export interface ProblemDetails {
  code: string; // Machine-readable error code, e.g. "DB_NOT_AVAILABLE", "VALIDATION_ERROR"
  detail: string; // Human-readable description. For 5xx: always "An unexpected error occurred"
  status: number; // HTTP status code
  errors?: Array<{
    path: string; // Field path in dot notation, e.g. "experienceId", "data.id"
    message: string; // Zod issue message unchanged
  }>;
}
```

### 2.2 Error Codes

The implementation uses short machine-readable `code` strings instead of RFC 7807 `type` URIs.
4xx errors carry specific `detail` messages; all 5xx errors use the generic `"An unexpected error occurred"`.

| HTTP Status | code                 | detail                                  | Source                                         |
| ----------- | -------------------- | --------------------------------------- | ---------------------------------------------- |
| 400         | `BAD_REQUEST`        | Specific per-validation                 | Route validation / business logic              |
| 400         | `DEVICE_ID_REQUIRED` | "The X-Device-Id header is required."   | `deviceIdGuard()` middleware                   |
| 401         | `UNAUTHORIZED`       | "Valid authentication is required."     | `requireAdminKey()` middleware                 |
| 401         | `INVALID_TOKEN`      | "Invalid or expired token."             | Audio stream auth                              |
| 404         | `NOT_FOUND`          | "The requested resource was not found." | Route returns 404                              |
| 422         | `VALIDATION_ERROR`   | "The request contains invalid fields."  | `zValidator` hook (ZodError)                   |
| 500         | `INTERNAL_ERROR`     | "An unexpected error occurred"          | Global `onError` handler                       |
| 500         | `DB_NOT_AVAILABLE`   | "An unexpected error occurred"          | `dbGuard()` middleware                         |
| 500         | `MISCONFIG`          | "An unexpected error occurred"          | `requireAdminKey()` when ADMIN_API_KEY missing |

### 2.3 Validation Hook Function (Shared)

Defined in `apps/api/src/middleware/validation-error.ts`:

```typescript
import type { Context, MiddlewareHandler } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

export function validationHook<T>(
  result: { success: true; data: T } | { success: false; error: z.ZodError },
  c: Context,
): Response | void {
  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return c.json<ProblemDetails>(
      {
        code: 'VALIDATION_ERROR',
        detail: 'The request contains invalid fields.',
        status: 422,
        errors,
      },
      422,
    );
  }
}

// Usage pattern:
// zValidator('json', SomeSchema, validationHook)
```

The hook lives in a **single shared export**. Every `zValidator` call passes this same function reference. It is NOT per-route.

### 2.4 problem() Helper and ERRORS Constants

The `problem()` helper in `apps/api/src/middleware/problem-details.ts`
centralizes all error response construction. It:

- Returns `{code, detail, status}` with `status` matching the HTTP response code
- Sanitizes 5xx `detail` to the generic message
- Accepts an optional `errors` array for field-level validation details
- Logs a server-side message when `logDetail` is provided

```typescript
export function problem(
  c: { json: <T>(body: T, status: number) => Response },
  err: ErrorConstant,
  logDetail?: string,
  errors?: Array<{ path: string; message: string }>,
): Response {
  // ...
}

// Usage:
return problem(c, ERRORS.DB_NOT_AVAILABLE);
return problem(c, ERRORS.UNAUTHORIZED);
return problem(c, ERRORS.VALIDATION, 'Missing field', [{ path: 'email', message: 'Required' }]);
```

`ERRORS` constants are organized internally as `ERRORS_5XX` and `ERRORS_4XX` but
exported as a flat `ERRORS` merge for ergonomic access:

```typescript
export const ERRORS_5XX = { INTERNAL: {...}, DB_NOT_AVAILABLE: {...}, ... } as const;
export const ERRORS_4XX = { UNAUTHORIZED: {...}, NOT_FOUND: {...}, ... } as const;
export const ERRORS = { ...ERRORS_5XX, ...ERRORS_4XX } as const;
```

### 2.5 success() and created() Helpers

Success response helpers eliminate hardcoded 200/201 in route handlers:

```typescript
export function success<T>(c: JsonContext, data: T, status: number = 200): Response;
export function created<T>(c: JsonContext, data: T): Response;

// Usage:
return success(c, list); // 200
return created(c, { status: 'ok' }); // 201
```

### 2.6 Global onError Handler

In `apps/api/src/index.ts`:

```typescript
app.onError((err, c) => {
  const msg = err instanceof Error ? err.message : 'Unknown error';
  return problem(c, ERRORS.INTERNAL, msg);
});
```

With:

```typescript
app.onError((err, c) => {
  logger.error('Unhandled error:', err);
  return c.json<ProblemDetails>(
    {
      type: '/errors/internal',
      title: 'Internal Server Error',
      status: 500,
    },
    500,
  );
});
```

- No `errors` array included (internal error details not leaked)
- Import `ProblemDetails` from `./middleware/validation-error`
- The `FeedbackResponse` import is no longer needed in `index.ts`

### 2.5 Business Error Responses

Routes that return business-logic errors (e.g., "Experience is free", "Experience not found", "Email is required") also change to RFC 7807 format. These are the routes' own `c.json(...)` calls, not validation errors.

Decision: **Yes, convert all error responses to RFC 7807** for consistency. The 6 URI categories cover all cases.

Mapping of current ad-hoc errors to RFC 7807:

| Current                                         | New format                                                                                                           |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `{ error: 'Database client not available' }`    | `{ type: '/errors/internal', title: '...', status: 500 }`                                                            |
| `{ error: 'Experience not found' }`             | `{ type: '/errors/not-found', title: '...', status: 404 }`                                                           |
| `{ error: 'Experience is free' }`               | `{ type: '/errors/bad-request', title: '...', status: 400 }`                                                         |
| `{ error: 'Email is required' }`                | `{ type: '/errors/validation', title: '...', status: 422, errors: [{path: 'email', message: 'Email is required'}] }` |
| `{ status: 'error', errors: [...] }` (feedback) | `{ type: '/errors/validation', title: '...', status: 422, errors: [...] }`                                           |
| `{ error: 'Unauthorized' }`                     | `{ type: '/errors/unauthorized', title: '...', status: 401 }`                                                        |

### 2.6 Backward-Compatible Business Responses

All 2xx success responses remain **identical**:

| Endpoint                          | Current success shape                       | After change |
| --------------------------------- | ------------------------------------------- | ------------ |
| `POST /payments/create` (200)     | `{purchaseId, checkoutUrl}`                 | Identical    |
| `POST /payments/webhook` (200)    | `{status: "ok"}`                            | Identical    |
| `GET /payments/return/:s/:id`     | 302 redirect                                | Identical    |
| `GET /payments/status/:id` (200)  | `{purchaseId, status, experienceId, ...}`   | Identical    |
| `POST /payments/.../access`(201)  | `{status: "ok"}`                            | Identical    |
| `GET /experiences/:id/purchased`  | `{purchased: true/false, purchase?: {...}}` | Identical    |
| `GET /payments/` (200)            | `{purchases: [...]}`                        | Identical    |
| `POST /audio/upload` (201)        | `{success, key, streamUrl}`                 | Identical    |
| `GET /audio/stream` (200/206)     | Binary audio stream                         | Identical    |
| `GET /audio/public/:key` (200)    | Binary audio stream                         | Identical    |
| `GET /api/translations/:lang`     | `{key: value, ...}`                         | Identical    |
| `PUT /api/translations` (200)     | `{updated: N}`                              | Identical    |
| `POST /api/translations/validate` | `{valid: true}`                             | Identical    |
| `POST /feedback` (201)            | `{status: "ok"}`                            | Identical    |

---

## 3. Schema Design with Zod Patterns

### 3.1 New File: `packages/shared/src/schemas/payments.ts`

```typescript
import { z } from 'zod';
import { ACCESS_SOURCES, PLATFORMS } from '../enums';

export const CreatePaymentBodySchema = z.object({
  experienceId: z
    .string({ required_error: 'experienceId is required' })
    .uuid('experienceId must be a valid UUID'),
  redirectUrl: z.string().url('redirectUrl must be a valid URL').optional(),
});

export const WebhookBodySchema = z
  .object({
    type: z.string().optional(),
    data: z
      .object({
        id: z.string().optional(),
      })
      .optional(),
    action: z.string().optional(),
  })
  .passthrough(); // Permissive: unknown fields pass through

export const LogAccessBodySchema = z.object({
  source: z.enum(ACCESS_SOURCES, { required_error: 'source is required' }),
  email: z.string().email('Invalid email format').optional().nullable(),
  platform: z.enum(PLATFORMS).optional().nullable(),
});

export const EmailQuerySchema = z.object({
  email: z
    .string({ required_error: 'email query parameter is required' })
    .email('email must be a valid email address'),
});
```

### 3.2 New File: `packages/shared/src/schemas/audio.ts`

```typescript
import { z } from 'zod';

export const AudioUploadBodySchema = z.object({
  file: z.instanceof(File, { message: 'file must be a File object' }),
  key: z.string({ required_error: 'key is required' }).min(1, 'key must not be empty'),
});
```

### 3.3 Updated: `packages/shared/src/index.ts`

Add exports:

```typescript
export * from './schemas/payments';
export * from './schemas/audio';
```

### 3.4 `experienceId` Design Decision: UUID

The `experiences.id` column in the DB is `uuid('id').defaultRandom().primaryKey()`. The Zod schema uses `.uuid()` to match the DB constraint.

**Impact on tests**: Test fixtures using non-UUID values (`'exp-1'`, `'non-existent'`) will fail UUID validation at the zValidator level. These tests require updating:

| Current value        | Replacement UUID                         | Purpose                           |
| -------------------- | ---------------------------------------- | --------------------------------- |
| `'exp-1'`            | `'550e8400-e29b-41d4-a716-446655440000'` | Positive test (experience exists) |
| `'non-existent'`     | `'00000000-0000-0000-0000-000000000001'` | 404 test (experience not found)   |
| `'exp-1'` (free)     | `'550e8400-e29b-41d4-a716-446655440001'` | Free experience test              |
| `'exp-1'` (no price) | `'550e8400-e29b-41d4-a716-446655440002'` | No price test                     |

### 3.5 WebhookBodySchema: Permissive Design

`WebhookBodySchema` uses `.passthrough()` (allows unknown fields) and all fields are optional. Rationale:

- Mercado Pago may send undocumented fields in webhook payloads
- The current handler doesn't validate body shape — it passes `payload` directly to `provider.processWebhook()`
- The schema only exists to catch truly malformed webhooks (non-JSON bodies that would fail at JSON parse)
- The `data.id` query-param validation remains in the handler (`c.req.query('data.id')`)

### 3.6 Existing Schema Reuse

`FeedbackPostBodySchema` (in `packages/shared/src/feedback.ts`) is reused as-is.

`TranslationBulkPayloadSchema` (in `packages/shared/src/schemas/translations.ts`) is reused as-is.

No modifications to existing schemas.

---

## 4. Route Refactoring Per File

### 4.1 `apps/api/src/routes/payments.ts`

#### POST /payments/create

**Before**:

```typescript
paymentsRouter.post('/create', async (c) => {
  const { experienceId, redirectUrl } = await c.req.json<{
    experienceId: string;
    redirectUrl?: string;
  }>();
  // Manual destructuring, no validation
  // Error responses: { error: 'Experience not found' } etc.
});
```

**After**:

```typescript
import { zValidator } from '@hono/zod-validator';
import { CreatePaymentBodySchema } from '@sonora/shared';
import { validationHook } from '../middleware/validation-error';

paymentsRouter.post(
  '/create',
  zValidator('json', CreatePaymentBodySchema, validationHook),
  async (c) => {
    const { experienceId, redirectUrl } = c.req.valid('json');
    // Same business logic
    // Error responses change to RFC 7807
  },
);
```

Middleware chain: `zValidator('json', ...)`

#### POST /payments/webhook

**Before**:

```typescript
const rawBody = await c.req.text();
const payload = JSON.parse(rawBody);
```

**After**:

```typescript
paymentsRouter.post(
  '/webhook',
  zValidator('json', WebhookBodySchema, validationHook),
  async (c) => {
    const payload = c.req.valid('json');
    // Same business logic
  },
);
```

Middleware chain: `zValidator('json', ...)`

**Note**: The provider's `processWebhook()` receives `(payload, headers, dataId)`. It does NOT use raw body text. Signature verification uses headers only. So switching from `c.req.text() + JSON.parse` to `c.req.valid('json')` is safe.

#### POST /payments/experiences/:id/access

**Before**:

```typescript
const { source, email, platform } = (await c.req.json()) as {
  source: AccessSource;
  email?: string;
  platform?: string;
};
// No validation — TS cast only
```

**After**:

```typescript
paymentsRouter.post(
  '/experiences/:id/access',
  zValidator('json', LogAccessBodySchema, validationHook),
  async (c) => {
    const { source, email, platform } = c.req.valid('json');
    // Same business logic
  },
);
```

Middleware chain: `zValidator('json', ...)`

#### GET /payments/experiences/:id/purchased

**Before**:

```typescript
const email = c.req.query('email');
if (!email) {
  return c.json({ error: 'Email is required' }, 400);
}
```

**After**:

```typescript
paymentsRouter.get(
  '/experiences/:id/purchased',
  zValidator('query', EmailQuerySchema, validationHook),
  async (c) => {
    const { email } = c.req.valid('query');
    // Same business logic — the inline `if (!email)` guard is removed
  },
);
```

#### GET /payments/

Same pattern as above — `zValidator('query', EmailQuerySchema, validationHook)` then `const { email } = c.req.valid('query')`.

#### GET /payments/return/:status/:purchaseId

**No change**. This endpoint uses URL params and returns 302 redirects. No request body/query validation needed.

#### GET /payments/status/:purchaseId

**No change**. URL params only. No body/query validation needed.

### 4.2 `apps/api/src/routes/audio.ts`

#### POST /audio/upload

**Before**:

```typescript
audioRouter.post('/upload', async (c) => {
  // ~20 lines of inline admin auth
  // Manual body parsing with c.req.parseBody()
  // Inline file/key validation
});
```

**After**:

```typescript
import { zValidator } from '@hono/zod-validator';
import { AudioUploadBodySchema } from '@sonora/shared';
import { requireAdminKey } from '../middleware/require-admin-key';
import { validationHook } from '../middleware/validation-error';

audioRouter.post(
  '/upload',
  requireAdminKey(),
  zValidator('form', AudioUploadBodySchema, validationHook),
  async (c) => {
    const { file, key } = c.req.valid('form');
    // Same business logic
    // Inline file/key validation removed (handled by schema)
    // Inline auth removed (handled by middleware)
  },
);
```

Middleware chain: `requireAdminKey()` → `zValidator('form', ...)`

#### GET /audio/stream and GET /audio/public/:key

**No change** to the validation strategy. These use in-handler checks (`if (!key)`, `if (!token)`) that are specific to audio streaming logic. Not scoped for zValidator in this change.

### 4.3 `apps/api/src/routes/translations.ts`

#### PUT /api/translations

**Before**:

```typescript
translationsRouter.put('/', async (c) => {
  // ~15 lines of inline admin auth (same pattern as audio)
  // Manual c.req.json().catch(() => null)
  // TranslationBulkPayloadSchema.safeParse(body) inline
});
```

**After**:

```typescript
translationsRouter.put(
  '/',
  requireAdminKey(),
  zValidator('json', TranslationBulkPayloadSchema, validationHook),
  async (c) => {
    const body = c.req.valid('json');
    // Same business logic
  },
);
```

Middleware chain: `requireAdminKey()` → `zValidator('json', ...)`

**Behavior change**: Malformed JSON body changes from 400 `{error: 'Request body is required'}` to 422 RFC 7807. This is intentional — zValidator catches JSON parse errors uniformly.

#### POST /api/translations/validate

**Before**:

```typescript
// ~12 lines of inline admin auth, then returns {valid: true}
```

**After**:

```typescript
translationsRouter.post('/validate', requireAdminKey(), async (c) => {
  return c.json({ valid: true }, 200);
});
```

Middleware chain: `requireAdminKey()` only. No `zValidator` (no body accepted).

#### GET /api/translations/:lang

**No change** to validation. The `:lang` regex check is specific translation logic and is fine as-is. Not scoped for this change.

### 4.4 `apps/api/src/routes/feedback.ts`

#### POST /feedback

**Before**:

```typescript
function validateBody(
  body: unknown,
): { valid: false; errors: string[] } | { valid: true; data: FeedbackPostBody } {
  // ~15 lines of manual validation + safeParse
}

feedbackRouter.post('/', async (c) => {
  const body: unknown = await c.req.json().catch(() => null);
  const validation = validateBody(body);
  if (!validation.valid) {
    return c.json<FeedbackResponse>({ status: 'error', errors: validation.errors }, 422);
  }
  // ...
});
```

**After**:

```typescript
feedbackRouter.post('/', zValidator('json', FeedbackPostBodySchema, validationHook), async (c) => {
  const validated = c.req.valid('json');
  // Same business logic: validated.message, validated.idempotencyKey, etc.
  // validateBody() function is REMOVED
  // Error responses change to RFC 7807
});
```

**Changes**:

- Remove `validateBody()` function entirely
- Remove `FeedbackResponse` type usage for error responses
- Success responses (`{status: "ok"}`, `{status: "duplicate"}`) remain the same shape
- Error responses change from `{status: "error", errors: [...]}` to ProblemDetails format
- The `FeedbackResponse` type continues to exist (used by success responses), but the error path no longer uses it

**Test impact**: Existing feedback tests assert `{status: "error", errors: [...]}` shape for errors. These assertions need updating to RFC 7807 shape. Success assertions (`{status: "ok"}`, `{status: "duplicate"}`) remain unchanged.

---

## 5. File Change Plan

### 5.1 New Files

| File                                                           | Purpose                                                                                   |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `packages/shared/src/schemas/payments.ts`                      | `CreatePaymentBodySchema`, `WebhookBodySchema`, `LogAccessBodySchema`, `EmailQuerySchema` |
| `packages/shared/src/schemas/audio.ts`                         | `AudioUploadBodySchema`                                                                   |
| `apps/api/src/middleware/require-admin-key.ts`                 | `requireAdminKey()` factory function                                                      |
| `apps/api/src/middleware/validation-error.ts`                  | `ProblemDetails` interface + `validationHook()` function                                  |
| `apps/api/src/__tests__/characterization/payments.test.ts`     | Characterization tests for payments endpoints                                             |
| `apps/api/src/__tests__/characterization/audio.test.ts`        | Characterization tests for audio endpoints                                                |
| `apps/api/src/__tests__/characterization/translations.test.ts` | Characterization tests for translations endpoints                                         |

### 5.2 Modified Files

#### `apps/api/package.json`

- Add dependency: `"@hono/zod-validator": "^..."` (install latest compatible with Hono 4.x)

#### `packages/shared/src/index.ts`

- Add: `export * from './schemas/payments';`
- Add: `export * from './schemas/audio';`

#### `apps/api/src/index.ts`

- Remove: `import { feedbackRouter, type FeedbackResponse } from './routes/feedback';`
- Remove: `FeedbackResponse` type usage in `onError` handler
- Replace: `onError` handler returns `ProblemDetails` instead of `FeedbackResponse`
- Add import: `import type { ProblemDetails } from './middleware/validation-error';`

#### `apps/api/src/routes/payments.ts`

- Add imports: `zValidator`, validation schemas from `@sonora/shared`, `validationHook`
- Add: `zValidator` middleware to `POST /create`, `POST /webhook`, `POST /experiences/:id/access`, `GET /experiences/:id/purchased`, `GET /`
- Replace: `c.req.json<...>()` → `c.req.valid('json')` in 3 POST handlers
- Replace: `c.req.query('email')` → `c.req.valid('query').email` in 2 GET handlers
- Replace: All ad-hoc error responses (`{error: '...'}`) → RFC 7807 ProblemDetails
- Remove: Inline `if (!email)` guards (now handled by schema)
- Change: `AccessSource`/`Platform` TS casts replaced by schema-inferred types
- Keep: Business logic, success responses, URL params, `detectProviderFromPayload` helper

#### `apps/api/src/routes/audio.ts`

- Add imports: `zValidator`, `AudioUploadBodySchema`, `requireAdminKey`, `validationHook`
- Replace: Inline admin auth (extracted) → `requireAdminKey()` middleware
- Replace: Manual `c.req.parseBody()` + file/key checks → `zValidator('form', AudioUploadBodySchema, validationHook)` + `c.req.valid('form')`
- Replace: Error responses → RFC 7807 format
- Remove: Inline `ADMIN_API_KEY` checks (3 occurrences: upload, stream)
- Note: `GET /audio/stream` and `GET /audio/public/:key` NOT changed (out of scope)

#### `apps/api/src/routes/translations.ts`

- Add imports: `zValidator`, `requireAdminKey`, `validationHook`
- Replace: Inline admin auth in `PUT /` → `requireAdminKey()` middleware
- Replace: Inline admin auth in `POST /validate` → `requireAdminKey()` middleware
- Replace: `c.req.json().catch(() => null)` + `safeParse` → `zValidator('json', TranslationBulkPayloadSchema, validationHook)` + `c.req.valid('json')`
- Replace: Error responses → RFC 7807 format
- Remove: `import { eq, and }` unchanged (keep and/eq)
- Remove: Inline `safeParse` call and ad-hoc error formatting

#### `apps/api/src/routes/feedback.ts`

- Add imports: `zValidator` from `@hono/zod-validator`, `validationHook` from middleware
- Remove: `validateBody()` function (entirely)
- Replace: `c.req.json().catch(() => null)` + `validateBody()` → `zValidator('json', FeedbackPostBodySchema, validationHook)` + `c.req.valid('json')`
- Replace: Error responses → RFC 7807 format (422, 409, 500 paths)
- Keep: Success responses (`{status: "ok"}`, `{status: "duplicate"}`) — same shape
- Keep: `FeedbackResponse` type export (still used for success shapes)
- Remove: `FeedbackResponse` type usage for error responses

### 5.3 Test Files

#### `apps/api/src/__tests__/feedback.test.ts`

- Update error-shape assertions from `{status: "error", errors: [...]}` to RFC 7807 `{type, title, status, errors}`
- Success-response assertions (`{status: "ok"}`, `{status: "duplicate"}`) remain unchanged

#### `apps/api/src/__tests__/payments.test.ts`

- Update test fixtures: `'exp-1'` → `'550e8400-e29b-41d4-a716-446655440000'` (and other valid UUIDs)
- Update error-shape assertions from `{error: '...'}` to RFC 7807
- Success-response assertions remain unchanged

#### `apps/api/src/__tests__/audio.test.ts`

- Update error-shape assertions from `{error: '...'}` / `body.error` to RFC 7807
- Success-response assertions remain unchanged

---

## 6. Integration Test Design

### 6.1 Characterization Test Location

New directory: `apps/api/src/__tests__/characterization/`

Rationale: Separate from existing tests to avoid conflicts during the write-first-then-refactor workflow. Characterization tests are temporary scaffolding that capture current behavior before changes. They live alongside existing tests.

### 6.2 Test Patterns

All characterization tests follow the same pattern as existing tests:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import app, { setDbClient } from '../../index';
import { createPaymentProviders } from '../../payments';

// Mock external dependencies the same way existing tests do
vi.mock('../../payments', () => ({
  createPaymentProviders: vi.fn(),
}));

describe('POST /payments/create — characterization', () => {
  // Same mock setup as existing tests
  let mockProvider: any;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    setDbClient(null);
    mockProvider = { createCheckout: vi.fn().mockResolvedValue({...}) };
    (createPaymentProviders as any).mockReturnValue({ mercadopago: mockProvider });
    mockDb = { /* same chainable mock */ };
  });

  afterEach(() => {
    setDbClient(null);
  });

  it('captures current error for missing body', async () => {
    const res = await app.request('/payments/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),  // empty object — missing experienceId
    });
    expect(res.status).toBe(/* current status, e.g. 422 */);
    expect(await res.json()).toEqual(/* current shape */);
  });
});
```

### 6.3 Per-Endpoint Characterization Coverage

#### Payments (`characterization/payments.test.ts`)

| Endpoint                       | Scenario                    | Captures                      |
| ------------------------------ | --------------------------- | ----------------------------- |
| POST /payments/create          | Valid body                  | 200 + success shape           |
| POST /payments/create          | Missing body (null)         | Current error status + shape  |
| POST /payments/create          | Missing experienceId        | Current error status + shape  |
| POST /payments/create          | Malformed JSON              | Current error status + shape  |
| POST /payments/create          | Valid body with redirectUrl | 200 + redirectUrl in metadata |
| POST /payments/create          | With device ID header       | 200 + deviceId hashed         |
| POST /payments/webhook         | Valid webhook               | 200 + `{status: "ok"}`        |
| POST /payments/webhook         | Missing body                | Current error status + shape  |
| POST /payments/webhook         | Invalid JSON body           | Current error status + shape  |
| POST /payments/webhook         | Missing data.id query       | 400 + current shape           |
| POST /payments/webhook         | Duplicate status            | 200 + skip DB update          |
| POST /experiences/:id/access   | Valid body all fields       | 201 + `{status: "ok"}`        |
| POST /experiences/:id/access   | Missing source              | Current error status + shape  |
| POST /experiences/:id/access   | Invalid source enum         | Current behavior              |
| POST /experiences/:id/access   | Missing deviceId header     | 400 + current shape           |
| POST /experiences/:id/access   | Null email                  | 201 + null email              |
| GET /experiences/:id/purchased | Valid email query           | Current response shape        |
| GET /experiences/:id/purchased | Without email query         | 400 + current shape           |
| GET /experiences/:id/purchased | Invalid email format        | Current behavior              |
| GET /payments/                 | Valid email query           | Current response shape        |
| GET /payments/                 | Without email query         | 400 + current shape           |

#### Audio (`characterization/audio.test.ts`)

| Endpoint           | Scenario              | Captures                          |
| ------------------ | --------------------- | --------------------------------- |
| POST /audio/upload | Valid upload + auth   | 201 + `{success, key, streamUrl}` |
| POST /audio/upload | Missing file          | 400 + current shape               |
| POST /audio/upload | Missing key           | 400 + current shape               |
| POST /audio/upload | Missing Authorization | 401 + current shape               |
| POST /audio/upload | Invalid Authorization | 401 + current shape               |
| POST /audio/upload | Missing ADMIN_API_KEY | 500 + current shape               |

#### Translations (`characterization/translations.test.ts`)

| Endpoint                        | Scenario                   | Captures              |
| ------------------------------- | -------------------------- | --------------------- |
| PUT /api/translations           | Valid body + auth          | 200 + `{updated: N}`  |
| PUT /api/translations           | Invalid body (empty key)   | 422 + current shape   |
| PUT /api/translations           | Missing Authorization      | 401 + current shape   |
| PUT /api/translations           | Wrong Authorization        | 401 + current shape   |
| PUT /api/translations           | Empty body (parse failure) | 400 + current shape   |
| POST /api/translations/validate | Valid auth                 | 200 + `{valid: true}` |
| POST /api/translations/validate | Invalid auth               | 401                   |
| POST /api/translations/validate | Missing auth               | 401                   |

#### Feedback

No new characterization tests needed. Existing tests cover the endpoint thoroughly. Only error-shape assertions need updating.

### 6.4 Testing RFC 7807 Error Shapes

For any test that asserts an error response, the pattern becomes:

```typescript
const res = await app.request(...);
const body = await res.json() as ProblemDetails;

expect(body).toMatchObject({
  type: '/errors/validation',   // or /errors/unauthorized, /errors/internal, etc.
  title: expect.any(String),
  status: expect.any(Number),
});

// For validation errors:
if (body.errors) {
  expect(body.errors[0]).toMatchObject({
    path: expect.any(String),
    message: expect.any(String),
  });
}
```

Use `toMatchObject` for flexible assertion — exact `type` and `status` check, but title can be flexible.

---

## 7. requireAdminKey Middleware Design

### Location: `apps/api/src/middleware/require-admin-key.ts`

```typescript
import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../index';
import type { ProblemDetails } from './validation-error';

export const requireAdminKey = (): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> => {
  return async (c, next) => {
    const adminKey =
      c.env?.ADMIN_API_KEY ||
      (typeof process !== 'undefined' ? process.env.ADMIN_API_KEY : undefined);

    if (!adminKey) {
      return c.json<ProblemDetails>(
        {
          type: '/errors/misconfig',
          title: 'Server Misconfiguration',
          status: 500,
        },
        500,
      );
    }

    const authHeader = c.req.header('Authorization');
    if (authHeader !== `Bearer ${adminKey}`) {
      return c.json<ProblemDetails>(
        {
          type: '/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
        },
        401,
      );
    }

    await next();
  };
};
```

**Key properties**:

- Stateless: no DB dependency, works before `injectDb()`
- Returns RFC 7807 format for both missing config and unauthorized
- Factory pattern matches existing middleware conventions (`configureCors()`, `injectDb()`, `injectDeviceId()`)

### Middleware independence

`requireAdminKey()` does NOT read `c.var` or `c.env` beyond `ADMIN_API_KEY`. It works correctly regardless of position relative to `injectDb()` and `injectDeviceId()`.

---

## 8. Data Flow Diagrams

### Request lifecycle (refactored)

```
Client Request
  │
  ▼
global middleware stack (unchanged):
  customLogger() → configureCors() → injectDb() → injectDeviceId()
  │
  ▼ (if route has auth)
requireAdminKey()
  │
  ├── No ADMIN_API_KEY set? → 500 RFC 7807 ({type: "/errors/misconfig"})
  ├── Bad Authorization?      → 401 RFC 7807 ({type: "/errors/unauthorized"})
  └── OK → next()
  │
  ▼ (if route has body/query validation)
zValidator('json'|'query'|'form', schema)
  │
  ├── JSON parse error?      → hook fires → 422 RFC 7807 ({type: "/errors/validation"})
  ├── Schema validation fail? → hook fires → 422 RFC 7807 ({type: "/errors/validation"})
  └── Valid → c.req.valid() available in handler
  │
  ▼
Route handler (unchanged business logic)
  │
  ├── Business error? → returns RFC 7807 error response
  ├── DB error?       → throws → global onError → 500 RFC 7807 ({type: "/errors/internal"})
  └── Success         → unchanged 2xx response
```

### Error response flow

```
Validation error (zValidator hook)
  → 422 { type: "/errors/validation", title: "Validation Failed", status: 422, errors: [...] }

Auth error (requireAdminKey)
  → 401 { type: "/errors/unauthorized", title: "Unauthorized", status: 401 }
  → 500 { type: "/errors/misconfig", title: "Server Misconfiguration", status: 500 }

Business logic error (handler returns c.json)
  → 400 { type: "/errors/bad-request", title: "Bad Request", status: 400 }
  → 404 { type: "/errors/not-found", title: "Not Found", status: 404 }
  → 500 { type: "/errors/internal", title: "Internal Server Error", status: 500 }

Unhandled exception (global onError)
  → 500 { type: "/errors/internal", title: "Internal Server Error", status: 500 }
```

---

## 9. Risk Assessment & Mitigations

| Risk                                                     | Impact                                           | Mitigation                                                                                                                                                                                           |
| -------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test fixtures using non-UUID values break                | Tests fail to run                                | Update all fixtures to valid UUIDs before schema change. Characterization tests capture pre-change behavior first.                                                                                   |
| Webhook body consumption order                           | zValidator consumes JSON before handler reads it | Verified: provider's `processWebhook()` uses parsed payload + headers, NOT raw body text. Safe to switch.                                                                                            |
| Feedback test assertions fail                            | 20+ test assertions need updating                | Run characterization tests BEFORE changes to capture current shape. The diff is mechanical (error shape only).                                                                                       |
| `requireAdminKey` breaks existing auth flow              | Protected routes become inaccessible             | All 3 routes (audio upload, translations PUT, translations validate) use identical inline auth logic. Extracting to middleware is a mechanical refactor with no behavior change except error format. |
| Translations PUT changes 400→422 for JSON parse failures | Tests expecting 400 fail                         | Intentional change — zValidator normalizes all body parse failures to 422. Update test expectations.                                                                                                 |
| Global onError changes shape                             | Downstream error monitors break                  | Only affects unhandled exceptions (rare). All existing tests that trigger `onError` need assertion updates.                                                                                          |

---

## 10. Implementation Order

1. **Install dependency**: `@hono/zod-validator` in `apps/api`
2. **Create schemas**: `packages/shared/src/schemas/payments.ts`, `packages/shared/src/schemas/audio.ts`
3. **Export schemas**: Update `packages/shared/src/index.ts`
4. **Create middleware**: `apps/api/src/middleware/require-admin-key.ts`, `apps/api/src/middleware/validation-error.ts`
5. **Write characterization tests**: 3 files in `apps/api/src/__tests__/characterization/`
6. **Run characterization tests** against current code → all pass
7. **Refactor `feedback.ts`**: Replace `validateBody()` with `zValidator` + hook
8. **Refactor `payments.ts`**: Add `zValidator` to 5 endpoints, update error responses
9. **Refactor `audio.ts`**: Replace inline auth + manual body parsing with middleware
10. **Refactor `translations.ts`**: Replace inline auth + inline validation with middleware
11. **Update `index.ts`**: Global `onError` handler → RFC 7807
12. **Update existing test assertions**: Error-shape assertions in `feedback.test.ts`, `payments.test.ts`, `audio.test.ts`
13. **Run all tests**: Existing tests pass with updated assertions, characterization tests pass with RFC 7807 shapes
14. **Remove characterization tests** (optional — they have served their purpose)

---

## Appendix: Import Map

```
packages/shared/src/schemas/payments.ts
  exports: CreatePaymentBodySchema, WebhookBodySchema, LogAccessBodySchema, EmailQuerySchema

packages/shared/src/schemas/audio.ts
  exports: AudioUploadBodySchema

packages/shared/src/index.ts
  adds: export * from './schemas/payments'
  adds: export * from './schemas/audio'

apps/api/src/middleware/require-admin-key.ts
  exports: requireAdminKey()
  imports: ProblemDetails from './validation-error'

apps/api/src/middleware/validation-error.ts
  exports: ProblemDetails (interface), validationHook (function)
  imports: zod, @hono/zod-validator

apps/api/src/routes/payments.ts
  imports: zValidator from '@hono/zod-validator'
  imports: { CreatePaymentBodySchema, WebhookBodySchema, LogAccessBodySchema, EmailQuerySchema } from '@sonora/shared'
  imports: validationHook from '../middleware/validation-error'

apps/api/src/routes/audio.ts
  imports: zValidator from '@hono/zod-validator'
  imports: { AudioUploadBodySchema } from '@sonora/shared'
  imports: requireAdminKey from '../middleware/require-admin-key'
  imports: validationHook from '../middleware/validation-error'

apps/api/src/routes/translations.ts
  imports: zValidator from '@hono/zod-validator'
  imports: requireAdminKey from '../middleware/require-admin-key'
  imports: validationHook from '../middleware/validation-error'

apps/api/src/routes/feedback.ts
  imports: zValidator from '@hono/zod-validator'
  imports: validationHook from '../middleware/validation-error'

apps/api/src/index.ts
  imports: ProblemDetails from './middleware/validation-error'
  removes: FeedbackResponse import
```
