import { z } from 'zod';

import { mapDocumentSchema } from '../map/schema';

/**
 * Body of an admin write to the reference-document store. The document itself
 * is validated by `mapDocumentSchema`; the extra fields describe where it
 * applies and whether it is live.
 */
export const MapDocumentWritePayloadSchema = z.object({
  key: mapDocumentSchema.shape.key,
  scope: mapDocumentSchema.shape.scope,
  zIndex: mapDocumentSchema.shape.zIndex,
  version: mapDocumentSchema.shape.version,
  collection: mapDocumentSchema.shape.collection,
  published: z.boolean().default(false),
  /** Experiences this document is bound to. Globals must leave this empty. */
  experienceIds: z.array(z.string().uuid()).max(200).default([]),
});

export type MapDocumentWritePayload = z.infer<typeof MapDocumentWritePayloadSchema>;

/** Reference card images are uploaded to the public bucket, so they are bounded. */
export const REFERENCE_IMAGE_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
} as const;

export const ReferenceImageUploadBodySchema = z.object({
  file: z
    .instanceof(File, { message: 'file must be a File' })
    .refine((file) => (REFERENCE_IMAGE_LIMITS.mimeTypes as readonly string[]).includes(file.type), {
      message: `unsupported image type, allowed: ${REFERENCE_IMAGE_LIMITS.mimeTypes.join(', ')}`,
    })
    .refine((file) => file.size <= REFERENCE_IMAGE_LIMITS.maxBytes, {
      message: `image is larger than ${REFERENCE_IMAGE_LIMITS.maxBytes} bytes`,
    }),
});
