# API — Remote Config Endpoint

## Purpose

Serve runtime-configurable app settings via `GET /api/config`. No auth, no DB, static JSON.

## Requirements

### Requirement: Config endpoint

`GET /api/config` MUST return the full config object.

| Field                      | Type    | Example |
| -------------------------- | ------- | ------- |
| `geofence.radiusMeters`    | number  | `50`    |
| `bypassGeofence`           | boolean | `false` |
| `audio.rewindOffsetMs`     | number  | `10000` |
| `feedback.syncIntervalSec` | number  | `30`    |

#### Scenario: Happy path

- GIVEN the API is running
- WHEN a client sends `GET /api/config`
- THEN status is `200`, `Content-Type: application/json`
- AND the body has all fields with correct types

#### Scenario: No null values

- GIVEN any config field in the source
- WHEN serialised
- THEN every key has a non-null value

### Requirement: No side effects

The endpoint MUST NOT read or write to any external store.

#### Scenario: Stateless

- GIVEN a request arrives
- WHEN the endpoint handles it
- THEN no DB, KV, or filesystem operations occur
- AND latency is under 50ms

### Requirement: CORS

The endpoint SHOULD apply the same CORS middleware as other routes.
