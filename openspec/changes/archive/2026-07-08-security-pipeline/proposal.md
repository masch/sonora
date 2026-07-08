# Security Pipeline — Proposal

## Intent

Solve Dependabot's inability to scan `*` and range constraints in a Bun monorepo, and establish an automated security pipeline that catches vulnerabilities proactively instead of relying on manual Dependabot alert processing.

## Background

Four Dependabot security alerts were all false positives — `bun.lock` already had patched versions. Root cause: `apps/api/package.json` uses `*` constraints that Dependabot cannot resolve from `bun.lock`. Additionally, the rest of the monorepo uses `^` and `~` range constraints which provide no deterministic audit trail.

## Scope

Three distinct work streams, all in the sonora monorepo:

### 1. Version constraint pinning

Replace **all** `*`, `^`, and `~` version constraints across every `package.json` with exact pinned versions using resolved versions from `bun.lock`.

**Affected files and resolved versions:**

| File                           | Package                            | Current         | Resolved       |
| ------------------------------ | ---------------------------------- | --------------- | -------------- |
| `apps/api/package.json`        | hono                               | `^4.7.5`        | `4.12.27`      |
| `apps/api/package.json`        | drizzle-orm                        | `*`             | `0.45.2`       |
| `apps/api/package.json`        | pg                                 | `*`             | `8.22.0`       |
| `apps/api/package.json`        | @neondatabase/serverless           | `*`             | `1.1.0`        |
| `apps/api/package.json`        | @hono/node-server                  | `*`             | `2.0.6`        |
| `apps/api/package.json`        | @cloudflare/workers-types          | `^4.20250204.0` | `4.20260624.1` |
| `apps/api/package.json`        | vitest                             | `^4.1.9`        | `4.1.9`        |
| `apps/api/package.json`        | wrangler                           | `^4.0.0`        | `4.103.0`      |
| `apps/api/package.json`        | drizzle-kit                        | `*`             | `0.31.10`      |
| `apps/api/package.json`        | @types/pg                          | `*`             | `8.20.0`       |
| `apps/api/package.json`        | @types/node                        | `*`             | `26.0.1`       |
| `apps/api/package.json`        | tsx                                | `*`             | `4.22.4`       |
| `apps/mobile/package.json`     | @expo-google-fonts/caveat          | `^0.4.2`        | `0.4.2`        |
| `apps/mobile/package.json`     | @react-native-firebase/analytics   | `^21.9.0`       | `21.14.0`      |
| `apps/mobile/package.json`     | @react-native-firebase/app         | `^21.9.0`       | `21.14.0`      |
| `apps/mobile/package.json`     | @react-native-firebase/crashlytics | `^21.9.0`       | `21.14.0`      |
| `apps/mobile/package.json`     | firebase                           | `^11.1.0`       | `11.3.1`       |
| `apps/mobile/package.json`     | zustand                            | `^5.0.14`       | `5.0.14`       |
| `apps/mobile/package.json`     | @types/leaflet                     | `^1.9.21`       | `1.9.21`       |
| `apps/mobile/package.json`     | firebase-tools                     | `^15.19.0`      | `15.22.2`      |
| `apps/mobile/package.json`     | react-doctor                       | `^0.5.8`        | `0.5.8`        |
| `apps/mobile/package.json`     | jest-expo                          | `~56.0.5`       | `56.0.5`       |
| `apps/admin/package.json`      | zustand                            | `^5.0.14`       | `5.0.14`       |
| `apps/admin/package.json`      | jest-expo                          | `~56.0.5`       | `56.0.5`       |
| `packages/shared/package.json` | zod                                | `^3.0.0`        | `3.25.76`      |
| `packages/shared/package.json` | vitest                             | `^4.1.9`        | `4.1.9`        |

**Not changed:**

- `workspace:*` references remain (they are internal monorepo aliases, not version ranges)
- `lightningcss` in root `package.json` — already exact (`1.30.1`)

### 2. Security audit workflow

Create `.github/workflows/security-audit.yml`:

- Runs on a weekly schedule (e.g., Monday 06:00 UTC)
- Supports `workflow_dispatch` for manual triggering
- Executes `bun audit` across the monorepo
- Fails the workflow if vulnerabilities are found above a configurable severity threshold
- Posts results as a workflow summary (or optionally creates a GitHub Issue)

### 3. Renovate integration

Add a `renovate.json` (or `.github/renovate.json`) at the repository root:

- Configure Renovate with native `bun` support (`enabledManagers: ["bun"]`)
- Set schedule to weekly
- Configure automerge for patch-level updates (optional, to be decided)
- Disable dependency dashboard or enable it based on preference
- Pin versions in renovate config to maintain deterministic installs

### 4. Notification workflow (optional expansion)

Create `.github/workflows/security-notify.yml` (or extend the audit workflow) that:

- Publishes security findings as GitHub Issues when `bun audit` finds vulnerabilities
- Optionally notifies maintainers via GitHub Issue assignment

## Non-goals

- **No automation for Dependabot alert processing** — Dependabot alerts continue to be handled manually
- **No changes to the Dependabot config** beyond what was already updated
- **No changes to `bun.lock`** — version changes happen through Renovate PRs and `bun install`
- **No npm audit or other ecosystem scanners** — this pipeline is Bun-native
- **No Socket.dev changes** — already configured in a separate workflow

## Affected areas

| Area                                    | Impact                            |
| --------------------------------------- | --------------------------------- |
| `apps/api/package.json`                 | 12 version constraints changed    |
| `apps/mobile/package.json`              | 10 version constraints changed    |
| `apps/admin/package.json`               | 2 version constraints changed     |
| `packages/shared/package.json`          | 2 version constraints changed     |
| `package.json` (root)                   | 0 changes needed (already pinned) |
| `.github/workflows/security-audit.yml`  | **New file**                      |
| `renovate.json` (root)                  | **New file**                      |
| `.github/workflows/security-notify.yml` | **New file** (optional)           |

## Risks

| Risk                                                 | Mitigation                                                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Pin conflicts with transitive peer dependency ranges | Run `bun install` after changes to verify resolution; peer dep warnings are informational, not blocking |
| Renovate may open many simultaneous PRs              | Use `dependencyDashboard: true`, limit `openPullRequestsLimit`, batch grouped updates                   |
| `bun audit` exit codes may be unexpected             | Test the workflow manually via `workflow_dispatch` before relying on scheduled runs                     |
| Version pinning could make future upgrades harder    | This is the point — Renovate handles upgrades via PRs; pinning makes the audit trail deterministic      |

## Rollback

- Version pinning: revert each `package.json` change via `git checkout HEAD -- <file>` or a single `git revert`
- Workflow files: delete `security-audit.yml`, `renovate.json`, `security-notify.yml`
- If Renovate has already opened PRs, close them without merging

## Success criteria

1. **All package.json files** across the monorepo have zero `*`, `^`, or `~` constraints — only exact versions and `workspace:*` references remain
2. **`bun install` succeeds** after pinning changes — no broken resolutions
3. **`bun audit` passes** or reports expected findings (no new false positives)
4. **Security audit workflow** runs on schedule and via `workflow_dispatch`
5. **Renovate** is configured and operational — dependency update PRs appear within the first week
6. **No regressions** in CI — existing PR and deploy workflows continue to pass

## Future considerations (out of scope)

- Automated Dependabot alert handling (e.g., auto-dismiss based on severity or package)
- Dependency budget enforcement (e.g., fail CI if new deps exceed a threshold)
- SBOM generation or export
- Container image scanning (if the project containerizes)
