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
  useEffect(() => {
    if (Platform.OS === 'web') return;

    async function register() {
      try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(taskName);
        if (!isRegistered) {
          await BackgroundFetch.registerTaskAsync(taskName, {
            minimumInterval: options.minimumInterval ?? 15 * 60, // 15 minutes default
            stopOnTerminate: options.stopOnTerminate ?? false,
            startOnBoot: options.startOnBoot ?? true,
          });
          logger.info(`[BACKGROUND_FETCH] Task "${taskName}" registered successfully`);
        } else {
          logger.info(`[BACKGROUND_FETCH] Task "${taskName}" is already registered`);
        }
      } catch (error) {
        logger.error(`[BACKGROUND_FETCH] Failed to register task "${taskName}":`, error);
      }
    }

    register();
  }, [taskName, options.minimumInterval, options.stopOnTerminate, options.startOnBoot]);
}
