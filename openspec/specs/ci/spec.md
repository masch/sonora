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
