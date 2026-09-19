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
 * Reusable hook to register an expo-background-fetch task.
 * Note: The task handler itself must still be defined globally in the module using TaskManager.defineTask.
 */
export function useRegisterBackgroundTask(taskName: string, options: RegisterOptions = {}) {
  const minimumInterval = options.minimumInterval ?? 15 * 60; // 15 minutes default
  const stopOnTerminate = options.stopOnTerminate ?? true;
  const startOnBoot = options.startOnBoot ?? false;

  useEffect(() => {
    if (Platform.OS === 'web') return;

    async function register() {
      try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(taskName);
        if (isRegistered) {
          // Unregister legacy persistent alarm in Android's AlarmManager to prevent zombie wakeups
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
