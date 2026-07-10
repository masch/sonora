# Design: Unify REST Client Core

## Technical Approach

We will extract the HTTP request execution, JSON parsing, error wrapping, and optional offline caching logic from `apps/mobile/src/services/api-client.ts` and `apps/admin/src/services/admin-api-client.ts` into a unified `BaseApiClient` class inside the shared workspace `@sonora/shared`. We will also implement a custom `ApiError` class to wrap non-ok responses.

## Architecture Decisions

### Decision: Client Abstraction Strategy

**Choice**: Class-based instantiation (`BaseApiClient`).
**Alternatives considered**: Functional wrapper (`createApiClient`), raw function exports.
**Rationale**: Class instantiation allows encapsulating configuration parameters (e.g. `baseUrl`, `storage`, and `getAuthToken`) as private state. The derived clients in `apps/admin` and `apps/mobile` can export a singleton instance or subclass of `BaseApiClient`, keeping the consumption API clean and backward-compatible.

### Decision: Caching/Storage Adapter

**Choice**: Storage abstraction interface (`KeyValueStorage`).
**Alternatives considered**: Directly importing `@/storage/feedback-storage`.
**Rationale**: `@sonora/shared` is platform-agnostic and should not depend on React Native / Expo-specific storage modules. The config accepts any adapter matching the `KeyValueStorage` interface, allowing the mobile app to pass its `expo-sqlite/kv-store` adapter.

### Decision: Type Safety and Error Class

**Choice**: Define `ApiError` inheriting from `Error` and prohibit `any` throughout the API.
**Alternatives considered**: Return generic `Error` with message, or use `any` for request body / transform options.
**Rationale**: By creating a concrete `ApiError` class, clients can catch and inspect responses programmatically (checking status code, status text, and response body). The `transform` function and payloads will use generic types `<T, R = T>` and `unknown` instead of `any` to prevent type pollution in the workspace.

## Data Flow

```
Mobile/Admin Page ──→ ApiClient Instance (extends BaseApiClient)
                            │
                            ▼
                    BaseApiClient.request()
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
     Has cacheKey?                   No cacheKey
            │                               │
    Fetch (network)                 Fetch (network)
    Success ─→ Save Cache           Success ─→ Return parsed JSON
    Fail ─→ Load Cache from Storage  Fail ─→ Throw formatted ApiError
```

## File Changes

| File                                          | Action | Description                                       |
| --------------------------------------------- | ------ | ------------------------------------------------- |
| `packages/shared/src/api/base-client.ts`      | Create | Contains the base REST client logic and ApiError. |
| `packages/shared/src/index.ts`                | Modify | Exports the new class, ApiError, and interfaces.  |
| `apps/admin/src/services/admin-api-client.ts` | Modify | Extends/uses BaseApiClient.                       |
| `apps/mobile/src/services/api-client.ts`      | Modify | Extends/uses BaseApiClient with SQLite caching.   |

## Interfaces / Contracts

```typescript
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface ApiClientConfig {
  baseUrl: string;
  getAuthToken?: () => string | null | Promise<string | null>;
  storage?: KeyValueStorage;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  cacheKey?: string;
  skipCache?: boolean;
  body?: unknown;
  transform?: (data: unknown) => unknown;
  customErrorMessage?: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

## Testing Strategy

| Layer       | What to Test                                                                | Approach                                                            |
| ----------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Unit        | `BaseApiClient` requests, headers, and serialization.                       | Mock `fetch` in `@sonora/shared/src/__tests__/base-client.test.ts`. |
| Unit        | `BaseApiClient` token injection, ApiError propagation, and offline caching. | Mock storage adapter and test fail/cache-hit flows.                 |
| Integration | Admin API Client functionality.                                             | Run `bun --filter @sonora/admin typecheck` and tests.               |
| Integration | Mobile API Client functionality.                                            | Run `bun --filter @sonora/mobile typecheck` and tests.              |

## Migration / Rollout

No migration required. No DB scheme or remote endpoints are updated.

## Open Questions

None
