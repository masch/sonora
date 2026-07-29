# Proposal: Admin Auth via HttpOnly Cookies (Fix CodeQL Alert #3)

## Context

CodeQL alert #3 flags `apps/admin/src/services/admin-api-client.ts` for cleartext storage of sensitive data (`js/clear-text-storage-of-sensitive-data`). The user credential was being held in JavaScript memory in `AdminApiClient`.

## Goal

Implement secure, cookie-based authentication (`HttpOnly`, `Secure`, `SameSite=Strict`) for the Admin web dashboard and Hono backend API. This completely eliminates client-side credential storage and resolves the CodeQL alert at the architectural level.

## Proposed Solution

1. **API Backend (`apps/api`):**
   - Add `POST /api/admin/session` to validate `ADMIN_API_KEY` and set an encrypted/signed `HttpOnly` session cookie (`admin_session`).
   - Add `DELETE /api/admin/session` to clear the session cookie on logout.
   - Update `requireAdminKey` middleware to extract and validate the `admin_session` cookie in constant-time.
2. **Admin Web App (`apps/admin`):**
   - Update `LoginScreen` to call `POST /api/admin/session` with `credentials: 'include'`.
   - Remove all in-memory token/key storage from `AdminApiClient`.
   - Include `credentials: 'include'` in API fetch options.
