# Admin Staging Auto Deploy Specification

## Purpose

Automatically deploy the admin web application to the staging environment whenever changes are pushed to `main` that touch admin-related paths. Also supports manual `workflow_dispatch` for on-demand deployments.

## Requirements

### Requirement: ADA-1 — Push-to-main auto deploy

The workflow MUST trigger on `push` to the `main` branch with path filters for `apps/admin/**`, `packages/shared/**`, and `.github/workflows/**`. It MUST run the same deploy steps as `deploy-admin-staging.yml` (the manual staging workflow).

#### Scenario: Auto-deploy on push

- GIVEN a merge to `main` touches `apps/admin/pages/index.tsx`
- WHEN the push event fires
- THEN the workflow validates path filters match
- AND deploys admin web to EAS Hosting staging
- AND the deploy succeeds

#### Scenario: Non-admin push skipped

- GIVEN a push to `main` touches only `apps/api/src/`
- WHEN the push event fires
- THEN the path filters exclude this push
- AND the workflow does NOT run

### Requirement: ADA-2 — Manual dispatch

The workflow MUST also support `workflow_dispatch` as a trigger for on-demand deployment. When dispatched manually, it MUST deploy regardless of path filters.

#### Scenario: Manual deploy after infra change

- GIVEN deploy config was updated (no code change)
- WHEN a maintainer triggers `workflow_dispatch`
- THEN the workflow deploys admin to staging
- AND path filters are bypassed

### Requirement: ADA-3 — No secrets divergence

The auto-deploy workflow MUST use the same environment and secrets as the existing manual `deploy-admin-staging.yml`. It MUST NOT introduce a separate set of staging credentials.

#### Scenario: Shared staging config

- GIVEN the existing staging workflow uses environment `staging` with secret `EAS_HOSTING_TOKEN`
- WHEN the auto-deploy workflow runs
- THEN it references the same `staging` environment and secrets
