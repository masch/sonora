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
