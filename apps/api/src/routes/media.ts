import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { REFERENCE_IMAGE_LIMITS, ReferenceImageUploadBodySchema } from '@sonora/shared';
import type { Env, Variables } from '../index';
import { adminAuthGuard } from '../middleware/admin-auth-guard';
import { ERRORS, created, problem } from '../middleware/problem-details';
import { publicBucketGuard } from '../middleware/public-bucket-guard';
import { validationHook } from '../middleware/validation-error';

const mediaRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

/** Namespace inside the public bucket for reference card images. */
export const REFERENCE_IMAGE_PREFIX = 'map-references/';

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

/**
 * POST /media/reference-images
 * Admin only. Stores a reference card image under a generated key and returns
 * the URL the document must use, so the write path can reject any other origin.
 */
mediaRouter.post(
  '/reference-images',
  adminAuthGuard(),
  publicBucketGuard(),
  zValidator('form', ReferenceImageUploadBodySchema, validationHook),
  async (c) => {
    const { file } = c.req.valid('form') as { file: File };

    if (!(file instanceof File)) {
      return problem(c, ERRORS.VALIDATION);
    }

    const extension = EXTENSION_BY_TYPE[file.type] ?? 'bin';
    const key = `${REFERENCE_IMAGE_PREFIX}${crypto.randomUUID()}.${extension}`;

    try {
      await c.var.publicBucket.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type, cacheControl: IMMUTABLE_CACHE },
        customMetadata: { originalName: file.name, uploadedAt: new Date().toISOString() },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return problem(c, ERRORS.UPLOAD_FAILED, `Failed to upload image to R2: ${msg}`);
    }

    const origin = new URL(c.req.url).origin;
    return created(c, {
      key,
      url: `${origin}/media/public/${key}`,
      maxBytes: REFERENCE_IMAGE_LIMITS.maxBytes,
    });
  },
);

/**
 * GET /media/public/:key
 * No authentication: serves an uploaded image. Keys are unguessable UUIDs and
 * the content is immutable, so it is cached for a year.
 */
mediaRouter.get('/public/:key{.+}', publicBucketGuard(), async (c) => {
  const key = c.req.param('key');

  try {
    const object = await c.var.publicBucket.get(key);
    if (!object) {
      return problem(c, ERRORS.NOT_FOUND, `object not found: ${key}`);
    }

    return new Response(object.body, {
      headers: {
        'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
        etag: object.httpEtag,
        'cache-control': object.httpMetadata?.cacheControl ?? IMMUTABLE_CACHE,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return problem(c, ERRORS.STREAMING_FAILED, `Failed to read from public R2: ${msg}`);
  }
});

export { mediaRouter };
