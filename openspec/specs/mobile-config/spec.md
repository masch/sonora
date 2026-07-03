# Mobile Config Specification

## Requirements

### Requirement: appVersion section in RemoteConfigPayload

The `RemoteConfigPayload` schema MUST include an `appVersion` object with three fields:

| Field                | Type    | Default   | Description                                             |
| -------------------- | ------- | --------- | ------------------------------------------------------- |
| `minimumVersion`     | string  | `"1.0.0"` | Minimum acceptable app version (semver)                 |
| `blockOlderVersions` | boolean | `false`   | `true` blocks access, `false` shows warning only        |
| `gracePeriodDays`    | integer | `0`       | Days before block enforcement activates (0 = immediate) |

The Zod schema MUST validate these fields with appropriate type constraints. Invalid types SHALL be rejected; missing values SHALL fall back to defaults via the existing `mergeRemoteConfig` pattern.

#### Scenario: appVersion section is returned in config payload

- GIVEN the API returns a full config payload
- WHEN the response is parsed through `RemoteConfigPayloadSchema`
- THEN `appVersion` contains `minimumVersion`, `blockOlderVersions`, and `gracePeriodDays`
- AND invalid field types are rejected by Zod validation
- AND missing fields use defaults

#### Scenario: Defaults when appVersion is absent from response

- GIVEN the API returns a config payload with no `appVersion` key
- WHEN `mergeRemoteConfig` processes the response
- THEN `appVersion.minimumVersion` defaults to `"1.0.0"`
- AND `appVersion.blockOlderVersions` defaults to `false`
- AND `appVersion.gracePeriodDays` defaults to `0`
