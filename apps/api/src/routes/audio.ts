import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { verify } from 'hono/jwt';
import { z, AudioUploadBodySchema, logger } from '@sonora/shared';
import { type Env, type Variables } from '../index';
import { adminAuthGuard } from '../middleware/admin-auth-guard';
import { privateBucketGuard } from '../middleware/private-bucket-guard';
import { publicBucketGuard } from '../middleware/public-bucket-guard';
import { validationHook } from '../middleware/validation-error';
import {
  ERRORS,
  problem,
  created,
  HTTP,
  streamResponse,
  rangeNotSatisfiable,
} from '../middleware/problem-details';

const KeyParamSchema = z.object({
  key: z.string().min(1),
});

const StreamQuerySchema = z.object({
  key: z.string().min(1),
  token: z.string().optional(),
});

const audioRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// ── Helpers ──────────────────────────────────────────────

function detectContentType(key: string, fallback: string | null): string {
  if (fallback && fallback !== 'application/octet-stream') return fallback;
  if (key.endsWith('.mp3')) return 'audio/mpeg';
  if (key.endsWith('.wav')) return 'audio/wav';
  if (key.endsWith('.ogg')) return 'audio/ogg';
  return 'audio/mpeg';
}

interface RangeInfo {
  start: number;
  end: number;
  status: number;
  range?: { offset: number; length: number };
}

function parseRange(rangeHeader: string | null, objectSize: number): RangeInfo | Response {
  if (!rangeHeader) {
    return { start: 0, end: objectSize - 1, status: HTTP.OK };
  }

  const parts = rangeHeader.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : objectSize - 1;

  if (start >= objectSize || end >= objectSize) {
    return rangeNotSatisfiable(objectSize);
  }

  return {
    start,
    end,
    status: HTTP.PARTIAL_CONTENT,
    range: { offset: start, length: end - start + 1 },
  };
}

async function streamFromBucket(
  bucket: R2Bucket,
  key: string,
  rangeHeader: string | null,
  c: { json: <T>(body: T, status: number) => Response },
): Promise<Response> {
  const headObject = await bucket.head(key);
  if (!headObject) {
    return problem(c, ERRORS.NOT_FOUND);
  }

  const objectSize = headObject.size;
  const rawContentType = headObject.httpMetadata?.contentType ?? null;
  const contentType = detectContentType(key, rawContentType);

  const rangeInfo = parseRange(rangeHeader, objectSize);
  if (rangeInfo instanceof Response) return rangeInfo;

  const audioObject = await bucket.get(
    key,
    rangeInfo.range ? { range: rangeInfo.range } : undefined,
  );
  if (!audioObject?.body) {
    return problem(c, ERRORS.STREAMING_FAILED);
  }

  const headers = new Headers();
  audioObject.writeHttpMetadata(headers);

  const etag = audioObject.etag ?? headObject.etag;
  if (etag) headers.set('x-audio-etag', etag);

  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Length', String(rangeInfo.end - rangeInfo.start + 1));
  headers.set('Content-Type', contentType);

  if (rangeHeader) {
    headers.set('Content-Range', `bytes ${rangeInfo.start}-${rangeInfo.end}/${objectSize}`);
  }

  return streamResponse(audioObject.body, rangeInfo.status, headers);
}

// ── Upload ───────────────────────────────────────────────

/**
 * POST /audio/upload
 * Protegido por autenticación de admin (admin_session cookie / Bearer key).
 * Sube el archivo enviado en el cuerpo (multipart/form-data) a Cloudflare R2.
 */
audioRouter.post(
  '/upload',
  adminAuthGuard(),
  privateBucketGuard(),
  zValidator('form', AudioUploadBodySchema, validationHook),
  async (c) => {
    const form = c.req.valid('form') as { file: File; key: string };
    const file = form.file;
    const key = form.key;

    if (!(file instanceof File)) {
      return problem(c, ERRORS.VALIDATION);
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      await c.var.privateBucket.put(key, arrayBuffer, {
        customMetadata: {
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
        },
        httpMetadata: {
          contentType: file.type || 'audio/mpeg',
        },
      });

      const baseUrl = new URL(c.req.url).origin;
      const streamUrl = `${baseUrl}/audio/stream?key=${encodeURIComponent(key)}`;

      return created(c, { success: true, key, streamUrl });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return problem(c, ERRORS.UPLOAD_FAILED, `Failed to upload file to R2: ${msg}`);
    }
  },
);

// ── Public stream (no auth) ──────────────────────────────

/**
 * GET /audio/public/:key
 * Sin autenticación — sirve archivos desde el bucket público.
 * Solo para contenido gratuito (ej: instrucciones).
 */
audioRouter.get(
  '/public/:key',
  publicBucketGuard(),
  zValidator('param', KeyParamSchema, validationHook),
  async (c) => {
    const { key } = c.req.valid('param');

    try {
      return await streamFromBucket(c.var.publicBucket, key, c.req.header('Range') ?? null, c);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return problem(c, ERRORS.STREAMING_FAILED, `Failed to stream from public R2: ${msg}`);
    }
  },
);

// ── Authenticated stream ─────────────────────────────────

/**
 * GET /audio/stream
 * Protegido por JWT Token.
 * Transmite el audio desde R2 soportando Range Requests.
 */
import { jwtGuard } from '../middleware/jwt-guard';

audioRouter.get(
  '/stream',
  privateBucketGuard(),
  jwtGuard(),
  zValidator('query', StreamQuerySchema, validationHook),
  async (c) => {
    const { key, token: queryToken } = c.req.valid('query');
    const token = queryToken || c.req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return problem(c, ERRORS.TOKEN_REQUIRED);

    const jwtSecret = c.var.jwtSecret;

    let isAuthorized = false;
    try {
      const payload = await verify(token, jwtSecret, 'HS256');
      isAuthorized =
        payload.key === key && !!payload.deviceId && payload.deviceId === c.var.deviceId;
    } catch (err) {
      logger.error('Failed to get stream:', err);
    }

    if (!isAuthorized) {
      return problem(c, ERRORS.INVALID_TOKEN);
    }

    try {
      return await streamFromBucket(c.var.privateBucket, key, c.req.header('Range') ?? null, c);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return problem(c, ERRORS.STREAMING_FAILED, `Failed to stream from private R2: ${msg}`);
    }
  },
);

export { audioRouter };
