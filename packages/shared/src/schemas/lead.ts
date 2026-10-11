import { z } from 'zod';
import { LEAD_SOURCES } from '../enums';

export const LeadEmailSchema = z
  .string({ required_error: 'email is required' })
  .trim()
  .min(1, 'email is required')
  .max(255, 'email must not exceed 255 characters')
  .email('invalid email address');

export const LeadPostBodySchema = z.object({
  email: LeadEmailSchema,
  experienceId: z.string().uuid('experienceId must be a valid UUID').optional(),
  source: z.enum(LEAD_SOURCES),
});

export type LeadPostBody = z.infer<typeof LeadPostBodySchema>;

export interface LeadResponse {
  status: 'ok' | 'duplicate' | 'error';
  message?: string;
  errors?: string[];
}
