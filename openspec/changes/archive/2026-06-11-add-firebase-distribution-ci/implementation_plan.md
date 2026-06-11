# GH Actions Android Firebase Distribution in Deploy Workflow

Configure the existing deploy workflow (`.github/workflows/deploy.yml`) to upload the compiled Android preview APK to Firebase App Distribution using `make firebase-distribute-all`.

## User Review Required

> [!IMPORTANT]
> This workflow requires `FIREBASE_TOKEN` to be configured as a repository secret in GitHub. Please ensure you add a secret named `FIREBASE_TOKEN` with a valid Firebase login token in your GitHub repository settings (`Settings` -> `Secrets and variables` -> `Actions`).

## Open Questions

None. The workflow uses the already compiled Android preview APK and targets Firebase App Distribution groups `dev-team` and `sonora-team`.

## Proposed Changes

### CI/CD Configuration

#### [MODIFY] [deploy.yml](file:///home/masch/dev/js/sonora/.github/workflows/deploy.yml)

Modify `.github/workflows/deploy.yml` to:

- Add a distribution step: `make firebase-distribute-all`.
- Pass `FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}` in the environment for that step.

## Verification Plan

### Automated Tests

- Validate GitHub Actions workflow syntax.

### Manual Verification

- Commit and push the updated workflow file, then verify that the deployment workflow runs, builds the Android preview APK, and uploads it to Firebase App Distribution.
