# Delta for dev-tooling

## ADDED Requirements

### Requirement: eas.json — EAS Build profiles

The system MUST provide `eas.json` with `production` (APK) and `preview` (internal distribution, APK) Android build profiles.

#### Scenario: Production APK build

- GIVEN `eas.json` has a `production` profile for Android (APK)
- WHEN `make eas-build-android` runs
- THEN EAS Build produces a production APK

#### Scenario: Preview APK for internal testing

- GIVEN `eas.json` has a `preview` profile with `distribution: "internal"`
- WHEN `make eas-build-android-preview` runs
- THEN EAS Build produces an APK shareable via the EAS dashboard

### Requirement: `eas-whoami` — verify EAS auth

The system MUST provide `make eas-whoami` that runs `eas whoami`. It MUST NOT require interactive login — auth uses `EXPO_TOKEN`.

#### Scenario: Authenticated user

- GIVEN `EXPO_TOKEN` is set and valid
- WHEN `make eas-whoami` runs
- THEN the associated username is printed
- AND the process exits 0

#### Scenario: Missing EXPO_TOKEN

- GIVEN `EXPO_TOKEN` is not set
- WHEN `make eas-whoami` runs
- THEN the process exits non-zero with an EAS auth error

### Requirement: `eas-build-android` — production build

The system MUST provide `make eas-build-android` that runs `eas build -p android --profile production --wait`. The build MUST be an APK and the target MUST block until completion.

#### Scenario: Successful production build

- GIVEN the developer is authenticated with EAS
- AND `eas.json` has a valid `production` profile
- WHEN `make eas-build-android` runs
- THEN `eas build` runs with platform Android and profile production
- AND the `--wait` flag blocks until completion
- AND an APK artifact URL is output
- AND the process exits 0

#### Scenario: Build failure

- GIVEN the project has a configuration error (e.g., missing native dependency)
- WHEN `make eas-build-android` runs
- THEN the build fails on EAS servers
- AND the process exits non-zero with error details

### Requirement: `eas-build-android-preview` — internal build

The system MUST provide `make eas-build-android-preview` that runs `eas build -p android --profile preview --wait`. Behavior is identical to `eas-build-android` except using the `preview` profile.

#### Scenario: Successful preview build

- GIVEN the developer is authenticated with EAS
- AND `eas.json` has a valid `preview` profile
- WHEN `make eas-build-android-preview` runs
- THEN `eas build` runs with platform Android and profile preview
- AND the build artifact is marked internal distribution

### Requirement: `eas-build-web` — deploy to EAS hosting

The system MUST provide `make eas-build-web` that exports via `bunx expo export --platform web` then deploys via `eas deploy --prod`. If export fails, deploy MUST NOT run.

#### Scenario: Successful web deploy

- GIVEN the developer is authenticated with EAS
- AND the web export succeeds
- WHEN `make eas-build-web` runs
- THEN `bunx expo export --platform web` runs first
- AND `eas deploy --prod` runs only after export succeeds
- AND the static site is deployed to EAS hosting
- AND the process exits 0

#### Scenario: Export failure prevents deploy

- GIVEN the web app has a build error
- WHEN `make eas-build-web` runs
- THEN export fails
- AND `eas deploy --prod` is NOT executed
- AND the process exits non-zero

### Requirement: Help text discoverability

All EAS targets MUST use `## Description` format. `make help` MUST include all EAS targets.

#### Scenario: Help shows EAS targets

- GIVEN the Makefile has the new EAS section
- WHEN `make help` runs
- THEN `eas-whoami`, `eas-build-android`, `eas-build-android-preview`, and `eas-build-web` appear with descriptions
