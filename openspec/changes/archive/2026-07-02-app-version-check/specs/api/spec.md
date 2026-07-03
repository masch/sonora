# Delta for api

## ADDED Requirements

### Requirement: Version environment variables

The API `Env` interface MUST include three optional bindings:

| Binding                | Type   | Default   | Description                              |
| ---------------------- | ------ | --------- | ---------------------------------------- |
| `MINIMUM_APP_VERSION`  | string | `"1.0.0"` | Minimum app version to enforce           |
| `BLOCK_OLDER_VERSIONS` | string | `"false"` | Enables blocking (parsed as boolean)     |
| `GRACE_PERIOD_DAYS`    | string | `"0"`     | Grace window in days (parsed as integer) |

Defaults MUST be defined in `wrangler.toml` under `[vars]` and MAY be overridden at runtime via Cloudflare dashboard env vars.

### Requirement: Version fields in config response

The `GET /config` endpoint MUST include an `appVersion` object in its response body.

- `minimumVersion` — string from `MINIMUM_APP_VERSION`
- `blockOlderVersions` — boolean parsed from `BLOCK_OLDER_VERSIONS`
- `gracePeriodDays` — integer parsed from `GRACE_PERIOD_DAYS`

The response SHALL satisfy the updated `RemoteConfigPayloadSchema`.

#### Scenario: Config endpoint returns appVersion section

- GIVEN env vars `MINIMUM_APP_VERSION=2.0.0`, `BLOCK_OLDER_VERSIONS=true`, `GRACE_PERIOD_DAYS=7`
- WHEN the client requests `GET /config`
- THEN the response body includes `appVersion: { minimumVersion: "2.0.0", blockOlderVersions: true, gracePeriodDays: 7 }`

#### Scenario: Missing env vars fall back to defaults

- GIVEN no version-related env vars are set in wrangler.toml
- WHEN the client requests `GET /config`
- THEN the response body includes `appVersion: { minimumVersion: "1.0.0", blockOlderVersions: false, gracePeriodDays: 0 }`
