# Tasks: Play Core Startup In-App Update Check (Android Only)

**Feature**: `play-core-startup-update`
**Branch**: `feat/play-core-startup-check`
**Delivery Strategy**: `ask-on-risk`

## Objective

Automatically detect available updates from Google Play Store on Android startup via Google Play Core (`sp-react-native-in-app-updates`) and track check lifecycles via Firebase Analytics, keeping iOS and Web on their existing Remote Config and reload mechanisms.

## Tasks

- [x] `TASK-1`: Extend `InAppUpdateEvents` in `apps/mobile/src/services/analytics-events.ts` to support optional `source: 'startup' | 'manual'`.
- [x] `TASK-2`: Update `UpdateProvider` interface and implement `checkForUpdate()` in `UpdateService` (`apps/mobile/src/services/update-service.ts`) and `DeepLinkUpdateProvider`.
- [x] `TASK-3`: Pass `source` parameter through `PlayCoreUpdateProvider.checkForUpdate()` in `play-core-provider.native.ts` and `play-core-provider.ts`.
- [x] `TASK-4`: Invoke `updateService.checkForUpdate({ source: 'startup' })` in `RootLayout` (`apps/mobile/src/app/_layout.tsx`) on startup and trigger flexible update if available.
- [x] `TASK-5`: Update unit tests in `apps/mobile/src/services/__tests__/update-service.test.ts` and `play-core-provider.test.ts`.
- [x] `TASK-6`: Run full mobile validation (`make mobile-lint`, `make mobile-test`) to guarantee zero regressions.
