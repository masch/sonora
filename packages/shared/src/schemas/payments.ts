import { z } from 'zod';
import { ACCESS_SOURCES, PLATFORMS } from '../enums';

export const CreatePaymentBodySchema = z.object({
  experienceId: z.string().uuid(),
  redirectUrl: z.string().url().optional(),
});

export const WebhookBodySchema = z
  .object({
    type: z.string().optional(),
    data: z.object({ id: z.string().optional() }).optional(),
    action: z.string().optional(),
  })
  .passthrough();

export const LogAccessBodySchema = z.object({
  source: z.enum(ACCESS_SOURCES),
  email: z.string().email().optional().nullable(),
  platform: z.enum(PLATFORMS).optional().nullable(),
});

export const EmailQuerySchema = z.object({
  email: z.string().email('A valid email is required'),
});
