import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

import { logger } from '@/utils/logger';

export const BACKGROUND_SYNC_TASK = 'background-feedback-sync';

/**
 * Ensures legacy expo-background-fetch tasks are unregistered on startup.
 *
 * Android Crash Rationale:
 * In expo-background-fetch on Android, tasks schedule native AlarmManager alarms on pause.
 * When the app is terminated by swipe-to-kill, onDestroy() is not called, leaving the alarm
 * active in the kernel. When fired in cold-start, TaskBroadcastReceiver crashes with a
 * NullPointerException in release builds because Expo's legacy HeadlessAppLoader is null.
 *
 * Schedulable background sync will be reimplemented via expo-background-task (WorkManager)
 * in Issue #464. Until then, feedback sync is fully handled by useFeedbackSync on network,
 * interval, and AppState changes.
 */
export function useBackgroundSync(): void {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    async function cleanupLegacyTask() {
      try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
        if (isRegistered) {
          await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
          logger.info(
            '[BACKGROUND_FETCH] Unregistered legacy background task to prevent AlarmManager wakeups',
          );
        }
      } catch (error) {
        logger.warn('[BACKGROUND_FETCH] Failed to unregister legacy background task:', error);
      }
    }

    void cleanupLegacyTask();
  }, []);
}
