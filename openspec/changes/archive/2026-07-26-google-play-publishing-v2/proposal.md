# SDD Proposal: Google Play Store Publishing Integration

## Status: Proposal Draft

**Change**: `google-play-publishing-v2`  
**Project**: Sonora (`apps/mobile`)  
**Date**: 2026-07-24

---

## 1. Problem Statement

Sonora's mobile application (Expo Managed Workflow) automatically builds and signs both APK and AAB artifacts in the continuous integration workflow (`.github/workflows/deploy-mobile-android-production.yml`).

Currently:

- The signed `.apk` file is distributed to Firebase App Distribution by default and uploaded to GitHub Releases.
- The mobile app is already registered in Google Play Console under the **Internal Testing** track.
- Automation for submitting the signed `.aab` package directly to the Google Play Developer Console API is missing.
- Deploying to production Firebase on every run creates unnecessary noise when Google Play Console is the primary target channel.

---

## 2. Proposed Solution

Extend the Android production workflow (`deploy-mobile-android-production.yml`) by adding a deployment job for Google Play Console that consumes the signed `.aab` binary from the `sign-android` stage.

### Key Solution Highlights:

1. **Configurable Track:** Allow selecting the target track (`internal`, `alpha`, `beta`, `production`) via manual workflow dispatch parameters (`workflow_dispatch` / `workflow_call`), defaulting to **`internal` (Internal Testing)**.
2. **Optional Firebase Distribution:** Add a workflow input parameter `enable_firebase` (boolean) defaulting to **`false`**. Firebase distribution will only execute when explicitly enabled.
3. **Google Play Developer API Authentication:** Document step-by-step setup for creating a Service Account in Google Cloud Console, granting permissions in Google Play Console, and storing the JSON key in the `ANDROID_PLAY_SERVICE_ACCOUNT_JSON` repository secret.
4. **Automated Release Notes:** Reuse release notes generated from Git commits (via `.github/actions/generate-release-notes`) to populate Google Play release details.
