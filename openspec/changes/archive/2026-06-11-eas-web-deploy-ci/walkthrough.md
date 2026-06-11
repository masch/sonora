# Walkthrough - GH Actions EAS Web Deploy Workflow

I have created a new GitHub Actions CI/CD deployment workflow that triggers whenever changes are pushed or merged to the `main` branch.

## Changes

### CI/CD Configuration

#### [NEW] [deploy.yml](file:///home/masch/dev/js/sonora/.github/workflows/deploy.yml)

Created the new GitHub Actions workflow configuration:

- **Triggers**: Executed on push/merge to `main`.
- **Validation**: Performs environment setup (using Bun) and runs all verification checks (`make format-check test lint typecheck`).
- **Deploy**: Runs `make eas-build-web` with `EXPO_TOKEN` exposed from GitHub repository secrets.

## Verification Results

### Automated Tests

- Successfully ran and passed `make format-check test lint typecheck` locally to confirm all validation checks are working perfectly.
