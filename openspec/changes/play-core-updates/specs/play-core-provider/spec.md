# Spec: PlayCoreUpdateProvider

## Requirements

### REQ-1: Platform Availability Detection

- `PlayCoreUpdateProvider.isAvailable()` MUST return `false` on any non-Android platform (`Platform.OS !== 'android'`).
- `PlayCoreUpdateProvider.isAvailable()` MUST return `false` if `NativeModules.SpInAppUpdates` is undefined or null (e.g. Expo Go, web, or builds without native link).
- `PlayCoreUpdateProvider.isAvailable()` MUST return `true` on Android when the native module is present.

### REQ-2: Mode Mapping & Execution

- When `triggerUpdate({ mode: 'immediate' })` is invoked, `PlayCoreUpdateProvider` MUST call `startUpdate` with `IAUUpdateKind.IMMEDIATE`.
- When `triggerUpdate({ mode: 'flexible' })` or `triggerUpdate()` without mode is invoked, `PlayCoreUpdateProvider` MUST call `startUpdate` with `IAUUpdateKind.FLEXIBLE`.

### REQ-3: Error Propagation for Fallback

- If `startUpdate` rejects with an error (e.g., user cancels, Google Play API failure, network outage), `PlayCoreUpdateProvider` MUST propagate the exception rather than silently swallowing it.
- This allows `UpdateService` to gracefully fall back to the next registered provider (`DeepLinkUpdateProvider`).
