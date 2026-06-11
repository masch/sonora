# Walkthrough - GH Actions Android Preview Compilation

I have updated the GitHub Actions deploy workflow to include local compilation of the Android preview APK.

## Changes

### CI/CD Configuration

#### [MODIFY] [deploy.yml](file:///home/masch/dev/js/sonora/.github/workflows/deploy.yml)

Modified `.github/workflows/deploy.yml` with the following:

- **Renamed Workflow**: Changed the name to `Deploy App`.
- **Java Environment Setup**: Added a step using `actions/setup-java@v4` to configure Java 17 (Temurin distribution), ensuring a fully compatible Gradle compilation environment.
- **Android Compilation**: Added a step that runs `make eas-build-android-preview-local` using `EXPO_TOKEN` and `EAS_NO_INTERACTIVE: "1"` to compile the preview APK locally on the runner.

## Verification Results

### Automated Tests

- Checked workflow syntax and verified git diff.
