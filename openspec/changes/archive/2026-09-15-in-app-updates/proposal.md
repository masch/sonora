# Proposal: In-App Updates

## Intent

Implement a robust, cross-platform in-app update strategy for Sonora using the Strategy Pattern with Graceful Degradation: providing native Google Play In-App Updates on supported Android devices while guaranteeing resilient, platform-aware store deep linking across Android, iOS, and development environments.

## Scope

### In Scope

- Platform-aware store URL resolution service (`getStoreUrl()`) for Android (`market://details?id=...` with HTTPS web fallback) and iOS (`https://apps.apple.com/app/id...` / `itms-apps://`).
- Strategy-driven `UpdateService` exposing a unified `triggerUpdate(options)` API.
- Graceful degradation: attempting native Google Play In-App Updates on Android, with seamless fallback to store deep linking whenever Play Core is unavailable, fails, or runs outside an official store install.
- Wire `UpdateRequiredModal` to invoke `UpdateService.triggerUpdate({ mode: 'immediate' })`.
- Enhance `UpdateWarningBanner` with an explicit "Update" action triggering `UpdateService.triggerUpdate({ mode: 'flexible' })`.
- Complete unit and integration test coverage for platform resolution, fallback logic, and UI triggers.
- Phased delivery: Phase 1 establishes the clean abstraction and deep link fallback; Phase 2 integrates the native Play Core driver.

### Out of Scope

- Custom backend version checking changes (existing `app-version-check` and `remote-config-store` contracts are preserved).
- Expo EAS Update (OTA) runtime switching (this change focuses exclusively on binary/store updates).

## Capabilities

### New Capabilities

- `update-service`: Modular service providing unified store update execution with automated graceful degradation.
- `store-urls`: Platform-specific URI generator utilizing `expo-application` and Sonora identifiers.

### Modified Capabilities

- `app-version-check`: Update UI components (`UpdateRequiredModal`, `UpdateWarningBanner`) to integrate with `update-service` instead of a static placeholder URL.

## Approach

1. **Store URL Resolution (`apps/mobile/src/services/store-url.ts`)**:
   Implement platform-specific URI generation using `Application.applicationId` from `expo-application`.
   On Android, resolve `market://details?id=${appId}` and fallback to `https://play.google.com/store/apps/details?id=${appId}`.
   On iOS, resolve App Store URL with `itms-apps` scheme fallback.

2. **Update Service & Fallback Strategy (`apps/mobile/src/services/update-service.ts`)**:
   Define `UpdateProvider` interface and implement `DeepLinkUpdateProvider`.
   Expose `triggerUpdate()` which attempts the primary provider and catches any rejection/unavailability to fall back safely to store deep linking.

3. **UI Integration**:
   Update `UpdateRequiredModal` to call `UpdateService.triggerUpdate()` on button click.
   Update `UpdateWarningBanner` to provide an "Update" button alongside "Dismiss".

4. **Play Core Native Driver (Phase 2)**:
   Integrate Google Play In-App Updates native driver for Android production builds.

## Affected Areas

| Area                                                                  | Impact   | Description                                       |
| --------------------------------------------------------------------- | -------- | ------------------------------------------------- |
| `apps/mobile/src/services/store-url.ts`                               | New      | Platform store URI generator                      |
| `apps/mobile/src/services/update-service.ts`                          | New      | Strategy pattern update coordinator with fallback |
| `apps/mobile/src/services/__tests__/store-url.test.ts`                | New      | Unit tests for platform URL generation            |
| `apps/mobile/src/services/__tests__/update-service.test.ts`           | New      | Unit tests for update trigger and fallback flows  |
| `apps/mobile/src/components/update-required-modal.tsx`                | Modified | Connect update action to `UpdateService`          |
| `apps/mobile/src/components/update-warning-banner.tsx`                | Modified | Add update action button                          |
| `apps/mobile/src/components/__tests__/update-required-modal.test.tsx` | Modified | Verify `UpdateService` execution                  |
| `apps/mobile/src/components/__tests__/update-warning-banner.test.tsx` | Modified | Verify banner update button interaction           |
| `apps/mobile/src/i18n/locales/en.ts` & `es.ts`                        | Modified | Add banner action labels if missing               |

## Risks

- **Play Store ID accuracy**: Ensure production and staging bundle IDs match `app.config.ts` configuration.
- **Deep link URI scheme handling**: Verify `Linking.canOpenURL` / `Linking.openURL` handles `market://` properly on non-Google Android devices (e.g., fallback to HTTPS web link).

## Phasing & Delivery Strategy

- **Phase 1 (Foundation & Deep Link Fallback)**: Create `store-url`, `update-service`, and UI updates with 100% test coverage. Single PR delivery.
- **Phase 2 (Play Core Driver)**: Add native Play Core adapter and testing verification.
