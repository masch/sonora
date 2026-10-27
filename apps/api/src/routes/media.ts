import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import {
  REFERENCE_IMAGE_LIMITS,
  ReferenceImageUploadBodySchema,
  logger,
  mapGlyphsPath,
  mapSpritePath,
  mapStyleKey,
} from '@sonora/shared';
import type { Env, Variables } from '../index';
import { adminAuthGuard } from '../middleware/admin-auth-guard';
import { normalizeArtifactVersion } from '../middleware/config-guard';
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

/**
 * Cache policy for a published artifact in production, where the version the
 * app reads is pinned in the url: the bytes behind a key never change, so a year
 * of `immutable` is honest.
 */
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

/**
 * Cache policy everywhere else: the browser may keep the bytes but must
 * revalidate before using them again.
 */
const REVALIDATE_CACHE = 'no-cache';

/**
 * The `cache-control` a served or stored artifact carries in this environment.
 *
 * Only production pins the artifact version in the url, so only production can
 * promise the bytes behind a key will not change. Every other environment
 * overwrites the style document and the archives in place, without a version
 * bump, and `immutable` would keep a browser from re-requesting the object for a
 * year: the `no-cache` policy makes it revalidate on the next load instead. The
 * decision therefore overrides whatever policy the object was stored with — a
 * staging object uploaded before this rule still carries `immutable` in its own
 * `httpMetadata`.
 *
 * An absent or empty `ENVIRONMENT` means production, so an existing deployment
 * that does not name one keeps the immutable policy it always had.
 *
 * Computed once per request by the caller, never inside the branches that
 * build each response.
 */
function artifactCacheControl(env: Env | undefined, stored?: string): string {
  const environment = env?.ENVIRONMENT;

  if (environment === undefined || environment === '' || environment === 'production') {
    return stored ?? IMMUTABLE_CACHE;
  }

  return REVALIDATE_CACHE;
}

const PMTILES_SCHEME = 'pmtiles://';

/**
 * Re-points one source url at the origin that served this request, keeping its
 * path.
 *
 * A `pmtiles://` url is an archive **we** publish, so the origin inside it must
 * be the one the client is talking to: the published staging style names
 * production tiles, which the native renderer masks (it swaps the source for the
 * local archive) and the web renderer does not. A url that is not ours — a
 * raster source's tilejson, a tile server the author picked — is left exactly as
 * published, and so is a `pmtiles://` url we cannot parse.
 */
function repointPmtilesUrl(url: unknown, origin: string): unknown {
  if (typeof url !== 'string' || !url.startsWith(PMTILES_SCHEME)) return url;

  try {
    const published = new URL(url.slice(PMTILES_SCHEME.length));
    return `${PMTILES_SCHEME}${origin}${published.pathname}${published.search}`;
  } catch {
    return url;
  }
}

/**
 * Rewrites a published style document so it points only at this origin: glyphs
 * and sprite at our own media paths, and every `pmtiles://` source at the origin
 * that served the request.
 *
 * Returns `null` when the bytes are not a style document — not JSON, or JSON
 * without the `version` MapLibre reads before anything else. The caller serves
 * those bytes as they are: a style the pipeline could not parse is still the
 * object the app already knows how to read, and a 500 here would take the map
 * down instead of degrading it to what the author published.
 */
function rewriteStyleDocument(bytes: ArrayBuffer, origin: string, key: string): string | null {
  let document: unknown;
  try {
    document = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    logger.warn(`[MEDIA] published style is not valid JSON, serving it as published: ${key}`);
    return null;
  }

  if (document === null || typeof document !== 'object') {
    logger.warn(`[MEDIA] published style is not a JSON object, serving it as published: ${key}`);
    return null;
  }

  const style = document as Record<string, unknown>;
  if (typeof style.version !== 'number') {
    logger.warn(`[MEDIA] published style has no version, serving it as published: ${key}`);
    return null;
  }

  const sources = style.sources;
  const rewrittenSources =
    sources !== null && typeof sources === 'object'
      ? Object.fromEntries(
          Object.entries(sources as Record<string, unknown>).map(([name, source]) => {
            if (source === null || typeof source !== 'object') return [name, source];
            const { url } = source as { url?: unknown };
            return [name, { ...(source as object), url: repointPmtilesUrl(url, origin) }];
          }),
        )
      : null;

  return JSON.stringify({
    ...style,
    glyphs: `${origin}${mapGlyphsPath()}`,
    sprite: `${origin}${mapSpritePath()}`,
    ...(rewrittenSources === null ? {} : { sources: rewrittenSources }),
  });
}

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
    const cacheControl = artifactCacheControl(c.env);

    try {
      await c.var.publicBucket.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type, cacheControl },
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
 * No authentication: serves an uploaded image, a map archive or the published
 * style document. Keys are unguessable UUIDs or versioned artifact names, so
 * production caches them for a year; every other environment serves them with a
 * revalidating policy, because it overwrites them in place.
 *
 * The style document is the one key that is not streamed as stored: it is
 * rewritten for the origin that served it, so labels and icons come from our own
 * bucket and the basemap never names another environment's tiles. The rewrite is
 * a pure function of the stored bytes and this origin, which is what keeps the
 * stored etag honest — one url plus one etag still names exactly one response.
 */
mediaRouter.get('/public/:key{.+}', publicBucketGuard(), async (c) => {
  const key = c.req.param('key');
  const origin = new URL(c.req.url).origin;

  try {
    const object = await c.var.publicBucket.get(key);
    if (!object) {
      return problem(c, ERRORS.NOT_FOUND, `object not found: ${key}`);
    }

    const headers: Record<string, string> = {
      'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      etag: object.httpEtag,
      'cache-control': artifactCacheControl(c.env, object.httpMetadata?.cacheControl),
    };

    // Only the version in play is a style document: an older published style
    // stays the bytes its author uploaded, so rolling back is a variable and not
    // a rewrite. Every other key is opaque bytes and is streamed untouched.
    if (key !== mapStyleKey(normalizeArtifactVersion(c.env?.MAP_ARTIFACT_VERSION))) {
      return new Response(object.body, { headers });
    }

    const bytes = await object.arrayBuffer();
    const rewritten = rewriteStyleDocument(bytes, origin, key);
    if (rewritten === null) {
      // Already read to decide: these are the stored bytes, unchanged.
      return new Response(bytes, { headers });
    }

    return new Response(rewritten, {
      headers: { ...headers, 'content-type': 'application/json' },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return problem(c, ERRORS.STREAMING_FAILED, `Failed to read from public R2: ${msg}`);
  }
});

export { mediaRouter };
