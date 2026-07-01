# API Client Refactor — Unified Offline Fallback Specification

## Purpose

Eliminate duplicated `fetch` + try/catch + offline-cache logic scattered across hooks, data providers, and components by extracting a single `ApiClient` service. GET requests cache automatically; POST requests pass through without caching. Offline fallback is transparent to consumers.

## Requirements

### Requirement: Centralized HTTP Client

The system MUST expose a single `ApiClient` object with `get<T>()`, `post<T>()`, and a lower-level `request<T>()` method. All consumers MUST use this client instead of calling `fetch` directly.

#### Scenario: Successful GET

- GIVEN the device has connectivity
- WHEN a consumer calls `ApiClient.get('/path')`
- THEN the client performs a `fetch` with `Content-Type: application/json`, returns the parsed JSON, and (if `cacheKey` is provided) stores the result in SQLite KV-store asynchronously

#### Scenario: Successful POST

- GIVEN the device has connectivity
- WHEN a consumer calls `ApiClient.post('/path', body)`
- THEN the client serializes `body` to JSON (unless it is already a string), performs a `fetch` with method POST, and returns the parsed JSON response

### Requirement: Automatic GET Cache with Offline Fallback

For GET requests where a `cacheKey` is provided and `skipCache` is not `true`, the client MUST implement a cache-then-fallback strategy.

#### Scenario: Online — cache write

- GIVEN the network request succeeds
- WHEN the response is `ok`
- THEN the response JSON (after optional `transform`) is stored in the KV-store under `cacheKey` asynchronously, and the transformed data is returned

#### Scenario: Offline — cache hit

- GIVEN the network request fails (network error or non-ok status)
- WHEN cached data exists for `cacheKey`
- THEN the cached data is returned transparently and an `[Offline Mode]` info log is emitted

#### Scenario: Offline — cache miss

- GIVEN the network request fails
- WHEN no cached data exists for `cacheKey`
- THEN the original network error is re-thrown

#### Scenario: Cache write failure

- GIVEN the network request succeeds
- WHEN `setItem` fails (e.g. disk full)
- THEN the response is still returned to the caller and a warning is logged

### Requirement: Response Transform

The client MUST accept an optional `transform` function that maps the raw JSON response before caching and returning.

#### Scenario: Transform applied

- GIVEN `transform` is provided
- WHEN the request succeeds
- THEN `transform(rawData)` is called, the result is cached (not the raw data), and the transformed result is returned

### Requirement: Custom Error Messages

The client MUST accept an optional `customErrorMessage` string. When the server returns a non-ok status and this option is set, the thrown `Error` MUST use `customErrorMessage` instead of the generic `Request failed with status N`.

### Requirement: URL Construction

- Relative paths (not starting with `http`) MUST be prefixed with `APP_CONFIG.apiBaseUrl`
- Absolute URLs (starting with `http`) MUST be used as-is

### Requirement: Body Serialization

- Object bodies MUST be serialized via `JSON.stringify`
- String bodies MUST be passed through without double-serialization
- Undefined bodies MUST NOT set `body` on the fetch config
