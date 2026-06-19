import { z } from 'zod';

export const FeedbackPostBodySchema = z.object({
  trackId: z
    .string({ required_error: 'trackId is required and must be a non-empty string' })
    .min(1, 'trackId is required and must be a non-empty string'),
  message: z
    .string({ required_error: 'message is required and must be a non-empty string' })
    .min(1, 'message is required and must be a non-empty string'),
  idempotencyKey: z
    .string({ required_error: 'idempotencyKey is required and must be a non-empty string' })
    .min(1, 'idempotencyKey is required and must be a non-empty string'),
  createdAt: z
    .string({ required_error: 'createdAt is required and must be a non-empty string' })
    .min(1, 'createdAt is required and must be a non-empty string'),
});

export type FeedbackPostBody = z.infer<typeof FeedbackPostBodySchema>;

export interface FeedbackResponse {
  status: 'ok' | 'duplicate' | 'error';
  errors?: string[];
}
