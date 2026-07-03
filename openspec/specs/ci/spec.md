# CI/CD Integrations Spec

This document details requirements and constraints for all continuous integration and deployment pipelines.

## CI.1: Automatically increment versionCode on deploy

- **Scenario**: When a deployment runs successfully on the `main` branch:
  - **Given**: The workflow runs on the GitHub Actions runner.
  - **When**: The build process executes `make eas-build-android-preview-local`.
  - **Then**: The workflow MUST update the `versionCode` in `app.config.ts`.
  - **And**: The workflow MUST commit and push the updated `app.config.ts` file back to `main`.
  - **And**: The commit message MUST contain `[skip ci]` to prevent recursive runner trigger.

## CI.2: CI Write Permissions

- **Scenario**: The workflow requires write access to the git repository:
  - **Given**: The checkout action is configured with the standard `GITHUB_TOKEN`.
  - **When**: The workflow configuration includes `permissions: contents: write` at the job level.
  - **Then**: The runner MUST be authenticated to write and push updates to the repository.

## CI.3: Workflow Trigger Separation

The system MUST provide two separate workflows for API staging: one for PR validation (no secrets) and one for deploy on push to `main` (secrets available). Validation MUST run on `pull_request` to `main`; deploy MUST run on `push` to `main` and `workflow_dispatch`. Both MUST use the same path filters (`apps/api/**`, `packages/shared/**`, `.github/workflows/**`, `Makefile`).

| Property         | Validation Workflow                      | Deploy Workflow                                         |
| ---------------- | ---------------------------------------- | ------------------------------------------------------- |
| Trigger          | `pull_request` to `main`                 | `push` to `main`, `workflow_dispatch`                   |
| Environment      | None                                     | `staging`                                               |
| Secrets required | No                                       | Yes (DATABASE_URL, CLOUDFLARE_API_TOKEN)                |
| Steps            | checkout → install → validate → classify | checkout → install → validate → migrate → seed → deploy |

- **Scenario: PR validation succeeds without secrets**: GIVEN a Dependabot PR with changes to `apps/api/package.json`, WHEN validation triggers, THEN frozen-lockfile install + api-validate pass, no migration/deploy executes, workflow succeeds.
- **Scenario: Validation fails on broken code**: GIVEN a PR with type errors, WHEN api-validate runs, THEN workflow fails, deploy does not trigger.
- **Scenario: Push to main deploys fully**: GIVEN a merge to `main` touching `apps/api/**`, WHEN deploy triggers, THEN secrets available → validate → migrate → seed → deploy execute.
- **Scenario: workflow_dispatch deploys on demand**: GIVEN no recent push, WHEN maintainer triggers dispatch, THEN all deploy steps execute.

## CI.4: Change-Type Classification

The validation workflow MUST include a step that classifies the PR's changes as either `deps-only` or `source-code`. Classification logic: scan changed files — if ALL files match `**/package.json`, `**/bun.lock`, or dependency manifests, classify as `deps-only`; otherwise `source-code`.

- **Scenario: Pure dependency bump**: GIVEN PR changes only `package.json` + `bun.lock`, WHEN classification runs, THEN output is `deps-only`.
- **Scenario: Source + deps change**: GIVEN PR changes both `package.json` and `src/routes.ts`, WHEN classification runs, THEN output is `source-code`.
