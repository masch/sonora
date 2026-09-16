# Proposal: Google Play Core In-App Updates

## Intent

Implement Phase 2 of Sonora's in-app update strategy by providing a native Google Play Core adapter (`PlayCoreUpdateProvider`) on Android. This allows users to download and install application updates directly from within the application (via Google Play's flexible or immediate dialogs) while maintaining graceful degradation to deep link store redirection on iOS, Web, and unsupported Android environments.

## Scope

- **Package**: `apps/mobile`
- **Module**: `apps/mobile/src/services/play-core-provider.ts`
- **Integration**: Pluggable provider into `updateService` strategy chain (`apps/mobile/src/services/update-service.ts`)
- **Testing**: Unit test suite with full mocking of native Google Play Core modules (`apps/mobile/src/services/__tests__/play-core-provider.test.ts`)

## Non-Goals

- iOS native in-app updates (Apple does not support in-app binary updates; store deep linking remains the primary method for iOS).
- Modifying UI components (`UpdateRequiredModal`, `UpdateWarningBanner` already delegate to `updateService.triggerUpdate`).
