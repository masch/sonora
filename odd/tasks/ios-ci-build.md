# Feature: iOS CI Build Pipeline (Simulator & Physical Device)

**Feature ID:** `ios-ci-build`  
**Branch:** `feat/ios-ci-build`  
**Strategy:** `ask-on-risk`  
**Tracking Issue:** [#497](https://github.com/masch/sonora/issues/497)

## Objective

Enable automated, zero-cost iOS builds on GitHub Actions using free macOS runners (`runs-on: macos-latest`) for the public repository. Support both **Simulator** (executable out-of-the-box without Apple Developer accounts or codesigning) and **Physical Device / TestFlight** (prepared for when Apple credentials from issue [#497](https://github.com/masch/sonora/issues/497) are supplied).

## Architectural Strategy & Constraints

1. **Free Cloud Compute**:
   - `sonora` is a public repository on GitHub, granting access to free `macos-latest` (Apple Silicon) runners on GitHub Actions.
   - Run `eas build -p ios --local` inside the runner using the preinstalled Xcode environment.
2. **Dual-Target Profile Support**:
   - **Simulator (`simulator`)**: Configured with `"ios": { "simulator": true }` in `eas.json`. Produces a `.tar.gz` bundle with the `.app` binary. No code signing or Apple Developer account required.
   - **Physical Device (`device` / `preview`)**: Configured with `"ios": { "simulator": false }` in `eas.json`. Produces a signed `.ipa` file once Apple credentials and certificates are linked.
3. **Resilient Firebase Configuration**:
   - Decode `IOS_GOOGLE_SERVICES_BASE64` secret if present.
   - Fall back to an automated stub `GoogleService-Info.plist` during CI if the secret is not yet configured, preventing `@react-native-firebase/app` config plugin crashes on simulator builds.
4. **CI Orchestration**:
   - Dedicated workflow `.github/workflows/deploy-mobile-ios-staging.yml` with choice input `target: simulator | device`.
   - Optional integration into `2-STG Deploy All` (`deploy-all-staging.yml`) via `build_ios: boolean` (default `false`) and `ios_target: simulator | device`.

## Tasks

- [ ] **Task 1: EAS Configuration for iOS (`apps/mobile/eas.json`)**
  - Path: `apps/mobile/eas.json`
  - Action: Add `simulator` profile with `{"ios": {"simulator": true}}` and declare `ios.simulator: false` in `preview` and `production`.
  - Proof: `APP_VERSION_NAME=1.0.0 bunx expo config --type public` validates successfully.

- [ ] **Task 2: Makefile Build Targets (Local & CI)**
  - Path: `Makefile`
  - Action: Define local targets (`rebuild-ios-device-staging`, `rebuild-ios-device-production`, `rebuild-ios-staging`, `rebuild-ios-production`) and CI targets (`eas-build-ios-simulator-ci`, `eas-build-ios-device-ci`).
  - Proof: `make -n rebuild-ios-device-staging` and `make -n eas-build-ios-simulator-ci` expand with correct environment variables and arguments.

- [ ] **Task 3: Dedicated iOS Staging Workflow**
  - Path: `.github/workflows/deploy-mobile-ios-staging.yml`
  - Action: Create GitHub Actions workflow running on `macos-latest`, incorporating dependency installation (`actions/setup`), `make check`, `GoogleService-Info.plist` handling (secret or stub), build execution, and artifact upload to release/artifacts.
  - Proof: Workflow syntax formatted and verified via Prettier.

- [ ] **Task 4: Integration into Deploy All Workflow**
  - Path: `.github/workflows/deploy-all-staging.yml`
  - Action: Add optional `build_ios` and `ios_target` dispatch inputs and conditional `deploy-ios` job.
  - Proof: Prettier validation passes.
