import type { FeedbackTriggerMode } from '@/data/experiences';
import type { FeedbackPostBody, FeedbackResponse as FeedbackApiResponse } from '@sonora/shared';

export type { FeedbackTriggerMode, FeedbackPostBody, FeedbackApiResponse };

export type FeedbackStatus = 'sending' | 'sent' | 'queued' | 'error';

export interface FeedbackEntry {
  id: string;
  experienceId: string;
  message: string;
  createdAt: string;
  retryCount: number;
  lastError: string | null;
  latitude?: number | null;
  longitude?: number | null;
}
