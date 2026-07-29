# Tasks: Admin Auth HttpOnly Cookie Migration

- [x] 1. Add session endpoints (`POST /api/translations/session` and `DELETE /api/translations/session`) in `apps/api/src/routes/translations.ts`.
- [x] 2. Update `requireAdminKey` middleware in `apps/api/src/middleware/require-admin-key.ts` to check `admin_session` cookie and perform constant-time verification.
- [x] 3. Update `apps/admin/src/services/admin-api-client.ts` to use cookie-based requests (`credentials: 'include'`) and remove client-side key storage.
- [x] 4. Update `apps/admin/src/app/login.tsx` to handle session creation.
- [x] 5. Update and add unit tests for session endpoints and client authentication (`bun test`).
