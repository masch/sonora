import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

import { logger } from '@/utils/logger';

interface RegisterOptions {
  minimumInterval?: number;
  stopOnTerminate?: boolean;
  startOnBoot?: boolean;
}

/**
 * Reusable hook to register an expo-background-fetch task safely.
 *
 * ### Android Crash Prevention Rationale:
 * In expo-background-fetch on Android, tasks are scheduled via native AlarmManager.
 * If registered with `stopOnTerminate: false` or `startOnBoot: true`, AlarmManager persists
 * recurring wake-up intents (targeting `expo.modules.taskManager.TaskBroadcastReceiver`).
 *
 * When the app process is terminated and AlarmManager fires, `TaskBroadcastReceiver` is invoked
 * in cold start before the React Native runtime is mounted (`taskManager == null`). In release
 * builds with R8 code shrinking/obfuscation enabled, `TaskService.executeTask` falls back to
 * `getAppLoader().loadApp(...)`, where `getAppLoader()` returns `null`, resulting in an unhandled
 * `java.lang.NullPointerException` inside `ActivityThread.handleReceiver` that crashes the app.
 *
 * ### Solution Mechanism:
 * 1. Safe Defaults: `stopOnTerminate: true` and `startOnBoot: false` ensure alarms are cancelled
 *    when the app exits and never restored on device boot.
 * 2. Proactive Cleanup: If the task was previously registered by an older app version, we call
 *    `BackgroundFetch.unregisterTaskAsync(taskName)` to cancel any existing AlarmManager PendingIntents
 *    and purge stale task entries from SharedPreferences before safely re-registering.
 *
 * Note: The task handler itself must still be defined globally in the module using `TaskManager.defineTask`.
 */
// Maps to serialize registration calls and track active generations per taskName
const taskRegistrationLocks = new Map<string, Promise<void>>();
const taskRegistrationGenerations = new Map<string, number>();

export function useRegisterBackgroundTask(taskName: string, options: RegisterOptions = {}) {
  const minimumInterval = options.minimumInterval ?? 15 * 60; // 15 minutes default
  const stopOnTerminate = options.stopOnTerminate ?? true;
  const startOnBoot = options.startOnBoot ?? false;

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let isCancelled = false;
    const currentGeneration = (taskRegistrationGenerations.get(taskName) ?? 0) + 1;
    taskRegistrationGenerations.set(taskName, currentGeneration);

    const isStale = () =>
      isCancelled || taskRegistrationGenerations.get(taskName) !== currentGeneration;

    async function executeRegister() {
      try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(taskName);
        if (isStale()) return;

        if (isRegistered) {
          // Unregister legacy persistent alarm in Android's AlarmManager to prevent zombie wakeups
          await BackgroundFetch.unregisterTaskAsync(taskName);
        }
        if (isStale()) return;

        await BackgroundFetch.registerTaskAsync(taskName, {
          minimumInterval,
          stopOnTerminate,
          startOnBoot,
        });
        if (!isStale()) {
          logger.info(`[BACKGROUND_FETCH] Task "${taskName}" registered safely`);
        }
      } catch (error) {
        if (!isStale()) {
          logger.error(`[BACKGROUND_FETCH] Failed to register task "${taskName}":`, error);
        }
      }
    }

    // Serialize registration calls per taskName to avoid race conditions on rapid prop updates
    const previousLock = taskRegistrationLocks.get(taskName) ?? Promise.resolve();
    const currentLock = previousLock
      .catch(() => {})
      .then(async () => {
        if (!isStale()) {
          await executeRegister();
        }
      })
      .finally(() => {
        if (taskRegistrationLocks.get(taskName) === currentLock) {
          taskRegistrationLocks.delete(taskName);
        }
        if (taskRegistrationGenerations.get(taskName) === currentGeneration) {
          taskRegistrationGenerations.delete(taskName);
        }
      });

    taskRegistrationLocks.set(taskName, currentLock);

    return () => {
      isCancelled = true;
    };
  }, [taskName, minimumInterval, stopOnTerminate, startOnBoot]);
}
