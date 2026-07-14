import { useState } from 'react';

import { useFeedbackQueue } from '@/hooks/use-feedback-queue';
import { useLocationStore } from '@/store/location-store';
import { ApiClient } from '@/services/api-client';
import type { FeedbackStatus } from '@/types/feedback';
import { useAppTranslation } from '@/hooks/use-translation';
import { generateUUID } from '@/utils/uuid';
import { logger } from '@/utils/logger';

export interface UseFeedbackSubmitResult {
  /** Current submission status — undefined when idle */
  feedbackStatus: FeedbackStatus | undefined;
  /** Localized error message when submission + offline queue both fail */
  feedbackError: string | null;
  /**
   * Submit feedback: tries ApiClient.post first, falls back to offline queue.
   * Updates feedbackStatus through the lifecycle: 'sending' → 'sent' | 'queued' | 'error'.
   */
  submitFeedback: (experienceId: string, message: string) => Promise<void>;
  /** Clear status and error (return to idle state) */
  dismissFeedback: () => void;
}

/**
 * Hook to submit user feedback for a specific experience.
 * Automatically handles offline queueing if network request fails.
 *
 * @returns status, error, submitFeedback, dismissFeedback
 */
export function useFeedbackSubmit(): UseFeedbackSubmitResult {
  const { t } = useAppTranslation();
  const feedbackQueue = useFeedbackQueue();
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus | undefined>();
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const submitFeedback = async (experienceId: string, message: string) => {
    setFeedbackStatus('sending');
    setFeedbackError(null);
    const idempotencyKey = generateUUID();

    const { coords } = useLocationStore.getState();
    const lat = coords?.latitude ?? null;
    const lng = coords?.longitude ?? null;

    try {
      await ApiClient.post('/feedback', {
        experienceId,
        message,
        idempotencyKey,
        createdAt: new Date().toISOString(),
        latitude: lat,
        longitude: lng,
      });

      setFeedbackStatus('sent');
    } catch (err) {
      logger.error('[API_ERROR] Fetch failed, queueing feedback:', err);
      try {
        await feedbackQueue.enqueue(
          { experienceId, message, latitude: lat, longitude: lng },
          idempotencyKey,
        );
        setFeedbackStatus('queued');
      } catch (enqueueErr) {
        logger.error('[ENQUEUE_ERROR] SQLite fallback failed:', enqueueErr);
        setFeedbackStatus('error');
        setFeedbackError(t('feedback.form.error'));
      }
    }
  };

  const dismissFeedback = () => {
    setFeedbackStatus(undefined);
    setFeedbackError(null);
  };

  return { feedbackStatus, feedbackError, submitFeedback, dismissFeedback };
}
