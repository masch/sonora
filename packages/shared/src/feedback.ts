import { z } from 'zod';

import { required } from './schemas/required-message';

export const FeedbackPostBodySchema = z.object({
  experienceId: z
    .string(required('experienceId is required and must be a non-empty string'))
    .min(1, 'experienceId is required and must be a non-empty string'),
  message: z
    .string(required('message is required and must be a non-empty string'))
    .min(1, 'message is required and must be a non-empty string')
    .max(1000, 'message must not exceed 1000 characters'),
  idempotencyKey: z
    .string(required('idempotencyKey is required and must be a non-empty string'))
    .min(1, 'idempotencyKey is required and must be a non-empty string'),
  createdAt: z
    .string(required('createdAt is required and must be a non-empty string'))
    .min(1, 'createdAt is required and must be a non-empty string'),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

export type FeedbackPostBody = z.infer<typeof FeedbackPostBodySchema>;

export interface FeedbackResponse {
  status: 'ok' | 'duplicate' | 'error';
  errors?: string[];
}
