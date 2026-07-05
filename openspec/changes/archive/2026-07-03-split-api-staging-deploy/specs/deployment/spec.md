# Delta for Deployment

## ADDED Requirements

### Requirement: Deploy Trigger Policy

Staging deployment MUST only trigger on `push` to `main` (and `workflow_dispatch`). The system MUST NOT deploy to staging on `pull_request` events. This ensures secrets (DATABASE_URL, CLOUDFLARE_API_TOKEN) are available when migrations, seed, and Worker deploy execute.

#### Scenario: Deploy skipped on PR

- GIVEN a `pull_request` event targeting `main` with changes to `apps/api/**`
- WHEN the CI system evaluates triggers
- THEN the deploy workflow MUST NOT start
- AND the validation workflow runs instead

#### Scenario: Deploy runs on push with secrets

- GIVEN a `push` event to `main` with changes to `apps/api/**`
- WHEN the deploy workflow starts
- THEN the `staging` environment is set
- AND DATABASE_URL is available for `make api-db-migrate-ci`
- AND CLOUDFLARE_API_TOKEN is available for `make api-deploy-staging`

#### Scenario: workflow_dispatch skips path filter

- GIVEN a maintainer triggers `workflow_dispatch` on the deploy workflow
- WHEN the workflow runs
- THEN path filters do NOT apply
- AND all deploy steps execute

### Requirement: Idempotent Staging Steps

Migrations and seed steps MUST be idempotent. Running `make api-db-migrate-ci` and `make api-db-seed-ci` on an already-migrated or already-seeded database MUST succeed without side effects.

#### Scenario: Re-running migration is safe

- GIVEN the staging DB already has all migrations applied
- WHEN `make api-db-migrate-ci` runs again
- THEN the command exits 0
- AND no schema changes occur

#### Scenario: Re-running seed is safe

- GIVEN the staging DB already has seed data
- WHEN `make api-db-seed-ci` runs again
- THEN the command exits 0
- AND no duplicate records are created
