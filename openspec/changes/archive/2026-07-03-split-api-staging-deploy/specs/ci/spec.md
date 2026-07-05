# Delta for CI/CD Integrations

## ADDED Requirements

### Requirement: Workflow Trigger Separation

The system MUST provide two separate workflows for API staging: one for PR validation (no secrets) and one for deploy on push to `main` (secrets available). Validation MUST run on `pull_request` to `main`; deploy MUST run on `push` to `main` and `workflow_dispatch`. Both MUST use the same path filters (`apps/api/**`, `packages/shared/**`, `.github/workflows/**`, `Makefile`).

| Property         | Validation Workflow                      | Deploy Workflow                                         |
| ---------------- | ---------------------------------------- | ------------------------------------------------------- |
| Trigger          | `pull_request` to `main`                 | `push` to `main`, `workflow_dispatch`                   |
| Environment      | None                                     | `staging`                                               |
| Secrets required | No                                       | Yes (DATABASE_URL, CLOUDFLARE_API_TOKEN)                |
| Steps            | checkout → install → validate → classify | checkout → install → validate → migrate → seed → deploy |

#### Scenario: PR validation succeeds without secrets

- GIVEN a Dependabot PR opens with changes to `apps/api/package.json`
- WHEN the validation workflow triggers
- THEN `bun install --frozen-lockfile` runs
- AND `make api-validate` passes
- AND no DB migration or deploy step executes
- AND the workflow succeeds

#### Scenario: Validation fails on broken code

- GIVEN a PR with type errors in `apps/api/src/`
- WHEN `make api-validate` runs
- THEN the workflow fails
- AND the deploy workflow does not run (not triggered)

#### Scenario: Push to main deploys fully

- GIVEN a merge to `main` touching `apps/api/**`
- WHEN the deploy workflow triggers
- THEN secrets DATABASE_URL and CLOUDFLARE_API_TOKEN are available
- AND `make api-validate` passes
- AND `make api-db-migrate-ci` applies migrations
- AND `make api-db-seed-ci` seeds data
- AND `make api-deploy-staging` deploys to staging Worker

#### Scenario: workflow_dispatch deploys on demand

- GIVEN no recent push to `main`
- WHEN a maintainer triggers `workflow_dispatch` on the deploy workflow
- THEN all deploy steps execute identically to a push trigger

### Requirement: Change-Type Classification

The validation workflow MUST include a step that classifies the PR's changes as either `deps-only` or `source-code`. Classification logic: scan changed files — if ALL files match `**/package.json`, `**/bun.lock`, or dependency manifests, classify as `deps-only`; otherwise `source-code`.

#### Scenario: Pure dependency bump classified correctly

- GIVEN a PR that changes only `apps/api/package.json` and `bun.lock`
- WHEN the classification step runs
- THEN output is `deps-only`

#### Scenario: Source + deps change classified as source

- GIVEN a PR that changes both `package.json` and `apps/api/src/routes.ts`
- WHEN the classification step runs
- THEN output is `source-code`
