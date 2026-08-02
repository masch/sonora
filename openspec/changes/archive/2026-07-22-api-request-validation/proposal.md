# SDD Proposal: Standardize HTTP Request Validation

## 1. Problem Analysis

### 1.1 Manual Validation Is a Bug Vector

The API currently relies on **TypeScript casts (`as Type`) instead of runtime validation** on several critical endpoints:

| Endpoint                                  | Validation                                                        | Risk                                                                                               |
| ----------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `POST /payments/create`                   | `c.req.json<{experienceId, redirectUrl}>()` — zero runtime checks | Malformed body crashes with 500 instead of a proper 400                                            |
| `POST /payments/webhook`                  | `JSON.parse(rawBody)` + TS cast                                   | Any parse error yields a 500, missing `data.id` checked after parse, payload shape never validated |
| `POST /payments/experiences/:id/access`   | `c.req.json() as {source, email, platform}`                       | Invalid `source` is silently accepted and inserted into the DB                                     |
| `GET /payments/experiences/:id/purchased` | Manual `if (!email)`                                              | Only checks presence, not format                                                                   |
| `GET /payments/`                          | Manual `if (!email)`                                              | Same — no email format validation                                                                  |
| `POST /audio/upload`                      | `parseBody()` + ad-hoc `instanceof File` checks                   | Partial validation, error messages inconsistent with other endpoints                               |

Each of these is a **type-safety illusion**: TypeScript casts disappear at runtime. A wrong payload type, missing field, or invalid enum value either crashes (500) or corrupts data silently.

### 1.2 Inconsistent Error Formats

Every route group returns errors in a different shape:

- **feedback**: `{status: 'error', errors: string[]}` (422)
- **payments**: `{error: string}` (400)
- **translations**: `{error: string, details?: [{path, message}]}` (422)
- **audio**: `{error: string}` (400)

This means every client must handle 4+ error shapes. Adding a new client (web, admin panel, CLI) means re-documenting or guessing the format.

### 1.3 Duplicated Admin Authentication

The same Bearer-token check against `ADMIN_API_KEY` is copy-pasted in **three places**:

- `audio.ts:post('/upload')`
- `translations.ts:put('/')`
- `translations.ts:post('/validate')`

This is a maintenance hazard. If the auth logic changes (e.g., key rotation strategy, multiple keys, timing-safe comparison), all three must change. One will inevitably be missed.

### 1.4 Business Cost

- **Operational cost**: every malformed request that slips through as a 500 requires log inspection and manual retry.
- **Client complexity**: mobile and web clients need bespoke error-parsing per route.
- **Onboarding friction**: new contributors must learn ad-hoc patterns per route file instead of a single convention.
- **Security surface**: unvalidated `AccessSource` and `email` values reach the database unchecked, opening the door to injection or data-quality issues.

---

## 2. Proposed Solution

### 2.1 Stack

| Concern            | Library / Pattern                    | Why                                                                                                         |
| ------------------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Request validation | `@hono/zod-validator` (`zValidator`) | Official Hono Zod middleware; works as route middleware, returns structured `ZodError`                      |
| Error format       | RFC 7807 Problem Details             | Industry standard (`RFC 9457`), used by ASP.NET, Spring, Google APIs. Single parseable shape for all errors |
| Zod schemas        | `@sonora/shared` (existing + new)    | Schemas already live in shared; new payment/access schemas belong there too                                 |
| Admin auth         | `requireAdminKey()` middleware       | Reusable `MiddlewareHandler` in `apps/api/src/middleware/`                                                  |

### 2.2 Architecture

```
Request
  │
  ▼
  zValidator('json', schema)          ← validates body, returns 422 RFC 7807 on failure
  │
  ▼
  requireAdminKey()                   ← reusable auth middleware (admin routes only)
  │
  ▼
  Route handler (typed, validated)    ← knows `c.req.valid('json')` is safe
  │
  ▼
  onError / validation-error handler  ← normalises all errors to RFC 7807
```

### 2.3 RFC 7807 Structure

