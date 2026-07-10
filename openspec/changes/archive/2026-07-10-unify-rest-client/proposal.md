# Proposal: Unify REST Client Core

## Intent

Unify the generic REST client calling logic from `apps/admin` and `apps/mobile` into the shared `@sonora/shared` package. This eliminates code duplication, standardizes error handling, type-safety, and header configuration, and provides a clean, platform-agnostic interface for HTTP requests.

## Scope

### In Scope

- Create `BaseApiClient` in `@sonora/shared` with generic type-safe signatures (no `any`).
- Implement `ApiError` class in `@sonora/shared` to encapsulate failed HTTP responses.
- Abstract token-based authentication and offline/caching mechanisms via configuration parameters.
- Migrate `apps/admin/src/services/admin-api-client.ts` to extend the shared client.
- Migrate `apps/mobile/src/services/api-client.ts` to extend the shared client.

### Out of Scope

- Changing the backend APIs or changing the React hooks consuming these clients.
- Modifying security policies of the APIs themselves.

## Capabilities

### New Capabilities

- `rest-client`: Core HTTP client wrapping fetch with support for serialization, strict type-safe data transform, `ApiError` mapping, token-based authentication, and optional offline caching.

### Modified Capabilities

- None

## Approach

1. Extract a configurable `BaseApiClient` class inside `@sonora/shared` under `src/api/base-client.ts`.
2. Define `ApiError` class inheriting from `Error` to return structured status codes, status text, and response body.
3. Define a configuration interface `ApiClientConfig` with:
   - `baseUrl: string`
   - `getAuthToken?: () => string | null | Promise<string | null>`
   - `storage?: { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void>; }`
4. Expose `request`, `get`, `post`, `put`, `delete` methods in `BaseApiClient` covering common headers (e.g. `Content-Type: application/json`), method logic, request body serialization, response code validation, and offline caching logic.
5. Export the new modules in `@sonora/shared/src/index.ts`.
6. Update `admin-api-client.ts` and `api-client.ts` to instantiate `BaseApiClient`.

## Affected Areas

| Area                                          | Impact   | Description                                 |
| --------------------------------------------- | -------- | ------------------------------------------- |
| `packages/shared/src/api/base-client.ts`      | New      | Generic REST client core and ApiError.      |
| `packages/shared/src/index.ts`                | Modified | Exports the new BaseApiClient and ApiError. |
| `apps/admin/src/services/admin-api-client.ts` | Modified | Uses BaseApiClient instance.                |
| `apps/mobile/src/services/api-client.ts`      | Modified | Uses BaseApiClient instance with caching.   |

## Risks

| Risk                                                                                                                         | Likelihood | Mitigation                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------- |
| Authentication token retrieval becomes asynchronous (e.g. in React Native Secure Store) causing headers to not load in time. | Low        | BaseApiClient configuration allows `getAuthToken` to return `Promise<string      | null>`. |
| Caching implementation in mobile behaves differently under BaseApiClient.                                                    | Med        | Write detailed unit tests matching the existing caching rules for mobile client. |

## Rollback Plan

Revert git changes using:

```bash
git checkout -- packages/shared apps/admin apps/mobile
```

## Dependencies

- None

## Success Criteria

- [ ] `BaseApiClient` handles request wrapping, JSON serialization/parsing, and custom error reporting correctly.
- [ ] Both admin and mobile clients compile and pass tests successfully.
- [ ] Admin authentication and mobile offline caching continue to work exactly as they did before the refactoring.
