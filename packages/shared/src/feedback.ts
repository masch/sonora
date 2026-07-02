import { z } from 'zod';

export const FeedbackPostBodySchema = z.object({
  experienceId: z
    .string({ required_error: 'experienceId is required and must be a non-empty string' })
    .min(1, 'experienceId is required and must be a non-empty string'),
  message: z
    .string({ required_error: 'message is required and must be a non-empty string' })
    .min(1, 'message is required and must be a non-empty string'),
  idempotencyKey: z
    .string({ required_error: 'idempotencyKey is required and must be a non-empty string' })
    .min(1, 'idempotencyKey is required and must be a non-empty string'),
  createdAt: z
    .string({ required_error: 'createdAt is required and must be a non-empty string' })
    .min(1, 'createdAt is required and must be a non-empty string'),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

export type FeedbackPostBody = z.infer<typeof FeedbackPostBodySchema>;

/**
 * The UUID of the "general-feedback" experience in the DB seed.
 * Used by both API (seed) and mobile (feedback submission).
 * Single source of truth — do NOT duplicate.
 */
export const GENERAL_FEEDBACK_EXPERIENCE_ID = '00000000-0000-0000-0000-000000000000';

export interface FeedbackResponse {
  status: 'ok' | 'duplicate' | 'error';
  errors?: string[];
}
