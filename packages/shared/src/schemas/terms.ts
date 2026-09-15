import { z } from 'zod';
import { PLATFORMS, SUPPORTED_LANGUAGES } from '../enums';

const SHA256_REGEX = /^[a-f0-9]{64}$/i;

export const TermsResponseSchema = z.object({
  version: z.string().min(1),
  lang: z.enum(SUPPORTED_LANGUAGES),
  title: z.string().min(1),
  content: z.string(),
  contentHash: z
    .string()
    .regex(SHA256_REGEX, 'contentHash must be a valid 64-character SHA-256 hex string'),
  publishedAt: z.string().min(1),
});

export type TermsResponse = z.infer<typeof TermsResponseSchema>;

export const TermsQuerySchema = z.object({
  lang: z.enum(SUPPORTED_LANGUAGES),
});

export type TermsQuery = z.infer<typeof TermsQuerySchema>;

export const AcceptTermsRequestSchema = z.object({
  deviceId: z.string().min(1),
  version: z.string().min(1),
  lang: z.enum(SUPPORTED_LANGUAGES),
  contentHash: z
    .string()
    .regex(SHA256_REGEX, 'contentHash must be a valid 64-character SHA-256 hex string'),
  platform: z.enum(PLATFORMS),
});

export type AcceptTermsRequest = z.infer<typeof AcceptTermsRequestSchema>;
