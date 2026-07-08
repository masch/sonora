# Version Pinning Specification

## Purpose

Ensure deterministic dependency resolution across the Sonora monorepo by requiring exact pinned versions in all `package.json` files. This eliminates Dependabot's inability to scan range constraints (`*`, `^`, `~`) and establishes a verifiable audit trail for all dependencies.

## Requirements

### Requirement: PIN.1 — Exact Version Constraints

Every `dependencies` and `devDependencies` entry in every `package.json` file within the monorepo MUST use an exact pinned version.

- A version constraint is "exact" when it contains no leading range specifier (`^`, `~`, `*`).
- `workspace:*` references (internal monorepo path aliases) are exempt — they are not version constraints.
- Root-level `overrides` and `resolutions` entries are exempt.
- Already-exact versions (e.g., `"1.30.1"`) are already compliant and MUST NOT be changed.

#### Scenario: All range constraints are pinned to exact versions

- GIVEN a `package.json` file containing `"hono": "^4.7.5"`, `"drizzle-orm": "*"`, or `"jest-expo": "~56.0.5"`
- WHEN the pinning pass is applied
- THEN each such constraint MUST be replaced with the exact resolved version from `bun.lock` (e.g., `"^4.7.5"` → `"4.12.27"`, `"*"` → `"0.45.2"`, `"~56.0.5"` → `"56.0.5"`)

#### Scenario: workspace:* references are preserved

- GIVEN a dependency entry such as `"@sonora/shared": "workspace:*"`
- WHEN the pinning pass is applied
- THEN the `workspace:*` value MUST remain unchanged

### Requirement: PIN.2 — Version Source

Pinned versions MUST be resolved from the current `bun.lock` file to ensure that the pinned value matches what `bun install` actually installs for the current lockfile state.

#### Scenario: Resolve from lockfile

- GIVEN a dependency `hono` with version `^4.7.5` in `apps/api/package.json`
- WHEN the resolved version is determined
- THEN it MUST match the exact version recorded for `hono` in `bun.lock` (currently `4.12.27`)

#### Scenario: Resolved version is a string, not a range

- GIVEN `bun.lock` resolves `drizzle-orm` to version `0.45.2`
- WHEN the pinned value is written to `package.json`
- THEN it MUST be `"0.45.2"` — a plain version string with no `^`, `~`, or `*` prefix

### Requirement: PIN.3 — Install Integrity After Pinning

After all version constraints are pinned, `bun install` MUST complete successfully with no resolution errors.

#### Scenario: Clean install after pinning

- GIVEN all four affected `package.json` files have been updated with exact pinned versions
- WHEN `bun install` is executed from the repository root
- THEN it MUST complete successfully (exit code 0) with no resolution warnings or errors
- AND the `bun.lock` file MUST remain unchanged (pinning did not alter resolved versions)

### Requirement: PIN.4 — Scope of Changes

The pinning MUST be applied to exactly 26 version constraint entries across four files. No other `package.json` files in the monorepo SHALL be modified.

| File                           | Entries to pin                                                                                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api/package.json`        | 12 (hono, drizzle-orm, pg, @neondatabase/serverless, @hono/node-server, @cloudflare/workers-types, vitest, wrangler, drizzle-kit, @types/pg, @types/node, tsx)                                               |
| `apps/mobile/package.json`     | 10 (@expo-google-fonts/caveat, @react-native-firebase/analytics, @react-native-firebase/app, @react-native-firebase/crashlytics, firebase, zustand, @types/leaflet, firebase-tools, react-doctor, jest-expo) |
| `apps/admin/package.json`      | 2 (zustand, jest-expo)                                                                                                                                                                                       |
| `packages/shared/package.json` | 2 (zod, vitest)                                                                                                                                                                                              |

#### Scenario: All four files are updated

- GIVEN the four affected `package.json` files
- WHEN pinning is applied
- THEN each of the 26 version constraints listed above MUST be updated to exact versions

#### Scenario: Root package.json is not modified

- GIVEN the root `package.json` with `"lightningcss": "1.30.1"` (already exact)
- WHEN pinning is applied
- THEN the root `package.json` MUST remain unchanged (no diffs)

#### Scenario: No extra files are modified

- GIVEN the pinning pass runs
- WHEN the working tree is inspected for changes
- THEN ONLY the four listed `package.json` files SHALL show modifications
