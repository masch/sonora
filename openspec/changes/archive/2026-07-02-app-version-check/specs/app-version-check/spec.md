# App Version Check Specification

## Purpose

Gate the app at startup based on a remotely-controlled minimum version requirement. Warn or block old clients to prevent degraded UX while allowing a configurable grace period.

## Requirements

### Requirement: Version comparison

The system MUST compare the installed app version against the configured minimum version using an inline semver `gte()` utility — no new dependencies.

- `gte(current, minimum)`: returns `true` when current >= minimum (major.minor.patch)
- Non-parseable version strings MUST be treated as failing the check (fail-closed: block)

### Requirement: Version status resolution

The system MUST resolve a `versionStatus` enum (`'ok' | 'warn' | 'block'`) after each config fetch:

| Condition                                     | Status  |
| --------------------------------------------- | ------- |
| current >= minimum                            | `ok`    |
| current < minimum, `blockOlderVersions=false` | `warn`  |
| current < minimum, `blockOlderVersions=true`  | `block` |
| Invalid version string                        | `block` |

The status MUST be exposed as a derived property on `useRemoteConfigStore`.

#### Scenario: Sufficient version shows no UI

- GIVEN minimum version `2.0.0` and installed version `2.0.0`
- WHEN `gte()` evaluates both strings
- THEN `versionStatus` is `'ok'`
- AND no blocking UI is rendered

#### Scenario: Below minimum with blocking shows block modal

- GIVEN minimum version `2.0.0`, installed version `1.5.0`, and `blockOlderVersions=true`
- WHEN `gte("1.5.0", "2.0.0")` returns `false`
- THEN `versionStatus` is `'block'`
- AND a non-dismissable full-screen modal renders with update-required message

#### Scenario: Below minimum with warning shows dismissable banner

- GIVEN minimum version `2.0.0`, installed version `1.5.0`, and `blockOlderVersions=false`
- WHEN `gte("1.5.0", "2.0.0")` returns `false`
- THEN `versionStatus` is `'warn'`
- AND a dismissable warning banner renders at the top of the screen

#### Scenario: Non-parseable version string fails closed

- GIVEN minimum version `abc` and installed version `1.0.0`
- WHEN `gte("1.0.0", "abc")` fails to parse
- THEN `versionStatus` is `'block'`

### Requirement: Grace period

The system SHOULD suppress `block` status for a configurable grace period after first detection.

- The grace period start timestamp MUST be persisted in local storage (`expo-sqlite/kv-store`)
- Within the grace window, `block` downgrades to `warn`
- After expiry, `block` re-activates
- If `gracePeriodDays` is 0, the block activates immediately

#### Scenario: Grace period suppresses block

- GIVEN minimum version `2.0.0`, installed version `1.0.0`, `blockOlderVersions=true`, and `gracePeriodDays=3`
- WHEN first block detection occurs
- THEN `versionStatus` is `'warn'`
- AND a local storage timestamp is recorded
- AND a subsequent check within 3 days still returns `'warn'`
- AND a subsequent check after 3 days returns `'block'`

### Requirement: Offline first-launch

If no cached config exists and the device is offline, the system MUST skip the version check and launch normally. The next online config fetch SHALL run the check.

#### Scenario: Offline fresh install skips check

- GIVEN no cached config and no network
- WHEN the app initializes
- THEN `versionStatus` is `'ok'`
- AND the app renders without gating

### Requirement: UI for block state

The system MUST render a full-screen modal when `versionStatus='block'`.

- The modal MUST be non-dismissable (no close, swipe, or back navigation)
- The modal MUST display update-required text
- The modal MUST prevent access to app content beneath it

### Requirement: UI for warn state

The system SHOULD render a dismissable banner when `versionStatus='warn'`.

- The banner MUST display a warning about the outdated version
- The user MUST be able to dismiss the banner
- The app MUST function normally after dismissal

### Requirement: i18n for version check strings

All user-facing version check strings MUST be translated in `en` and `es` locales.

#### Scenario: Strings render in both locales

- GIVEN version check is triggered with language set to `en`
- WHEN the block modal or warning banner renders
- THEN all version-related strings appear in English
- GIVEN language set to `es`
- WHEN the block modal or warning banner renders
- THEN all version-related strings appear in Spanish
