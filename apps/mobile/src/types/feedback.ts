import type { FeedbackTriggerMode } from '@/data/trips';
import type { FeedbackPostBody, FeedbackResponse as FeedbackApiResponse } from '@sonora/shared';

export type { FeedbackTriggerMode, FeedbackPostBody, FeedbackApiResponse };

export type FeedbackStatus = 'sending' | 'sent' | 'queued' | 'error';

export interface FeedbackEntry {
  id: string;
  tripId: string;
  message: string;
  createdAt: string;
  retryCount: number;
  lastError: string | null;
}