```typescript
interface ProblemDetails {
  type: string; // URI identifying the problem type
  title: string; // Short human-readable summary
  status: number; // HTTP status code
  errors?: Array<{
    path: string; // Field path (e.g., "experienceId", "email")
    message: string; // Human-readable description
  }>;
}
```

Concrete examples:

**Validation error** (422):

```json
{
  "type": "https://sonora.app/errors/validation",
  "title": "Validation Failed",
  "status": 422,
  "errors": [
    { "path": "experienceId", "message": "Required" },
    { "path": "email", "message": "Must be a valid email" }
  ]
}
```

**Auth error** (401):

```json
{
  "type": "https://sonora.app/errors/unauthorized",
  "title": "Unauthorized",
  "status": 401
}
```

**Not found** (404):

```json
{
  "type": "https://sonora.app/errors/not-found",
  "title": "Not Found",
  "status": 404
}
```

---

## 3. New Zod Schemas (in `@sonora/shared`)

### 3.1 `packages/shared/src/schemas/payments.ts`

```typescript
import { z } from 'zod';
import { ACCESS_SOURCES } from '../enums';

export const CreatePaymentBodySchema = z.object({
  experienceId: z.string().uuid(),
  redirectUrl: z.string().url().optional(),
});

export const WebhookBodySchema = z.object({
  type: z.string().optional(),
  data: z.object({ id: z.string() }).optional(),
  action: z.string().optional(),
  // Future providers add their shape here
});

export const LogAccessBodySchema = z.object({
  source: z.enum(ACCESS_SOURCES),
  email: z.string().email().optional().nullable(),
  platform: z.enum(['ios', 'android', 'web']).optional().nullable(),
});

export const EmailQuerySchema = z.object({
  email: z.string().email('A valid email is required'),
});
```

Export from `packages/shared/src/index.ts`:

```typescript
export * from './schemas/payments';
```

### 3.2 `packages/shared/src/schemas/audio.ts`

```typescript
import { z } from 'zod';

export const AudioUploadBodySchema = z.object({
  file: z.instanceof(File, { message: 'file must be a File' }),
  key: z.string().min(1, 'key is required'),
});
```

Note: `z.instanceof(File)` works with `@hono/zod-validator`'s `form` validator for multipart uploads.

---

## 4. Middleware

### 4.1 `apps/api/src/middleware/require-admin-key.ts`

```typescript
import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../index';

export const requireAdminKey = (): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> => {
  return async (c, next) => {
    const adminKey =
      c.env?.ADMIN_API_KEY ??
      (typeof process !== 'undefined' ? process.env.ADMIN_API_KEY : undefined);

    if (!adminKey) {
      return c.json(
        { type: '/errors/misconfig', title: 'Server Misconfiguration', status: 500 },
        500,
      );
    }

    const authHeader = c.req.header('Authorization');
    if (authHeader !== `Bearer ${adminKey}`) {
      return c.json({ type: '/errors/unauthorized', title: 'Unauthorized', status: 401 }, 401);
    }

    await next();
  };
};
```

### 4.2 Validation Error Handler (in route or shared middleware)

The `@hono/zod-validator`'s `hook` option or the global `onError` handler (or a dedicated middleware) normalises `ZodError` into RFC 7807.

**Recommended approach**: use the `hook` parameter of `zValidator` for per-validator error handling, plus the global `onError` for unexpected errors. The `hook` is a function `(result, c) => Response | void` that fires when validation fails.

Example hook (defined once, imported where needed):

```typescript
import type { ValidationTargets } from 'hono';
import type { ZodError } from 'zod';

function validationHook(result: { success: boolean; error?: ZodError }, c: Context) {
  if (!result.success) {
    return c.json(
      {
        type: '/errors/validation',
        title: 'Validation Failed',
        status: 422,
        errors: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      422,
    );
  }
}
```

Or a standalone RejectHandler middleware that catches `ZodError` thrown by `zValidator` without a hook. The hook approach is more explicit and avoids magic.

---

## 5. Routes to Refactor

