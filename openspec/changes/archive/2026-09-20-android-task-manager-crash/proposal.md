# Proposal: Fix Android Native TaskManager NullPointerException Crash

## Intent

Eliminate the native Android startup crash (`java.lang.NullPointerException` in `expo.modules.taskManager.TaskBroadcastReceiver` / `TaskService.executeTask`) caused by persistent background fetch alarms triggering while the app's React Native runtime is not yet loaded or initialized.

## Problem Statement

In `apps/mobile/src/hooks/use-register-background-task.ts`, `BackgroundFetch.registerTaskAsync` registers `background-feedback-sync` with `startOnBoot: true` and `stopOnTerminate: false`.
Because of these flags, Android's `AlarmManager` registers a persistent wake-up alarm with the system.

When the alarm triggers while the app process is terminated or during cold boot:

1. Android OS dispatches the intent to `TaskBroadcastReceiver` before or during app startup (`ActivityThread.handleReceiver`).
2. `TaskService.executeTask` attempts to handle the background task.
3. In cold start, `TaskManager` is `null` because the JavaScript bundle and React component tree have not yet loaded.
4. `TaskService.java` attempts fallback execution via `getAppLoader().loadApp(...)`.
5. In production/release builds (minified/obfuscated via R8), `AppLoaderProvider.getLoader("react-native-headless", ...)` returns `null` because Expo Headless App Loader is not present or stripped.
6. Invoking `.loadApp()` on `null` immediately throws an uncaught `java.lang.NullPointerException`, crashing the application process with the native Android "Send feedback" / "App has stopped" dialog.

Furthermore, existing devices already have this persistent alarm registered with `AlarmManager` from previous versions (over 100 wakeups recorded on real devices).

## User Impact

- Prevents intermittent crashes on Android native release builds when opening the app or waking from cold state.
- Ensures feedback queue synchronization only executes safely when the React Native runtime is alive.
- Automatically clears legacy zombie alarms registered in Android's `AlarmManager` across active devices.

## Scope & Components

- `apps/mobile/src/hooks/use-register-background-task.ts`:
  - Change default options: set `stopOnTerminate: true` and `startOnBoot: false`.
  - Provide safe migration/cleanup to unregister legacy alarms if registered with obsolete options.
- `apps/mobile/src/hooks/use-background-sync.ts`:
  - Explicitly pass `stopOnTerminate: true` and `startOnBoot: false`.
  - Guard task execution and module lifecycle.
- `apps/mobile/src/hooks/__tests__/use-register-background-task.test.ts`:
  - Update unit tests to verify `stopOnTerminate: true` and `startOnBoot: false`.
- `apps/mobile/src/hooks/__tests__/use-background-sync.test.ts`:
  - Verify options passed down and registration behavior.
