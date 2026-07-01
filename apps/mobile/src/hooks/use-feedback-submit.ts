import { useState, useCallback } from 'react';

import { useFeedbackQueue } from '@/hooks/use-feedback-queue';
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
  /** Reset status and error to idle. Does NOT affect showManualFeedback or trigger dismiss. */
  dismissFeedback: () => void;
}

/**
 * Shared hook for feedback submission with automatic offline fallback.
 *
 * Encapsulates the try-ApiClient → fallback-to-queue pattern used by
 * TripDetailView and TrackDetailView (and potentially MessagesScreen).
 *
 * @returns status, error, submitFeedback, dismissFeedback
 */
export function useFeedbackSubmit(): UseFeedbackSubmitResult {
  const { t } = useAppTranslation();
  const feedbackQueue = useFeedbackQueue();
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus | undefined>();
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const submitFeedback = useCallback(
    async (experienceId: string, message: string) => {
      setFeedbackStatus('sending');
      setFeedbackError(null);
      const idempotencyKey = generateUUID();

      try {
        await ApiClient.post('/feedback', {
          experienceId,
          message,
          idempotencyKey,
          createdAt: new Date().toISOString(),
        });

        setFeedbackStatus('sent');
      } catch (err) {
        logger.error('[API_ERROR] Fetch failed, queueing feedback:', err);
        try {
          await feedbackQueue.enqueue({ experienceId, message }, idempotencyKey);
          setFeedbackStatus('queued');
        } catch (enqueueErr) {
          logger.error('[ENQUEUE_ERROR] SQLite fallback failed:', enqueueErr);
          setFeedbackStatus('error');
          setFeedbackError(t('feedback.form.error'));
        }
      }
    },
    [t, feedbackQueue],
  );

  const dismissFeedback = useCallback(() => {
    setFeedbackStatus(undefined);
    setFeedbackError(null);
  }, []);

  return { feedbackStatus, feedbackError, submitFeedback, dismissFeedback };
}
