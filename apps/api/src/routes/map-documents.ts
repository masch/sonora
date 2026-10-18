import { and, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  boundsOfDocuments,
  DEFAULT_REMOTE_CONFIG,
  isAllowedHttpsUrl,
  MAP_LINK_ALLOWED_HOSTS,
  mapDocumentSchema,
  MapDocumentWritePayloadSchema,
  type MapDocument,
  type MapDocumentWritePayload,
} from '@sonora/shared';
import {
  experiences,
  mapDocumentBindings,
  mapDocuments,
  toMapDocument,
  translations,
} from '../db/schema';
import type { Env, Variables } from '../index';
import { adminAuthGuard } from '../middleware/admin-auth-guard';
import { dbGuard } from '../middleware/db-guard';
import { ERRORS, created, problem, success } from '../middleware/problem-details';
import { validateJson } from '../middleware/validation-error';

const mapDocumentsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

/** Every locale of the app must carry the key before a document can be stored. */
const REQUIRED_TRANSLATION_LANGS = ['es', 'en'] as const;

function translationKeysOf(document: MapDocument): string[] {
  const keys = new Set<string>();
  for (const feature of document.collection.features) {
    keys.add(feature.properties.labelKey);
    if (feature.properties.descriptionKey) keys.add(feature.properties.descriptionKey);
  }
  return [...keys];
}

/** Returns a human-readable reason when a card link may not be published. */
function linkRejectionReason(document: MapDocument): string | null {
  const handle = DEFAULT_REMOTE_CONFIG.social?.instagramHandle;

  for (const feature of document.collection.features) {
    const { linkUrl } = feature.properties;
    if (!linkUrl) continue;

    if (!isAllowedHttpsUrl(linkUrl, MAP_LINK_ALLOWED_HOSTS)) {
      return `link host is not allowlisted: ${linkUrl}`;
    }

    const parsed = new URL(linkUrl);
    if (
      handle &&
      (parsed.hostname === 'instagram.com' || parsed.hostname.endsWith('.instagram.com'))
    ) {
      const expected = `/${handle}`;
      if (parsed.pathname.replace(/\/$/, '') !== expected) {
        return `instagram links must point to ${expected}`;
      }
    }
  }

  return null;
}

/** Returns a reason when a card image did not come from our upload endpoint. */
function imageRejectionReason(document: MapDocument, requestOrigin: string): string | null {
  for (const feature of document.collection.features) {
    const { imageUrl } = feature.properties;
    if (!imageUrl) continue;

    let parsed: URL;
    try {
      parsed = new URL(imageUrl);
    } catch {
      return `invalid image url: ${imageUrl}`;
    }

    if (parsed.origin !== requestOrigin || !parsed.pathname.startsWith('/media/public/')) {
      return `image urls must come from the upload endpoint on this origin: ${imageUrl}`;
    }
  }

  return null;
}

/** GET /map-documents — every stored document with its bindings, for admin. */
mapDocumentsRouter.get('/', adminAuthGuard(), dbGuard(), async (c) => {
  const db = c.var.db;
  const rows = await db.select().from(mapDocuments);
  const bindings = await db.select().from(mapDocumentBindings);

  return success(
    c,
    rows.map((row) => ({
      ...toMapDocument(row),
      published: row.published,
      bounds: {
        west: row.bboxWest,
        south: row.bboxSouth,
        east: row.bboxEast,
        north: row.bboxNorth,
      },
      experienceIds: bindings
        .filter((binding) => binding.documentId === row.id)
        .map((binding) => binding.experienceId),
    })),
  );
});

