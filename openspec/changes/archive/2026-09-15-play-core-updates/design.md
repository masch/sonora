# Design: PlayCoreUpdateProvider

## Architecture

`PlayCoreUpdateProvider` implements `UpdateProvider` interface and coordinates with `sp-react-native-in-app-updates`.

```text
               UpdateService.triggerUpdate({ mode })
                                 │
                                 ▼
                     PlayCoreUpdateProvider
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
        Platform.OS !== 'android'        Platform.OS === 'android'
        or NativeModule missing?         & NativeModule present?
                 │                               │
                 ▼                               ▼
         Return available: false           startUpdate(kind)
                 │                               │
                 │                     ┌─────────┴─────────┐
                 │                     │                   │
                 │                  Success              Error
                 │                     │                   │
                 ▼                     ▼                   ▼
      [Fallback to DeepLink]       [In-App Done]    [Throw -> Fallback to DeepLink]
```

## Resilience

1. **Lazy instantiation / Dynamic Access**: Native modules in React Native are accessed dynamically at runtime. If `NativeModules.SpInAppUpdates` is absent or dynamic class resolution fails (`getSpInAppUpdatesClass()`) (Expo Go, unit test runner, Web), `isAvailable()` cleanly returns `false` without crashing the bundle.
2. **Graceful Fallback**: Any rejection in `startUpdate` bubbles up to `UpdateService`, which catches it and proceeds to the next provider (`DeepLinkUpdateProvider`).
