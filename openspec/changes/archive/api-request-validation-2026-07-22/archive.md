# Archive: API Request Validation

## Summary

Standardized HTTP request validation across the Hono API. Replaced TypeScript casts + ad-hoc manual checks with `@hono/zod-validator` + shared Zod schemas. Normalized all error responses to `{code, detail, status}` format. Created reusable middleware for admin auth, database guarding, and device identity.

## Deliverables

| Artifact              | Location                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------- |
| **51 files changed**  | 5434 insertions, 710 deletions                                                            |
| **Routes refactored** | feedback, payments, audio, translations, experiences, themes, health, config, association |
| **Schemas (shared)**  | `packages/shared/src/schemas/payments.ts`, `audio.ts`                                     |
| **Middleware**        | `require-admin-key`, `validation-error`, `db-guard`, `device-id-guard`, `problem-details` |
| **Test files**        | 29 files, 299 tests                                                                       |

## Key Metrics

| Metric                         | Value                                           |
| ------------------------------ | ----------------------------------------------- |
| Test count                     | 299 (was ~228 before)                           |
| Test files                     | 29 (was ~23 before)                             |
| tsc                            | 0 errors                                        |
| Hardcoded HTTP codes in routes | 0 (all via `HTTP.XXX` constants)                |
| Hardcoded `c.json` in routes   | 0 (all via `success()`/`created()`/`problem()`) |
| `if (!db)` guards in routes    | 1 exception (`translations.ts GET /:lang`)      |

## Design Decisions

- **`{code, detail, status}` instead of `{type, title, status}`**: Machine-readable code is more useful than a URI; no client consumed the URI
- **5xx detail always sanitized**: `"An unexpected error occurred"` for all status >= 500; specific `code` preserved for logging
- **`dbGuard()` middleware**: Eliminated 8+ inline `if (!db) return problem(c, ERRORS.DB_NOT_AVAILABLE)` checks
- **`FEEDBACK_MAX_LENGTH` removed**: Replaced by fixed `.max(1000)` in Zod schema — always 1000 everywhere
- **Error propagation**: Generic 5xx try/catch removed — errors go to `onError` for unified handling
