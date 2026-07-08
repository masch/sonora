# Dependency Updates Specification

## Purpose

Automate dependency update management through Renovate (free Community Cloud tier), ensuring timely security patches and version upgrades while maintaining deterministic installs via pinned versions.

## Requirements

### Requirement: DEP.1 — Renovate Configuration File

The repository MUST contain a `renovate.json` configuration file at its root.

#### Scenario: Configuration file exists at root

- GIVEN the repository root directory
- WHEN the file system is inspected
- THEN `renovate.json` MUST exist with valid JSON syntax

### Requirement: DEP.2 — Bun Manager

Renovate MUST be configured with `enabledManagers` set to `["bun"]` only, to handle Bun-native dependency resolution and avoid interference with other package managers.

#### Scenario: Bun-only dependency management

- GIVEN the `renovate.json` configuration
- WHEN `enabledManagers` is evaluated
- THEN it MUST contain `"bun"` and MUST NOT list other managers (e.g., `npm`, `maven`, `docker-compose`)

### Requirement: DEP.3 — Weekly Update Schedule

Renovate MUST be configured with a weekly schedule to batch dependency updates into a predictable cadence.

#### Scenario: Weekly update window

- GIVEN the `renovate.json` configuration
- WHEN the `schedule` field is evaluated
- THEN it MUST specify a weekly cadence (e.g., `["before 6am on Monday"]`)
- AND it MUST NOT specify a daily or more frequent schedule

### Requirement: DEP.4 — Dependency Dashboard

Renovate MUST have the dependency dashboard enabled to give maintainers visibility into all pending and available updates.

#### Scenario: Dashboard is enabled

- GIVEN the `renovate.json` configuration
- WHEN `dependencyDashboard` is evaluated
- THEN it MUST be set to `true`

### Requirement: DEP.5 — Deterministic Version Pinning

Renovate MUST be configured to propose exact pinned versions (not range updates) in its PRs, consistent with the version pinning policy.

#### Scenario: Renovate pins on update

- GIVEN Renovate detects an available update for a dependency
- WHEN Renovate creates a PR
- THEN the PR MUST update the version constraint to an exact pinned version (no `^` or `~` prefix)
- AND the PR MUST also update `bun.lock` to reflect the new resolution

### Requirement: DEP.6 — Renovate Operational

Within one week of configuration, Renovate MUST produce at least one dependency update PR (or report zero updates available via the dependency dashboard).

#### Scenario: Renovate produces update PRs

- GIVEN Renovate is configured with a weekly schedule
- WHEN the first scheduled run occurs
- THEN one of the following MUST be true:
  - At least one dependency update PR is created, OR
  - The dependency dashboard shows that all dependencies are up to date
