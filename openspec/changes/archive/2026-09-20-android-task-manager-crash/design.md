# Design — Safe Background Task Registration and Lifecycle

**Change:** `android-task-manager-crash`
**Status:** Designed
**Inputs:** proposal.md, spec.md

---

## 1. Overview & Architecture

This design corrects the background task registration configuration in `expo-background-fetch` to eliminate cold-start native Android crashes.
By setting `stopOnTerminate: true` and `startOnBoot: false`, Android's `AlarmManager` is instructed to never wake up a terminated app process.
Additionally, the registration logic handles unregistering legacy zombie alarms that were persisted on user devices by previous builds.

---

## 2. Component Design

### 2.1 `use-register-background-task.ts`

- **Default Options Inversion**:
  - `stopOnTerminate`: Default to `true` (was `false`).
  - `startOnBoot`: Default to `false` (was `true`).

- **Legacy Alarm Cleanup & Safe Re-registration**:
  - When checking `isTaskRegisteredAsync(taskName)`:
    To ensure existing devices with zombie alarms (`startOnBoot: true`) in `AlarmManager` have their alarms cancelled, the hook unregisters the task via `BackgroundFetch.unregisterTaskAsync(taskName)` if already registered, and then re-registers with the safe options.
    Alternatively, unregister prior to registering, ensuring `AlarmManager.cancel()` clears the pending intent in `BackgroundFetchTaskConsumer.didUnregister()`.

```ts
interface RegisterOptions {
  minimumInterval?: number;
  stopOnTerminate?: boolean;
  startOnBoot?: boolean;
}

export function useRegisterBackgroundTask(taskName: string, options: RegisterOptions = {}) {
  const minimumInterval = options.minimumInterval ?? 15 * 60;
  const stopOnTerminate = options.stopOnTerminate ?? true;
  const startOnBoot = options.startOnBoot ?? false;

  useEffect(() => {
    if (Platform.OS === 'web') return;

    async function register() {
      try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(taskName);
        if (isRegistered) {
          // Unregister first to cancel any legacy persistent alarms in Android's AlarmManager
          await BackgroundFetch.unregisterTaskAsync(taskName);
        }

        await BackgroundFetch.registerTaskAsync(taskName, {
          minimumInterval,
          stopOnTerminate,
          startOnBoot,
        });
        logger.info(`[BACKGROUND_FETCH] Task "${taskName}" registered safely`);
      } catch (error) {
        logger.error(`[BACKGROUND_FETCH] Failed to register task "${taskName}":`, error);
      }
    }

    void register();
  }, [taskName, minimumInterval, stopOnTerminate, startOnBoot]);
}
```

### 2.2 `use-background-sync.ts`

- Explicitly pass `stopOnTerminate: true` and `startOnBoot: false` when calling `useRegisterBackgroundTask`:

```ts
export function useBackgroundSync() {
  const syncIntervalSec = useRemoteConfigStore((s) => s.config.feedback.syncIntervalSec);
  useRegisterBackgroundTask(BACKGROUND_SYNC_TASK, {
    minimumInterval: syncIntervalSec,
    stopOnTerminate: true,
    startOnBoot: false,
  });
}
```

---

## 3. Verification & Testing

- **Unit Tests**:
  - Update `use-register-background-task.test.ts` to assert `stopOnTerminate: true` and `startOnBoot: false`.
  - Assert that legacy registered tasks call `unregisterTaskAsync` before registering clean options.
  - Update `use-background-sync.test.ts` to assert that `useBackgroundSync` registers with safe options.