/** POST /map-documents — create or replace a document and its bindings by key. */
mapDocumentsRouter.post(
  '/',
  adminAuthGuard(),
  validateJson(MapDocumentWritePayloadSchema),
  dbGuard(),
  async (c) => {
    const payload = c.req.valid('json') as MapDocumentWritePayload;
    const parsed = mapDocumentSchema.safeParse({
      key: payload.key,
      scope: payload.scope,
      zIndex: payload.zIndex,
      version: payload.version,
      collection: payload.collection,
    });

    if (!parsed.success) {
      return problem(c, ERRORS.VALIDATION, 'invalid map document', [
        { path: 'collection', message: parsed.error.issues[0]?.message ?? 'invalid document' },
      ]);
    }

    const document = parsed.data as MapDocument;
    const bounds = boundsOfDocuments([document]);
    if (!bounds) {
      return problem(c, ERRORS.VALIDATION, 'document has no features to draw', [
        { path: 'collection', message: 'document has no features to draw' },
      ]);
    }

    if (document.scope === 'global' && payload.experienceIds.length > 0) {
      return problem(c, ERRORS.VALIDATION, 'global documents take no experience bindings', [
        { path: 'experienceIds', message: 'global documents take no experience bindings' },
      ]);
    }

    const linkReason = linkRejectionReason(document);
    if (linkReason) {
      return problem(c, ERRORS.VALIDATION, linkReason, [
        { path: 'collection', message: linkReason },
      ]);
    }

    const imageReason = imageRejectionReason(document, new URL(c.req.url).origin);
    if (imageReason) {
      return problem(c, ERRORS.VALIDATION, imageReason, [
        { path: 'collection', message: imageReason },
      ]);
    }

    const db = c.var.db;
    const keys = translationKeysOf(document);
    const translationRows =
      keys.length > 0
        ? await db
            .select({ lang: translations.lang, key: translations.key })
            .from(translations)
            .where(
              and(
                inArray(translations.key, keys),
                inArray(translations.lang, [...REQUIRED_TRANSLATION_LANGS]),
              ),
            )
        : [];

    const present = new Set(translationRows.map((row) => `${row.lang}:${row.key}`));
    const missing = keys.filter((key) =>
      REQUIRED_TRANSLATION_LANGS.some((lang) => !present.has(`${lang}:${key}`)),
    );
    if (missing.length > 0) {
      const missingDetail = `missing translations: ${missing.join(', ')}`;
      return problem(c, ERRORS.VALIDATION, missingDetail, [
        { path: 'collection', message: missingDetail },
      ]);
    }

    const values = {
      key: document.key,
      scope: document.scope,
      zIndex: document.zIndex ?? 0,
      version: document.version ?? 1,
      collection: document.collection,
      bboxWest: bounds.west,
      bboxSouth: bounds.south,
      bboxEast: bounds.east,
      bboxNorth: bounds.north,
      published: payload.published,
      updatedAt: new Date(),
    };

    // neon-http has no interactive transactions, so every predictable failure is
    // removed before the first write: duplicates cannot collide on the composite
    // key, and an unknown experience cannot fail the foreign key.
    const desiredExperienceIds = [...new Set(payload.experienceIds)];
    if (desiredExperienceIds.length > 0) {
      const knownExperiences = await db
        .select({ id: experiences.id })
        .from(experiences)
        .where(inArray(experiences.id, desiredExperienceIds));
      const knownIds = new Set(knownExperiences.map((row) => row.id));
      const unknown = desiredExperienceIds.filter((id) => !knownIds.has(id));
      if (unknown.length > 0) {
        const detail = `unknown experiences: ${unknown.join(', ')}`;
        return problem(c, ERRORS.VALIDATION, detail, [{ path: 'experienceIds', message: detail }]);
      }
    }

    const [row] = await db
      .insert(mapDocuments)
      .values(values)
      .onConflictDoUpdate({ target: mapDocuments.key, set: values })
      .returning();

    // Reconcile bindings by difference instead of deleting them all first: a
    // failed insert then leaves the existing bindings intact.
    const currentBindings = await db
      .select({ experienceId: mapDocumentBindings.experienceId })
      .from(mapDocumentBindings)
      .where(eq(mapDocumentBindings.documentId, row.id));
    const currentIds = new Set(currentBindings.map((binding) => binding.experienceId));

    const toDelete = [...currentIds].filter((id) => !desiredExperienceIds.includes(id));
    const toInsert = desiredExperienceIds.filter((id) => !currentIds.has(id));

    if (toDelete.length > 0) {
      await db
        .delete(mapDocumentBindings)
        .where(
          and(
            eq(mapDocumentBindings.documentId, row.id),
            inArray(mapDocumentBindings.experienceId, toDelete),
          ),
        );
    }
    if (toInsert.length > 0) {
      await db
        .insert(mapDocumentBindings)
        .values(toInsert.map((experienceId) => ({ documentId: row.id, experienceId })));
    }

    return created(c, {
      ...toMapDocument(row),
      published: row.published,
      experienceIds: desiredExperienceIds,
    });
  },
);

/** DELETE /map-documents/:key — removes the document; bindings cascade. */
mapDocumentsRouter.delete('/:key', adminAuthGuard(), dbGuard(), async (c) => {
  const key = c.req.param('key');
  const existing = await c.var.db
    .select({ key: mapDocuments.key })
    .from(mapDocuments)
    .where(eq(mapDocuments.key, key));

  if (existing.length === 0) {
    return problem(c, ERRORS.NOT_FOUND, `document not found: ${key}`);
  }

  await c.var.db.delete(mapDocuments).where(eq(mapDocuments.key, key));

  return success(c, { deleted: key });
});

export { mapDocumentsRouter };
