import type { R2Bucket } from '@cloudflare/workers-types';
import { Hono } from 'hono';
import { verify } from 'hono/jwt';
import { type Env, type Variables } from '../index';

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
    return { start: 0, end: objectSize - 1, status: 200 };
  }

  const parts = rangeHeader.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : objectSize - 1;

  if (start >= objectSize || end >= objectSize) {
    return new Response(null, {
      status: 416,
      statusText: 'Range Not Satisfiable',
      headers: { 'Content-Range': `bytes */${objectSize}` },
    });
  }

  return {
    start,
    end,
    status: 206,
    range: { offset: start, length: end - start + 1 },
  };
}

async function streamFromBucket(
  bucket: R2Bucket,
  key: string,
  rangeHeader: string | null,
): Promise<Response> {
  const headObject = await bucket.head(key);
  if (!headObject) {
    return new Response(JSON.stringify({ error: 'Audio file not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
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
    return new Response(JSON.stringify({ error: 'Failed to retrieve audio content' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
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

  return new Response(audioObject.body, { status: rangeInfo.status, headers });
}

// ── Upload ───────────────────────────────────────────────

/**
 * POST /audio/upload
 * Protegido por ADMIN_API_KEY secreta.
 * Sube el archivo enviado en el cuerpo (multipart/form-data) a Cloudflare R2.
 */
audioRouter.post('/upload', async (c) => {
  const authHeader = c.req.header('Authorization');
  const adminKey =
    c.env?.ADMIN_API_KEY ||
    (typeof process !== 'undefined' ? process.env.ADMIN_API_KEY : undefined);

  if (!adminKey) {
    console.error('ADMIN_API_KEY variable de entorno no configurada.');
    return c.json({ error: 'Server misconfiguration: ADMIN_API_KEY is missing' }, 500);
  }

  if (authHeader !== `Bearer ${adminKey}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.parseBody();
    const file = body['file'];
    const key = body['key'];

    if (!file || !(file instanceof File) || !key || typeof key !== 'string') {
      return c.json({ error: 'Missing file (form field: file) or key (form field: key)' }, 400);
    }

    if (!c.env.PRIVATE_BUCKET) {
      return c.json({ error: 'Storage bucket binding not configured' }, 500);
    }

    const arrayBuffer = await file.arrayBuffer();
    await c.env.PRIVATE_BUCKET.put(key, arrayBuffer, {
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

    return c.json({ success: true, key, streamUrl }, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to upload file to R2:', msg);
    return c.json({ error: `Upload failed: ${msg}` }, 500);
  }
});

// ── Public stream (no auth) ──────────────────────────────

/**
 * GET /audio/public/:key
 * Sin autenticación — sirve archivos desde el bucket público.
 * Solo para contenido gratuito (ej: instrucciones).
 */
audioRouter.get('/public/:key', async (c) => {
  const key = c.req.param('key');
  if (!key) return c.json({ error: 'Missing key parameter' }, 400);

  if (!c.env.PUBLIC_BUCKET) {
    return c.json({ error: 'Public storage bucket binding not configured' }, 500);
  }

  try {
    return await streamFromBucket(c.env.PUBLIC_BUCKET, key, c.req.header('Range') ?? null);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to stream file from public R2:', msg);
    return c.json({ error: `Streaming failed: ${msg}` }, 500);
  }
});

// ── Authenticated stream ─────────────────────────────────

/**
 * GET /audio/stream
 * Protegido por JWT Token.
 * Transmite el audio desde R2 soportando Range Requests.
 */
audioRouter.get('/stream', async (c) => {
  const key = c.req.query('key');
  if (!key) return c.json({ error: 'Missing key parameter' }, 400);

  const token = c.req.query('token') || c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return c.json({ error: 'Unauthorized. Access token is required.' }, 401);

  const jwtSecret = c.env.JWT_SECRET;
  if (!jwtSecret) {
    return c.json({ error: 'Server configuration error: JWT secret not configured' }, 500);
  }

  let isAuthorized = false;
  try {
    const payload = await verify(token, jwtSecret, 'HS256');
    if (payload.key === key) isAuthorized = true;
  } catch (err) {
    console.error('Failed to get stream:', err);
  }

  if (!isAuthorized) {
    return c.json({ error: 'Unauthorized. Invalid or expired token.' }, 401);
  }

  if (!c.env.PRIVATE_BUCKET) {
    return c.json({ error: 'Storage bucket binding not configured' }, 500);
  }

  try {
    return await streamFromBucket(c.env.PRIVATE_BUCKET, key, c.req.header('Range') ?? null);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to stream file from R2:', msg);
    return c.json({ error: `Streaming failed: ${msg}` }, 500);
  }
});

export { audioRouter };
