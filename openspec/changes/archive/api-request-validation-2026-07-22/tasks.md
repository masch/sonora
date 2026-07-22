# API Request Validation — Task Breakdown

## Review Workload Forecast

| Field                   | Value                                                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Estimated changed lines | 700–1000 (additions + deletions)                                                                                                                                |
| 400-line budget risk    | High                                                                                                                                                            |
| Chained PRs recommended | Yes                                                                                                                                                             |
| Suggested split         | PR 1 (Setup + Schemas + Middleware + Characterization Tests) → PR 2 (Route Refactoring: feedback + payments + audio + translations + onError + test adaptation) |
| Delivery strategy       | ask-on-risk                                                                                                                                                     |
| Chain strategy          | pending                                                                                                                                                         |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High
```

## Dependency Map

```
PR 1 (Setup + Foundation):
  Task 1 ──→ Task 2 ──→ Task 3 ──→ Task 4 ──→ Task 5
                                                    │
                                                    ▼
PR 2 (Route Refactoring):
  Task 6 ──→ Task 7 ──→ Task 8 ──→ Task 9 ──→ Task 10 ──→ Task 11
                                                              │
                                                              ▼
                                                         Task 12
```

---

## PR 1 — Setup, Schemas, Middleware & Characterization Tests

### Setup

- [x] **Task 1: Install `@hono/zod-validator` dependency** <!-- sdd-owner: implementation -->
  - **Files**: `apps/api/package.json`
  - **What**: Add `"@hono/zod-validator": "^..."` to `dependencies` in `apps/api/package.json`. Check the Hono 4.x compatible version range and install the latest compatible version.
  - **Verify**: `cd apps/api && bun install && bun run typecheck`
  - **Rollback**: `git stash` — single-file change, trivial to revert

### Schemas

- [x] **Task 2: Create Zod schemas in `@sonora/shared`** <!-- sdd-owner: implementation -->
  - **Files to create**:
    - `packages/shared/src/schemas/payments.ts`
    - `packages/shared/src/schemas/audio.ts`
  - **Files to modify**:
    - `packages/shared/src/index.ts` (add barrel exports)
  - **What**:
    1. Create `packages/shared/src/schemas/payments.ts` with:
       - `CreatePaymentBodySchema` — `experienceId: z.string().uuid()`, `redirectUrl: z.string().url().optional()`
       - `WebhookBodySchema` — `.passthrough()` permissive schema with optional `type`, `data.id`, `action`
       - `LogAccessBodySchema` — `source: z.enum(ACCESS_SOURCES)`, `email: z.string().email().optional().nullable()`, `platform: z.enum(PLATFORMS).optional().nullable()`
       - `EmailQuerySchema` — `email: z.string().email()`
    2. Create `packages/shared/src/schemas/audio.ts` with:
       - `AudioUploadBodySchema` — `file: z.instanceof(File)`, `key: z.string().min(1)`
    3. Add to `packages/shared/src/index.ts`:
       - `export * from './schemas/payments';`
       - `export * from './schemas/audio';`
  - **Dependencies**: Task 1 (no actual dep, but keep ordering clean)
  - **Verify**:
    - `cd packages/shared && bun run typecheck`
    - `cd apps/api && bun run typecheck` (checks that barrel exports resolve after schema files exist)
  - **Rollback**: `git checkout -- packages/shared/src/schemas/ payments.ts audio.ts index.ts`

### Middleware

- [x] **Task 3: Create `requireAdminKey` middleware** <!-- sdd-owner: implementation -->
  - **Files to create**: `apps/api/src/middleware/require-admin-key.ts`
  - **What**: Create a factory function `requireAdminKey()` that:
    - Returns a `MiddlewareHandler<{ Bindings: Env; Variables: Variables }>`
    - Reads `ADMIN_API_KEY` from `c.env.ADMIN_API_KEY` or `process.env.ADMIN_API_KEY`
    - If `ADMIN_API_KEY` is not set → returns 500 with `{ type: "/errors/misconfig", title: "Server Misconfiguration", status: 500 }`
    - If `Authorization` header is missing or not `Bearer ${adminKey}` → returns 401 with `{ type: "/errors/unauthorized", title: "Unauthorized", status: 401 }`
    - Otherwise → calls `await next()`
    - Import `ProblemDetails` type from the next task's file—since both are new, create the import referencing `../middleware/validation-error` (the file from Task 4)
  - **Dependencies**: Task 2 (no code dep, but ordering keeps PR 1 scoped together)
  - **Verify**: `cd apps/api && bun run typecheck`
  - **Rollback**: `git rm apps/api/src/middleware/require-admin-key.ts`

- [x] **Task 4: Create `validation-error` middleware (ProblemDetails + hook)** <!-- sdd-owner: implementation -->
  - **Files to create**: `apps/api/src/middleware/validation-error.ts`
  - **What**:
    1. Define and export `ProblemDetails` interface:

       ```typescript
       export interface ProblemDetails {
         type: string;
         title: string;
         status: number;
         errors?: Array<{ path: string; message: string }>;
       }
       ```

    2. Define and export `validationHook` function:

       ```typescript
       import type { Context } from 'hono';
       import { z } from '@hono/zod-validator'; // or zod directly

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
             { type: '/errors/validation', title: 'Validation Failed', status: 422, errors },
             422,
           );
         }
       }
       ```

  - **Dependencies**: Task 2 (uses `z.ZodError` type from zod, already a dependency)
  - **Verify**: `cd apps/api && bun run typecheck`
  - **Rollback**: `git rm apps/api/src/middleware/validation-error.ts`

### Characterization Tests (STRICT TDD — write BEFORE touching routes)

- [x] **Task 5: Write characterization tests** <!-- sdd-owner: implementation -->
  - **Files to create**:
    - `apps/api/src/__tests__/characterization/payments.test.ts`
    - `apps/api/src/__tests__/characterization/audio.test.ts`
    - `apps/api/src/__tests__/characterization/translations.test.ts`
  - **What**: Write tests that capture CURRENT behavior of every endpoint before refactoring. These tests MUST pass against the existing codebase as-is.
  - **Payments characterization** (`characterization/payments.test.ts`):
    - Follow existing test pattern: `vi.mock('../payments')`, create mock provider + mock DB
    - Cover all scenarios from the characterization spec:
      - `POST /payments/create`: valid body, missing body, missing experienceId, malformed JSON, valid body with redirectUrl, with X-Device-Id header
      - `POST /payments/webhook`: valid webhook, missing body, invalid JSON, missing `data.id` query, duplicate status
      - `POST /experiences/:id/access`: valid body, missing source, invalid source enum, missing X-Device-Id, null email
      - `GET /experiences/:id/purchased`: valid email query, missing email query, invalid email format
      - `GET /payments/`: valid email query, missing email query
  - **Audio characterization** (`characterization/audio.test.ts`):
    - Follow existing test pattern with `mockR2Bucket`
    - Cover: valid upload + auth, missing file, missing key, missing Authorization, invalid Authorization, missing ADMIN_API_KEY, missing PRIVATE_BUCKET
  - **Translations characterization** (`characterization/translations.test.ts`):
    - Cover: valid body + auth, invalid body (empty key), missing Authorization, wrong Authorization, empty body parse failure, valid auth on validate, invalid auth on validate, missing auth on validate
  - **Dependencies**: Task 4 (need types, but tests import from app and don't directly depend on new middleware yet)
  - **Verify**: `cd apps/api && bun vitest run --reporter verbose apps/api/src/__tests__/characterization/` — ALL tests MUST pass against current code
  - **Rollback**: `git rm -r apps/api/src/__tests__/characterization/`

---

## PR 2 — Route Refactoring & Test Adaptation

### Route Refactoring

- [x] **Task 6: Refactor `feedback.ts` — replace `validateBody()` with `zValidator`** <!-- sdd-owner: implementation -->
  - **Files to modify**: `apps/api/src/routes/feedback.ts`
  - **What**:
    1. Add imports: `zValidator` from `@hono/zod-validator`, `validationHook` from `../middleware/validation-error`
    2. Remove the `validateBody()` function entirely (~15 lines)
    3. Change route definition from:

       ```typescript
       feedbackRouter.post('/', async (c) => {
         const body = await c.req.json().catch(() => null);
         const validation = validateBody(body);
         if (!validation.valid) { return c.json<FeedbackResponse>({ status: 'error', errors: validation.errors }, 422); }
       ```

       to:

       ```typescript
       feedbackRouter.post('/', zValidator('json', FeedbackPostBodySchema, validationHook), async (c) => {
         const validated = c.req.valid('json');
       ```

    4. Replace `validation.data` references with `validated` throughout
    5. Replace ad-hoc error responses with RFC 7807 format:
       - `{ status: 'error', errors: ['message must not exceed N characters'] }` → `{ type: '/errors/validation', title: 'Validation Failed', status: 422, errors: [{ path: 'message', message: '...' }] }`
       - `{ status: 'error', errors: ['Database connection not available'] }` → `{ type: '/errors/internal', title: 'Internal Server Error', status: 500 }`
       - The `throw err` in the DB catch block remains (caught by global `onError`)
    6. Remove `FeedbackResponse` type usage from error paths (success paths keep using it)
    7. Keep existing success responses identical (`{status: "ok"}`, `{status: "duplicate"}`)
  - **Dependencies**: Tasks 1, 2, 3, 4, 5 (setup complete, characterization tests exist)
  - **Verify**: `cd apps/api && bun run typecheck`
  - **Rollback**: `git checkout -- apps/api/src/routes/feedback.ts`

- [x] **Task 7: Refactor `payments.ts` — add `zValidator` to 5 endpoints** <!-- sdd-owner: implementation -->
  - **Files to modify**: `apps/api/src/routes/payments.ts`
  - **What**:
    1. Add imports: `zValidator` from `@hono/zod-validator`, `{ CreatePaymentBodySchema, WebhookBodySchema, LogAccessBodySchema, EmailQuerySchema }` from `@sonora/shared`, `validationHook` from `../middleware/validation-error`
    2. **POST /payments/create**: Add `zValidator('json', CreatePaymentBodySchema, validationHook)`, replace `c.req.json<...>()` → `c.req.valid('json')`, convert all error responses to RFC 7807
    3. **POST /payments/webhook**: Add `zValidator('json', WebhookBodySchema, validationHook)`, replace `c.req.text() + JSON.parse` → `c.req.valid('json')`, convert error responses to RFC 7807
    4. **POST /experiences/:id/access**: Add `zValidator('json', LogAccessBodySchema, validationHook)`, replace `c.req.json() as {...}` → `c.req.valid('json')`, convert error responses to RFC 7807
    5. **GET /experiences/:id/purchased**: Add `zValidator('query', EmailQuerySchema, validationHook)`, replace `c.req.query('email')` → `c.req.valid('query').email`, remove inline `if (!email)` guard (now handled by schema), convert error responses to RFC 7807
    6. **GET /payments/**: Add `zValidator('query', EmailQuerySchema, validationHook)`, replace `c.req.query('email')` → `c.req.valid('query').email`, remove inline `if (!email)` guard, convert error responses to RFC 7807
    7. Error response mapping:
       - `{ error: 'Database client not available' }` → `{ type: '/errors/internal', title: 'Internal Server Error', status: 500 }`
       - `{ error: 'Experience not found' }` → `{ type: '/errors/not-found', title: 'Not Found', status: 404 }`
       - `{ error: 'Experience is free' }` → `{ type: '/errors/bad-request', title: 'Bad Request', status: 400 }`
       - `{ error: 'Experience has no price set' }` → `{ type: '/errors/bad-request', title: 'Bad Request', status: 400 }`
       - `{ error: 'Email is required' }` → removed (handled by schema validation → 422)
       - `{ error: 'Missing data.id' }` → `{ type: '/errors/bad-request', title: 'Bad Request', status: 400 }`
       - `{ error: 'Payment provider not available' }` → `{ type: '/errors/internal', title: 'Internal Server Error', status: 500 }`
       - `{ error: 'Device ID is required' }` → `{ type: '/errors/bad-request', title: 'Bad Request', status: 400 }`
       - `{ error: 'Unknown payment provider' }` → `{ type: '/errors/bad-request', title: 'Bad Request', status: 400 }`
       - `{ error: 'Missing purchase reference' }` → `{ type: '/errors/bad-request', title: 'Bad Request', status: 400 }`
       - `{ error: 'Purchase not found' }` → `{ type: '/errors/not-found', title: 'Not Found', status: 404 }`
    8. Keep: business logic, success responses, URL param handling, `mapWebhookEventToStatus`, `detectProviderFromPayload`, `GET /return/:status/:purchaseId`, `GET /status/:purchaseId` (unchanged)
  - **Dependencies**: Tasks 1, 2, 3, 4, 5
  - **Verify**: `cd apps/api && bun run typecheck`
  - **Rollback**: `git checkout -- apps/api/src/routes/payments.ts`

- [x] **Task 8: Refactor `audio.ts` — replace inline auth + manual body parsing with middleware** <!-- sdd-owner: implementation -->
  - **Files to modify**: `apps/api/src/routes/audio.ts`
  - **What**:
    1. Add imports: `zValidator` from `@hono/zod-validator`, `{ AudioUploadBodySchema }` from `@sonora/shared`, `requireAdminKey` from `../middleware/require-admin-key`, `validationHook` from `../middleware/validation-error`
    2. **POST /audio/upload**:
       - Replace inline admin auth (~12 lines: `authHeader`, `adminKey`, `if (!adminKey)`, `if (authHeader !== ...)`) → `requireAdminKey()` middleware
       - Replace manual `c.req.parseBody()` + `body['file']` / `body['key']` + inline validation → `zValidator('form', AudioUploadBodySchema, validationHook)` + `c.req.valid('form')`
       - Convert error responses to RFC 7807:
         - `{ error: 'Server misconfiguration: ADMIN_API_KEY is missing' }` → removed (handled by middleware → 500 `/errors/misconfig`)
         - `{ error: 'Unauthorized' }` → removed (handled by middleware → 401 `/errors/unauthorized`)
         - `{ error: 'Missing file ... or key ...' }` → removed (handled by schema validation → 422)
         - `{ error: 'Storage bucket binding not configured' }` → `{ type: '/errors/internal', title: 'Internal Server Error', status: 500 }`
         - `{ error: 'Upload failed: ...' }` (catch block) → `{ type: '/errors/internal', title: 'Internal Server Error', status: 500 }`
    3. Keep: `GET /audio/stream`, `GET /audio/public/:key` — NOT changed (out of scope)
    4. Keep: `detectContentType`, `parseRange`, `streamFromBucket` helpers and all streaming logic
  - **Dependencies**: Tasks 1, 2, 3, 4, 5
  - **Verify**: `cd apps/api && bun run typecheck`
  - **Rollback**: `git checkout -- apps/api/src/routes/audio.ts`

- [x] **Task 9: Refactor `translations.ts` — replace inline auth + inline validation with middleware** <!-- sdd-owner: implementation -->
  - **Files to modify**: `apps/api/src/routes/translations.ts`
  - **What**:
    1. Add imports: `zValidator` from `@hono/zod-validator`, `requireAdminKey` from `../middleware/require-admin-key`, `validationHook` from `../middleware/validation-error`
    2. **PUT /api/translations**:
       - Replace inline admin auth (~12 lines) → `requireAdminKey()` middleware
       - Replace `c.req.json().catch(() => null)` + `!body` check + `safeParse` + ad-hoc error formatting → `zValidator('json', TranslationBulkPayloadSchema, validationHook)` + `c.req.valid('json')`
       - Convert error responses:
         - `{ error: 'Server misconfiguration: ADMIN_API_KEY is missing' }` → removed
         - `{ error: 'Unauthorized' }` → removed
         - `{ error: 'Request body is required' }` → removed (handled by zValidator → 422)
         - `{ error: 'Validation failed', details: [...] }` → removed (handled by zValidator hook → 422 with RFC 7807 errors array)
         - `{ error: 'Database connection not available' }` → `{ type: '/errors/internal', title: 'Internal Server Error', status: 500 }`
         - `{ error: 'Failed to save translations' }` → `{ type: '/errors/internal', title: 'Internal Server Error', status: 500 }`
       - Replace `result.data` → `c.req.valid('json')`
       - **Behavior change**: Empty body parse failure changes from 400 `{error: 'Request body is required'}` to 422 RFC 7807. This is intentional and documented in the design.
    3. **POST /api/translations/validate**:
       - Replace inline admin auth → `requireAdminKey()` middleware
       - Convert error responses (same pattern)
       - No `zValidator` needed (route accepts no body)
    4. Keep: `GET /api/translations/:lang` — NOT changed (out of scope)
    5. Keep: business logic, DB upsert loop, success response `{ updated: N }` and `{ valid: true }`
  - **Dependencies**: Tasks 1, 2, 3, 4, 5
  - **Verify**: `cd apps/api && bun run typecheck`
  - **Rollback**: `git checkout -- apps/api/src/routes/translations.ts`

### Global Handler & Final Wiring

- [x] **Task 10: Update global `onError` handler in `index.ts`** <!-- sdd-owner: implementation -->
  - **Files to modify**: `apps/api/src/index.ts`
  - **What**:
    1. Add import: `import type { ProblemDetails } from './middleware/validation-error';`
    2. Remove: `import { feedbackRouter, type FeedbackResponse } from './routes/feedback';` → change to just `import { feedbackRouter } from './routes/feedback';` (remove the `FeedbackResponse` type import)
    3. Replace `onError` handler:

       ```typescript
       // Before:
       app.onError((err, c) => {
         logger.error('Unhandled error:', err);
         return c.json<FeedbackResponse>(
           { status: 'error', errors: ['Internal server error'] },
           500,
         );
       });

       // After:
       app.onError((err, c) => {
         logger.error('Unhandled error:', err);
         return c.json<ProblemDetails>(
           { type: '/errors/internal', title: 'Internal Server Error', status: 500 },
           500,
         );
       });
       ```

  - **Dependencies**: Task 4 (ProblemDetails type), Tasks 6-9 (route refactors done — verify no remaining `FeedbackResponse` usage in error paths)
  - **Verify**: `cd apps/api && bun run typecheck`
  - **Rollback**: `git checkout -- apps/api/src/index.ts`

### Test Adaptation

- [x] **Task 11: Update existing test assertions for RFC 7807 error shapes** <!-- sdd-owner: implementation -->
  - **Files to modify**:
    - `apps/api/src/__tests__/feedback.test.ts`
    - `apps/api/src/__tests__/payments.test.ts`
    - `apps/api/src/__tests__/audio.test.ts`
  - **What**:
    - **feedback.test.ts**:
      - Update all validation error assertions: `{status: 'error', errors: [...]}` → RFC 7807 shape with `{type: '/errors/validation', title: 'Validation Failed', status: 422, errors: [{path, message}]}`
      - Update internal error assertion: `{status: 'error', errors: ['Internal server error']}` → `{type: '/errors/internal', title: 'Internal Server Error', status: 500}`
      - Keep: business success assertions (409 → `{status: 'duplicate'}`, 201 → `{status: 'ok'}`) — unchanged
      - The `FeedbackResponse` type casting in test `const body = (await res.json()) as { status: string; errors: string[] }` → remove or update type annotation
    - **payments.test.ts**:
      - Update all error assertions (e.g., `{error: 'Experience not found'}` → `{type: '/errors/not-found', title: 'Not Found', status: 404}`)
      - Keep: success assertions (200 checkout, 200 webhook `{status: 'ok'}`, mock DB assertions) — unchanged
    - **audio.test.ts**:
      - Update error assertions for:
        - Missing ADMIN_API_KEY: `{error: 'Server misconfiguration: ADMIN_API_KEY is missing'}` → `{type: '/errors/misconfig', ...}` (via `requireAdminKey`)
        - Missing Authorization: expect `{type: '/errors/unauthorized', ...}` instead of `{error: 'Unauthorized'}`
        - Missing file/key: expect 422 RFC 7807 instead of 400 `{error: 'Missing file...'}`
        - Missing PRIVATE_BUCKET: `{error: 'Storage bucket binding not configured'}` → `{type: '/errors/internal', ...}`
        - Upload failure: `{error: 'Upload failed: ...'}` → `{type: '/errors/internal', ...}`
      - Keep: streaming tests for GET /audio/stream and GET /audio/public/:key — unchanged
    - **Important**: Never change success response assertions — they must remain identical.
  - **Dependencies**: Tasks 6, 7, 8, 9, 10 (route refactors complete, error shapes finalized)
  - **Verify**: `cd apps/api && bun run typecheck`
  - **Rollback**: `git checkout -- apps/api/src/__tests__/feedback.test.ts apps/api/src/__tests__/payments.test.ts apps/api/src/__tests__/audio.test.ts`

### Final Verification

- [x] **Task 12: Run all tests — verify everything passes** <!-- sdd-owner: implementation -->
  - **Files**: None (verification only)
  - **What**:
    1. Run typecheck: `cd apps/api && bun run typecheck`
    2. Run all tests: `cd apps/api && bun vitest run`
    3. Verify no failing tests — both existing tests (with updated assertions) AND characterization tests pass
    4. If tests fail, diagnose and fix:
       - Characterization test failures → the refactoring changed behavior where it shouldn't have (business logic differences)
       - Existing test assertion failures → incorrect error shape updates
    5. Optional: Remove characterization test files after confirming they've served their purpose (they captured baseline, now refactored code is the baseline)
  - **Dependencies**: Task 11 (all tests updated)
  - **Verify**: `cd apps/api && bun vitest run` — all tests pass, exit code 0
  - **Rollback**: N/A — verification step, no files changed

---

## Post-Apply Review

- [x] Start or resume bounded review of the completed implementation. <!-- sdd-owner: parent -->
