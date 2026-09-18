# Exploration: in-app-updates

## Current State

Sonora currently has an app version evaluation pipeline via Remote Config (`app-version-check`):

- `useRemoteConfigStore` loads remote configuration and computes `versionStatus` (`'ok'`, `'warn'`, `'block'`).
- `apps/mobile/src/app/_layout.tsx` subscribes to `versionStatus` and renders `UpdateRequiredModal` when blocked, and `UpdateWarningBanner` when an optional update is available.
- However, `UpdateRequiredModal` currently has a placeholder/TODO:
  ```typescript
  // TODO: Replace with platform-specific store URL when published:
  //   iOS: https://apps.apple.com/app/id<APP_STORE_ID>
  //   Android: market://details?id=<BUNDLE_ID>
  const HANDLE_UPDATE_URL = 'https://sonoraderivapoeticas-team-sonora.expo.app/';
  ```
- There is no platform-aware store deep linking abstraction, nor is there an integration with native Android Google Play In-App Updates (Play Core API).

## Problem Statement

When users open Sonora and a newer release is published:

1. When an update is required (`block`) or recommended (`warn`), clicking "Update" redirects to a hardcoded Expo preview web page instead of the native Google Play Store or iOS App Store.
2. In native Android environments where the app is installed via Google Play, users expect an immediate/flexible in-app update experience without navigating out of the app.
3. In development, testing, emulators, or iOS environments, native Google Play Core is unavailable and requires seamless, resilient fallback to store deep links.

## Affected Areas

- `apps/mobile/src/services/update-service.ts` — [NEW] Unified update driver interface with Strategy and Graceful Degradation pattern.
- `apps/mobile/src/services/store-url.ts` — [NEW] Platform store URL generator (`market://`, `itms-apps://`, HTTPS fallbacks) resolving package/bundle IDs from app config / constants.
- `apps/mobile/src/components/update-required-modal.tsx` — Wire up `UpdateService` trigger instead of hardcoded web URL.
- `apps/mobile/src/components/update-warning-banner.tsx` — Add "Update" action triggering `UpdateService`.
- `apps/mobile/src/i18n/locales/` (`en.ts`, `es.ts`) — Update localization strings for update actions.
- `apps/mobile/package.json` — Add Play Core native module / adapter (in Phase 2).

## Approaches

### Approach 1: Phased Strategy Pattern with Graceful Degradation (Recommended)

- **Phase 1: Resilient Deep Link Abstraction**
  - Create a clean `UpdateService` abstraction with platform-specific deep links (`market://details?id=${packageId}` with HTTPS fallback for Android; App Store URL with `itms-apps://` for iOS).
  - Connect `UpdateRequiredModal` and `UpdateWarningBanner` to `UpdateService`.
  - Fully testable in local development, emulators, and CI without native binary friction.
- **Phase 2: Google Play Core Driver Integration**
  - Implement a Play Core adapter in `UpdateService` for Android.
  - When invoked: attempt Google Play In-App Update (Flexible/Immediate).
  - If Play Core check fails or is unsupported (e.g. sideloaded APK, emulator, iOS, or Play Services error), gracefully degrade to the Phase 1 Deep Link.
- **Pros:** Robust architecture, 100% testable at every stage, zero disruption to iOS/Web, graceful fallback in production.
- **Cons:** Two-phase execution.
- **Effort:** Medium

### Approach 2: Monolithic Immediate Play Core Integration

- Immediately install native Play Core library, prebuild Android, and wire directly into UI components.
- **Pros:** Single-step implementation attempt.
- **Cons:** High risk of breaking local development/emulators where Play Core fails; hard to test without uploading signed release AAB to Google Play Console Internal Testing track; neglects iOS parity.
- **Effort:** High (and prone to immediate development blocks).

## Recommendation

Adopt **Approach 1**. Establish the robust Deep Link abstraction and UI integration first (Phase 1), followed by the optional native Google Play Core driver (Phase 2).

## Risks

- **Play Store ID / App ID configuration**: Ensure bundle IDs are read dynamically from `Application.applicationId` (`expo-application`) or environment config.
- **Expo SDK 56 & New Architecture compatibility**: Ensure any native modules used in Phase 2 support React Native 0.85 TurboModules.

## Ready for Proposal

Yes. Proceed with formal proposal generation.
