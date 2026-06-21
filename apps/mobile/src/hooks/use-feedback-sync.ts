import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { getItem, setItem, QUEUE_KEY } from '@/storage/feedback-storage';
import { APP_CONFIG } from '@/config/app-config';
import type { FeedbackEntry } from '@/types/feedback';
import { logger } from '@/utils/logger';

const API_URL = `${APP_CONFIG.apiBaseUrl}/feedback`;

/**
 * Listens for offline→online transitions and flushes all pending
 * feedback queue entries via POST to the feedback API.
 * Removes entries on 201 success, leaves on failure for retry.
 */
export function useFeedbackSync(): void {
  const flushingRef = useRef(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = state.isConnected ?? false;
      if (isOnline && !flushingRef.current) {
        flushingRef.current = true;
        flushQueue().finally(() => {
          flushingRef.current = false;
        });
      }
    });

    const interval = setInterval(async () => {
      const state = await NetInfo.fetch();
      const isOnline = state.isConnected ?? false;
      if (isOnline && !flushingRef.current) {
        flushingRef.current = true;
        flushQueue().finally(() => {
          flushingRef.current = false;
        });
      }
    }, APP_CONFIG.feedback.syncIntervalSec * 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);
}

export async function flushQueue(): Promise<void> {
  try {
    const raw = await getItem(QUEUE_KEY);
    if (!raw) return; // Empty queue — nothing to flush

    const entries: FeedbackEntry[] = JSON.parse(raw);
    if (entries.length === 0) return;

    const results = await Promise.all(
      entries.map(async (entry): Promise<FeedbackEntry | null> => {
        try {
          const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              experienceId: entry.experienceId,
              message: entry.message,
              idempotencyKey: entry.id,
              createdAt: entry.createdAt,
            }),
          });

          if (response.status === 201 || response.status === 409) {
            // 201 = accepted, 409 = duplicate (already processed — safe to remove)
            return null;
          } else {
            // Failed — keep for retry, increment retry count
            return {
              ...entry,
              retryCount: entry.retryCount + 1,
              lastError: `HTTP ${response.status}`,
            };
          }
        } catch (err: unknown) {
          // Network error — keep for retry
          return {
            ...entry,
            retryCount: entry.retryCount + 1,
            lastError: err instanceof Error ? err.message : 'Network error',
          };
        }
      }),
    );

    const remaining = results.filter((entry): entry is FeedbackEntry => entry !== null);

    // Write remaining entries back to storage
    await setItem(QUEUE_KEY, JSON.stringify(remaining));
  } catch {
    // If we can't even read the queue, log and move on
    logger.warn('useFeedbackSync: Failed to flush queue');
  }
}
