# Proposal: Google Play Core Startup Update Check and Analytics

## Intent

Automatically detect available updates from Google Play Store on Android app startup via Google Play Core (`sp-react-native-in-app-updates`), prompting the user with flexible in-app updates or banner without requiring manual `MINIMUM_APP_VERSION` bumps in backend Remote Config on every release. Track all startup update events via Firebase Analytics.

## Problem Statement

Currently, the in-app update banner and modal on mobile startup depend entirely on `versionStatus` from `useRemoteConfigStore`, which compares the installed version to `MINIMUM_APP_VERSION` defined in the API backend (`wrangler.toml`).
While `PlayCoreUpdateProvider.checkForUpdate()` is implemented, it is never invoked during the app lifecycle. As a result, when a new production version (e.g. `1.0.108`) is published in Google Play, users on previous versions (e.g. `1.0.107`) receive no update prompts unless the backend environment variable is manually updated and redeployed.

## User Impact

- On Android, users opening the app will automatically detect if Google Play Store has a newer version published.
- If available, an update notice (or flexible download prompt) is offered seamlessly.
- Analytics events (`update_check_started`, `update_check_completed`, `update_triggered`) are recorded for full visibility in Firebase Analytics.

## Scope & Components

- `apps/mobile/src/services/update-service.ts`: Expose `checkForUpdate()` on `UpdateService` coordinating registered providers.
- `apps/mobile/src/services/play-core-provider.ts` / `.native.ts`: Ensure `checkForUpdate()` is available and properly typed across native and web stubs.
- `apps/mobile/src/services/analytics-events.ts`: Verify and augment update analytics events if needed (e.g., source: 'startup').
- `apps/mobile/src/app/_layout.tsx`: Invoke update check on app launch, integrating with UI feedback or automatic flexible update.
- Unit tests: Extend test coverage in `update-service.test.ts`, `play-core-provider.test.ts`, and root layout tests.
