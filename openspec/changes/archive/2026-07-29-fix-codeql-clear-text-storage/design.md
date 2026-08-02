# Design: HttpOnly Cookie Authentication for Admin API

## Problem Analysis

Holding the admin key in client-side memory (`inMemoryAuthKey`) triggered CodeQL `js/clear-text-storage-of-sensitive-data` and exposed credentials to potential XSS extraction.

## Architecture & Data Flow

```mermaid
sequenceDiagram
    participant Client as Admin Frontend (React)
    participant API as Hono Backend API
    participant Cookie as Browser Cookie Store

    Client->>API: POST /api/translations/session (body key)
    API->>API: Verify key against ADMIN_API_KEY (timingSafeEqual)
    API-->>Cookie: Set-Cookie admin_session (HttpOnly, SameSite=Strict, Path=/api)
    API-->>Client: 200 OK (valid true)

    Client->>API: GET /api/translations/es (Browser attaches cookie)
    API->>API: requireAdminKey middleware verifies admin_session cookie
    API-->>Client: 200 OK (translations object)
```

## Detailed Component Changes

### 1. `apps/api`

- **Cookies middleware / helper:** Use Hono's `hono/cookie` (`getCookie`, `setCookie`, `deleteCookie`).
- **Session verification:** Store a signed session token or validate the cookie value against a hashed `ADMIN_API_KEY` token using timing-safe comparison.
- **Middleware `requireAdminKey`:** Check for valid `admin_session` cookie first; fallback to `Authorization: Bearer <key>` if provided for programmatic CLI access.

### 2. `apps/admin`

- **`AdminApiClient`:** Remove `inMemoryAuthKey`, `setAuthKey`, `getAuthKey`, `clearAuthKey`.
- **Fetch options:** Ensure `credentials: 'include'` is set on all fetch requests.
- **Login / Logout:** `login(key)` calls `POST /api/admin/session`; `logout()` calls `DELETE /api/admin/session`.