### 5.1 `payments.ts` — HIGH impact (4 endpoints)

#### `POST /payments/create`

- **Before**: `c.req.json<{experienceId, redirectUrl}>()` — zero validation
- **After**: add `zValidator('json', CreatePaymentBodySchema)` as route middleware, read validated body via `c.req.valid('json')`
- **Error before**: obscure 500 on malformed JSON or missing field
- **Error after**: 422 with RFC 7807 listing the exact field

#### `POST /payments/webhook`

- **Before**: `JSON.parse(rawBody)` can crash the handler
- **After**: add `zValidator('json', WebhookBodySchema)` for basic shape validation
- **Note**: The `data.id` query-param validation stays manual (it's a query param, not body); but we can add a `zValidator('query', ...)` for it if desired

#### `POST /payments/experiences/:id/access`

- **Before**: `c.req.json() as {source, email, platform}` — zero runtime validation, any string passes for `source`
- **After**: add `zValidator('json', LogAccessBodySchema)` — validates `source` is one of `ACCESS_SOURCES`, `email` is a valid email, `platform` is valid
- **Risk reduction**: prevents invalid enum values reaching the DB

#### `GET /payments/experiences/:id/purchased` and `GET /payments/`

- **Before**: manual `if (!email)` — checks presence but not format
- **After**: add `zValidator('query', EmailQuerySchema)` — validates email is present AND a valid email format

### 5.2 `audio.ts` — MEDIUM impact (1 endpoint + auth extraction)

#### `POST /audio/upload`

- **Before**: `parseBody()` + ad-hoc checks + inline admin auth
- **After**:
  1. Add `requireAdminKey()` as route-level middleware (before the handler)
  2. Add `zValidator('form', AudioUploadBodySchema)` for multipart validation
  3. Read validated file + key from `c.req.valid('form')`
- **Benefit**: removes duplicated admin auth, consistent error format

### 5.3 `translations.ts` — MEDIUM impact (auth extraction, validation already mostly there)

#### `PUT /` (bulk upsert)

- **Before**: inline Zod `safeParse` with ad-hoc error format `{error, details}`, inline admin auth
- **After**:
  1. Add `requireAdminKey()` as route-level middleware
  2. Replace manual `safeParse` with `zValidator('json', TranslationBulkPayloadSchema)`
  3. Error format becomes RFC 7807 naturally
- **Note**: The `details` array in the current response maps 1:1 to RFC 7807 `errors`

#### `POST /validate`

- **Before**: only admin auth check, no body needed
- **After**: add `requireAdminKey()` as route-level middleware, no validator needed
- **Stretch**: could add a response body, but no body is the current contract

### 5.4 `feedback.ts` — LOW impact (validation already exists)

- **Before**: custom `validateBody()` helper with inline error format `{status: 'error', errors: string[]}`
- **After**: replace with `zValidator('json', FeedbackPostBodySchema)`, adapt response to RFC 7807
- **Benefit**: removes route-specific validation helper, consistent error format
- **Note**: `FeedbackResponse` type changes; check if any client imports it. The type is currently exported from `feedback.ts` — clients will need updating.

### 5.5 Global error handler (`index.ts`)

- **Before**: returns `{status: 'error', errors: ['Internal server error']}` with FeedbackResponse type
- **After**: return RFC 7807 `{type: '/errors/internal', title: 'Internal Server Error', status: 500}`
- **Note**: `FeedbackResponse` type may need adjustment if it's used in client code

---

## 6. Affected Files

| File                                           | Change                                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| `apps/api/package.json`                        | Add `@hono/zod-validator` dependency                                    |
| `apps/api/src/middleware/require-admin-key.ts` | **NEW** — reusable admin auth middleware                                |
| `apps/api/src/routes/payments.ts`              | Add `zValidator` to 4 endpoints, remove ad-hoc parsing                  |
| `apps/api/src/routes/audio.ts`                 | Add `requireAdminKey()`, `zValidator('form', ...)`                      |
| `apps/api/src/routes/translations.ts`          | Add `requireAdminKey()`, replace inline safeParse with `zValidator`     |
| `apps/api/src/routes/feedback.ts`              | Replace custom `validateBody()` with `zValidator`, adapt response shape |
| `apps/api/src/index.ts`                        | Update global `onError` to RFC 7807                                     |
| `packages/shared/src/schemas/payments.ts`      | **NEW** — payment/access/email schemas                                  |
| `packages/shared/src/schemas/audio.ts`         | **NEW** — audio upload schema                                           |
| `packages/shared/src/index.ts`                 | Add exports for new schemas                                             |
| `apps/api/src/types.ts` (if exists)            | May need `ProblemDetails` type — or keep inline                         |

---

## 7. Non-Goals (explicitly out of scope)

- ❌ No ORM or database schema changes
- ❌ No endpoint restructuring (URLs, HTTP methods, response shapes stay the same — only error format changes)
- ❌ No authentication overhaul beyond admin-key extraction into middleware
- ❌ No new features or endpoints
- ❌ No client-side changes here (but clients must adapt to RFC 7807 error responses — separate PR)
- ❌ No adding email validation to the DB layer (validation is API-boundary only)
- ❌ No rate limiting, request logging changes, or observability changes

---

## 8. Rollback Strategy

**Per-route, per-middleware granularity**. Each change is isolated enough to revert individually:

1. A route using `zValidator` can be rolled back by removing the middleware call + restoring the original `c.req.json()` + TS cast. No database impact.
2. The `requireAdminKey()` middleware can be removed independently per route; replaced by inline check if needed.
3. RFC 7807 error format changes only affect the API response — reverting means restoring the original error objects in each handler.
4. **Safe rollback**: keep one route as a "pilot" (suggestion: feedback.ts, lowest risk), verify, then expand.

---

## 9. Risks and Mitigations

| Risk                                                                    | Likelihood | Impact | Mitigation                                                                                                  |
| ----------------------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| Existing clients break on RFC 7807 error format                         | Medium     | Medium | Change error format in a single PR, coordinate with mobile/web releases; keep a changelog entry             |
| `@hono/zod-validator` drops error detail in `form` validator            | Low        | Low    | Test multipart validation explicitly; fall back to manual check if needed                                   |
| `z.instanceof(File)` doesn't work with Hono's `parseBody`               | Low        | Medium | Fall back to manual check for the file field; `zValidator('form', ...)` delegates to `parseBody` internally |
| Adding `uuid()` validation to `experienceId` rejects existing test data | Low        | Low    | Ensure test and seed data uses valid UUIDs; this is a correctness win                                       |
| New middleware order conflicts with existing middleware                 | Low        | Low    | `requireAdminKey()` is stateless and order-independent; place before or after `injectDb()`                  |

---

## 10. Success Criteria

1. All endpoints accept valid requests and return **identical business responses** (201, 200, 302, etc.) as before.
2. All malformed requests return **422 RFC 7807** with `errors: [{path, message}]` instead of a 500 crash or ad-hoc error.
3. Admin auth is defined once in `require-admin-key.ts` and zero inline copies remain.
4. All Zod schemas live in `@sonora/shared` and are exported from `schemas/payments.ts` and `schemas/audio.ts`.
5. The custom `validateBody()` helper in `feedback.ts` is removed.
6. All existing tests pass; new tests cover malformed body scenarios per changed route.

---

## 11. Estimated Effort

| Phase                           | Estimate     |
| ------------------------------- | ------------ |
| Schemas (shared)                | ~30 min      |
| Middleware (requireAdminKey)    | ~15 min      |
| Payments refactor               | ~45 min      |
| Audio + translations refactor   | ~30 min      |
| Feedback refactor               | ~20 min      |
| Global error handler + index.ts | ~15 min      |
| Tests                           | ~30 min      |
| **Total**                       | **~3 hours** |

Risk level: **Low-Medium**. Mechanical changes to existing routes with no new business logic. The highest risk is client breakage on error format change, which is a communication/coordination concern, not a technical one.
