import type { FeedbackTriggerMode } from '@/data/trips';

export type { FeedbackTriggerMode };

export type FeedbackStatus = 'sending' | 'sent' | 'queued' | 'error';

export interface FeedbackEntry {
  id: string;
  tripId: string;
  message: string;
  createdAt: string;
  retryCount: number;
  lastError: string | null;
}

export interface FeedbackPostBody {
  tripId: string;
  message: string;
  idempotencyKey: string;
  createdAt: string;
}

export interface FeedbackApiResponse {
  status: 'ok' | 'duplicate' | 'error';
  errors?: string[];
}
