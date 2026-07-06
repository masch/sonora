# Delta for CI Infrastructure

## ADDED Requirements

### Requirement: CI.5 — Composite Bun Setup Action

The system MUST provide a reusable composite action at `.github/actions/setup/action.yml` that wraps `actions/checkout@v5`, `oven-sh/setup-bun@v2`, `actions/cache@v5`, and `bun install --frozen-lockfile` into a single step. The action MUST accept a `fetch-depth` input (default: 1). The action MUST cache `node_modules/`, `apps/*/node_modules/`, `packages/*/node_modules/` with key `bun-${{ hashFiles('bun.lock') }}` and restore-keys `bun-`. The action MUST NOT include the `--minimum-release-age` flag. All 18 inline `bun install` occurrences across 10 workflows MUST be replaced with `uses: ./.github/actions/setup`.

#### Scenario: Cache hit

- GIVEN bun.lock is unchanged from a previous run
- WHEN the setup action runs
- THEN cache restores node_modules from the exact key match
- AND `bun install --frozen-lockfile` completes quickly (existing packages)

#### Scenario: Cache miss with fallback

- GIVEN bun.lock changed (no exact key match)
- WHEN the setup action runs
- THEN cache restore falls back to `bun-` partial cache
- AND `bun install --frozen-lockfile` fetches remaining packages
- AND cache saves the new key for future runs

#### Scenario: Full git history

- GIVEN a workflow job requires full git history (e.g., versionCode bump)
- WHEN the job passes `fetch-depth: 0` to the setup action
- THEN checkout performs a deep clone with full history

### Requirement: CI.6 — Workflow Naming Convention

All workflow files MUST follow the convention `{category}-{app}-{env}.yml`. Categories: `ci` (quality/security), `deploy` (deployments), `admin` (maintenance). Apps: `mobile`, `admin`, `api`, `all`. Env: `production`, `staging` — omitted for CI-only workflows. Platform suffixes (`web`, `android`) are permitted only when splitting by platform within an app. Nine existing workflow files MUST be renamed via `git mv` to match this convention, and all `workflow_call` references to renamed files MUST be updated.

#### Scenario: Full rename cycle

- GIVEN `commitlint.yml` is renamed to `ci-commitlint.yml` via `git mv`
- WHEN any workflow references `commitlint.yml` via `workflow_call`
- THEN that reference is updated to `ci-commitlint.yml`

#### Scenario: No env for CI

- GIVEN `validate-api-staging.yml` (currently misnamed — validates PRs, not in staging)
- WHEN renamed to `ci-api.yml`
- THEN the `-staging` suffix is dropped because this is a CI-only workflow

#### Scenario: Platform suffix for mobile

- GIVEN mobile deploy is split by platform (web vs android)
- WHEN the workflow targets a single platform
- THEN the name MUST include the platform suffix: `deploy-mobile-web-production.yml` or `deploy-mobile-android-production.yml`

### Requirement: CI.7 — Configurable Mobile Staging Deploy

The `deploy-mobile-staging.yml` workflow MUST support `workflow_dispatch` inputs for conditional execution. Inputs: `deploy_web` (boolean, default: true), `deploy_android` (boolean, default: false), `firebase_team` (choice: `internal` | `external`, default: `internal`). The workflow MUST conditionally skip web or Android jobs based on these inputs. Android build MUST use the selected `firebase_team` for Firebase App Distribution.

#### Scenario: Web-only deploy

- GIVEN `deploy_web=true` and `deploy_android=false`
- WHEN the workflow dispatches
- THEN only the web build and deploy job runs
- AND the Android build job is skipped

#### Scenario: Android-only deploy

- GIVEN `deploy_web=false` and `deploy_android=true`
- WHEN the workflow dispatches
- THEN only the Android build and Firebase distribute job runs
- AND the web deploy job is skipped

#### Scenario: External tester distribution

- GIVEN `deploy_android=true` and `firebase_team=external`
- WHEN the Android Firebase distribution job runs
- THEN the artifact is distributed to external testers

#### Scenario: No platform selected (edge case)

- GIVEN `deploy_web=false` and `deploy_android=false`
- WHEN the workflow dispatches
- THEN both jobs are skipped
- AND the workflow completes with a warning (no-op)
