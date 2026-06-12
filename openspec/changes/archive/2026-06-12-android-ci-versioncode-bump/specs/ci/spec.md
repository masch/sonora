# CI/CD Version Code Automations Spec

## ADDED Requirements

### CI.1: Automatically increment versionCode on deploy

- **Scenario**: When a deployment runs successfully on the `main` branch:
  - **Given**: The workflow runs on the GitHub Actions runner.
  - **When**: The build process executes `make eas-build-android-preview-local`.
  - **Then**: The workflow MUST update the `versionCode` in `app.config.ts`.
  - **And**: The workflow MUST commit and push the updated `app.config.ts` file back to `main`.
  - **And**: The commit message MUST contain `[skip ci]` to prevent recursive runner trigger.

### CI.2: CI Write Permissions

- **Scenario**: The GitHub Actions runner attempts to push the commit:
  - **Given**: The checkout action is configured with the standard `GITHUB_TOKEN`.
  - **When**: The workflow configuration includes `permissions: contents: write`.
  - **Then**: The runner MUST be authenticated to write to the repository.
