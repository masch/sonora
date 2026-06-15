import { Platform } from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

import { useRegisterBackgroundTask } from './use-register-background-task';
import { flushQueue } from './use-feedback-sync';
import { APP_CONFIG } from '@/config/app-config';
import { logger } from '@/utils/logger';

export const BACKGROUND_SYNC_TASK = 'background-feedback-sync';

// Register the task globally (non-web only)
if (Platform.OS !== 'web') {
  TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
    logger.info('[BACKGROUND_FETCH] Background sync task triggered');
    try {
      await flushQueue();
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (error) {
      logger.error('[BACKGROUND_FETCH] Background sync task failed:', error);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

/**
 * Reusable hook to register the background fetch task for feedback sync.
 * Runs on app startup and registers the task with the configured interval.
 */
export function useBackgroundSync() {
  useRegisterBackgroundTask(BACKGROUND_SYNC_TASK, {
    minimumInterval: APP_CONFIG.feedback.syncIntervalSec,
  });
}
