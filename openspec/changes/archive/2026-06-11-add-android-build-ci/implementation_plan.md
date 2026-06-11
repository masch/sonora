# GH Actions Android Preview Compilation in Deploy Workflow

Configure the existing deploy workflow (`.github/workflows/deploy.yml`) to also run local Android build preview compilation using `make eas-build-android-preview-local`.

## User Review Required

> [!IMPORTANT]
>
> - **Build Duration**: Building Android APKs locally on GitHub Actions runners takes significantly longer (approx. 5-10 minutes) than web export.
> - **Non-interactive Execution**: The workflow will run with `EAS_NO_INTERACTIVE: "1"` to ensure EAS CLI does not block waiting for user prompts.
> - **Java 17 Requirement**: The workflow will configure Java 17 using `actions/setup-java` to ensure Gradle compiles successfully.

## Open Questions

None. The environment has pre-configured Android SDK paths, and the required Expo/EAS credentials will be fetched from Expo's servers via `EXPO_TOKEN`.

## Proposed Changes

### CI/CD Configuration

#### [MODIFY] [deploy.yml](file:///home/masch/dev/js/sonora/.github/workflows/deploy.yml)

Modify `.github/workflows/deploy.yml` to:

- Add a Java setup step (`actions/setup-java@v4`) with version 17.
- Add a compilation step to build the Android preview APK locally: `make eas-build-android-preview-local`.
- Pass `EAS_NO_INTERACTIVE: "1"` in the environment alongside `EXPO_TOKEN`.

## Verification Plan

### Automated Tests

- Validate GitHub Actions workflow syntax.

### Manual Verification

- Commit and push the updated workflow file, then verify that the deployment workflow runs, installs Java, and successfully compiles the Android preview build.
