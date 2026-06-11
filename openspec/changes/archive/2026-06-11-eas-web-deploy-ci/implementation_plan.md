# GH Actions EAS Web Deploy Workflow

Configure a GitHub Actions CI deployment workflow that triggers on code changes pushed/merged to the `main` branch. It runs validation checks and, if they succeed, executes `make eas-build-web` in the cloud to deploy the web application using Expo EAS.

## User Review Required

> [!IMPORTANT]
> This workflow requires `EXPO_TOKEN` to be configured as a repository secret in GitHub. Please ensure you add a secret named `EXPO_TOKEN` with a valid Expo personal access token in your GitHub repository settings (`Settings` -> `Secrets and variables` -> `Actions`).

## Open Questions

None. The workflow follows the existing `pr.yml` checks structure andMakefile targets.

## Proposed Changes

### CI/CD Configuration

#### [NEW] [deploy.yml](file:///home/masch/dev/js/sonora/.github/workflows/deploy.yml)

Create a new workflow file `.github/workflows/deploy.yml` that:

- Triggers on `push` to the `main` branch.
- Performs checkout, sets up Bun, installs dependencies, and runs validation checks (`make format-check test lint typecheck`).
- Deploys the web application to EAS Hosting by running `make eas-build-web`.
- Exposes `EXPO_TOKEN` secret to the environment.

## Verification Plan

### Automated Tests

- We cannot run the EAS deploy step fully without a valid `EXPO_TOKEN` in local dry-run, but we can check the syntax of the workflow.
- Validate that the validation steps run and pass locally before push.

### Manual Verification

- Commit the workflow file, push it to GitHub, and verify that the workflow runs and deploys correctly when merged to `main`.
