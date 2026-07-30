# Mobile — Remote Config Provider

## Purpose

Fetch runtime config at startup, merge over `APP_CONFIG` defaults, expose via React Context. Degrade gracefully when unreachable.

## Requirements

### Requirement: Startup fetch

The system MUST fetch `GET /api/config` during init, before the first screen renders.

#### Scenario: Happy path

- GIVEN the API responds with valid JSON
- WHEN the app starts
- THEN remote values overwrite `APP_CONFIG` defaults
- AND merged config is available to all components

#### Scenario: Offline startup

- GIVEN the device is offline
- WHEN the app starts
- THEN the fetch fails silently
- AND `APP_CONFIG` defaults are used

### Requirement: 3s timeout

The fetch MUST abort after 3 seconds.

#### Scenario: Timeout

- GIVEN the API does not respond within 3s
- WHEN the fetch is aborted
- THEN defaults are used
- AND the app is not blocked

### Requirement: AsyncStorage cache

On success the system SHOULD persist to AsyncStorage. On failure the system SHOULD use cached config if available, else defaults.

#### Scenario: Stale cache

- GIVEN a prior successful fetch (cached)
- AND the device is now offline
- WHEN the app starts and the fetch fails
- THEN cached config is returned
- AND defaults fill fields absent from cache

#### Scenario: First launch offline

- GIVEN no cache exists
- AND the device is offline
- WHEN the app starts
- THEN `APP_CONFIG` defaults are used

### Requirement: Invalid response

If the response is not valid JSON, or contains type mismatches, the system MUST discard the remote value for the affected field(s) and keep defaults.

#### Scenario: Partial response

- GIVEN the API returns `{"bypassGeofence": true}`
- WHEN processed
- THEN `bypassGeofence` = `true`
- AND missing fields keep defaults

#### Scenario: Type mismatch

- GIVEN `"geofence": {"radiusMeters": "not-a-number"}`
- WHEN processed
- THEN the invalid field is discarded
- AND `geofence.radiusMeters` = `50`
- AND the error is logged

### Requirement: useRemoteConfig hook

The system MUST expose a `useRemoteConfig()` hook returning the merged config.

#### Scenario: Hook access

- GIVEN a component calls `useRemoteConfig()`
- WHEN it reads a property
- THEN the value reflects merged remote+default config

### Requirement: No runtime polling

The system MUST NOT re-fetch config after the initial startup load.

#### Scenario: Config is session-scoped

- GIVEN the app has been running for 10 minutes
- WHEN the upstream config changes
- THEN the running app is unaffected until next cold start
