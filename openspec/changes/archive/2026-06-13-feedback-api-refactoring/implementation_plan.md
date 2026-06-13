# Modularizing Hono API Test Suite

Split the monolithic [feedback.test.ts](file:///home/masch/dev/js/sonora/api/src/__tests__/feedback.test.ts) into smaller, single-responsibility test files corresponding to the new modular codebase structure.

## Proposed Structure

```
api/src/
├── __tests__/
│   └── feedback.test.ts       [MODIFY] (Only test feedback route validation, DB inserts, and KV stores)
├── middleware/
│   ├── __tests__/
│   │   ├── cors.test.ts       [NEW] (CORS middleware behavior tests)
│   │   └── db-injector.test.ts [NEW] (Database injector middleware tests)
│   ├── cors.ts
│   └── db-injector.ts
└── utils/
    ├── __tests__/
    │   └── db-errors.test.ts  [NEW] (Database errors utility tests)
    └── db-errors.ts
```

## Proposed Changes

### Utilities Tests

#### [NEW] [db-errors.test.ts](file:///home/masch/dev/js/sonora/api/src/utils/__tests__/db-errors.test.ts)

- Test `isUniqueViolation` utility with edge cases (valid/invalid error payloads, null/non-object errors).

---

### Middleware Tests

#### [NEW] [cors.test.ts](file:///home/masch/dev/js/sonora/api/src/middleware/__tests__/cors.test.ts)

- Test CORS preflight OPTIONS and standard request handling:
  - Allowed origin match.
  - Allowed origin mismatch (blocked).
  - Custom allowed methods and headers mapping.
  - Support for `process.env` loading.

#### [NEW] [db-injector.test.ts](file:///home/masch/dev/js/sonora/api/src/middleware/__tests__/db-injector.test.ts)

- Test database client injection into request context and dynamic fallback database initialization.

---

### Route Tests

#### [MODIFY] [feedback.test.ts](file:///home/masch/dev/js/sonora/api/src/__tests__/feedback.test.ts)

- Remove tests related to CORS, database helper unit tests, and injector middleware checks.
- Keep tests validating POST `/feedback` request body parsing, KV stores logic, database duplicate checking, and error handling.

---

## Verification Plan

### Automated Tests

- Run `make validate` to verify all modular test files pass successfully.
