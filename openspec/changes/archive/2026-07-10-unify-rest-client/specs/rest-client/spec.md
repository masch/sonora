# REST Client Specification

## Purpose

This specification defines the behavior of the core REST API Client (`BaseApiClient`) and its error representation (`ApiError`) used across the apps in the Sonora monorepo. It ensures consistent handling of HTTP requests, authentication, type safety, and offline caching.

## Requirements

### Requirement: Request Serialization and Parsing

The REST client MUST automatically serialize JSON payloads for outgoing requests and parse JSON responses.

#### Scenario: Send JSON payload and receive JSON response

- GIVEN a REST client configured with a base URL
- WHEN a `post` request is made to `/api/data` with a JS object body
- THEN the client MUST serialize the body to a JSON string
- AND the client MUST set the `Content-Type` header to `application/json`
- AND the client MUST parse the response JSON into a JS object

### Requirement: Error Handling via ApiError

The REST client MUST check the HTTP response status and throw an `ApiError` instance for non-ok status codes (status < 200 or status >= 300). No `any` types MUST be used in error payloads.

#### Scenario: Request returns 400 Bad Request with json error body

- GIVEN a REST client configured with a base URL
- WHEN a request is made to an endpoint that returns status 400 with a body `{"error": "Invalid format"}`
- THEN the client MUST throw an `ApiError` instance
- AND the thrown error `status` MUST be `400`
- AND the thrown error `body` MUST match the parsed JSON `{"error": "Invalid format"}`

### Requirement: Authentication Token Injection

The REST client MUST support dynamic injection of an Authorization Bearer token via sync or async getters.

#### Scenario: Authorization token is present from getter

- GIVEN a REST client configured with a `getAuthToken` function returning `"test-token"`
- WHEN a request is made
- THEN the client MUST include the header `Authorization: Bearer test-token`

#### Scenario: Authorization token is null from getter

- GIVEN a REST client configured with a `getAuthToken` function returning `null`
- WHEN a request is made
- THEN the client MUST NOT include the `Authorization` header

### Requirement: Offline Caching

The REST client MUST support offline caching for GET requests if a storage adapter is configured.

#### Scenario: Fetch fails and returns cached data

- GIVEN a REST client configured with a `storage` adapter containing cached data for key `"my-cache"`
- AND the network is offline or the fetch fails
- WHEN a `get` request is made with `cacheKey` set to `"my-cache"`
- THEN the client MUST return the cached data from storage
