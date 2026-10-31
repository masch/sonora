import { z } from 'zod';

export const FeedbackPostBodySchema = z.object({
  experienceId: z
    .string({
      error: (issue) =>
        issue.input === undefined
          ? 'experienceId is required and must be a non-empty string'
          : undefined,
    })
    .min(1, 'experienceId is required and must be a non-empty string'),
  message: z
    .string({
      error: (issue) =>
        issue.input === undefined
          ? 'message is required and must be a non-empty string'
          : undefined,
    })
    .min(1, 'message is required and must be a non-empty string')
    .max(1000, 'message must not exceed 1000 characters'),
  idempotencyKey: z
    .string({
      error: (issue) =>
        issue.input === undefined
          ? 'idempotencyKey is required and must be a non-empty string'
          : undefined,
    })
    .min(1, 'idempotencyKey is required and must be a non-empty string'),
  createdAt: z
    .string({
      error: (issue) =>
        issue.input === undefined
          ? 'createdAt is required and must be a non-empty string'
          : undefined,
    })
    .min(1, 'createdAt is required and must be a non-empty string'),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

export type FeedbackPostBody = z.infer<typeof FeedbackPostBodySchema>;

export interface FeedbackResponse {
  status: 'ok' | 'duplicate' | 'error';
  errors?: string[];
}
