import { Hono } from 'hono';
import { verify } from 'hono/jwt';
import { type Env, type Variables } from '../index';

const audioRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

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
    const key = body['key']; // e.g., "experiences/mi-audio-id.mp3"

    if (!file || !(file instanceof File) || !key || typeof key !== 'string') {
      return c.json({ error: 'Missing file (form field: file) or key (form field: key)' }, 400);
    }

    if (!c.env.BUCKET) {
      return c.json({ error: 'Storage bucket binding not configured' }, 500);
    }

    const arrayBuffer = await file.arrayBuffer();
    await c.env.BUCKET.put(key, arrayBuffer, {
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

    return c.json(
      {
        success: true,
        key,
        streamUrl,
      },
      201,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to upload file to R2:', msg);
    return c.json({ error: `Upload failed: ${msg}` }, 500);
  }
});

/**
 * GET /audio/stream
 * Protegido por Token de Usuario.
 * Transmite el audio desde R2 soportando Range Requests para reproductores móviles (iOS/Android).
 */
audioRouter.get('/stream', async (c) => {
  const key = c.req.query('key');
  if (!key) return c.json({ error: 'Missing key parameter' }, 400);

  const token = c.req.query('token') || c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return c.json({ error: 'Unauthorized. Access token is required.' }, 401);

  const jwtSecret = c.env.JWT_SECRET || 'sonora-jwt-secret-key-1234';
  const clientKey = c.env.CLIENT_API_KEY || 'sonora-client-secret-1234';
  let isAuthorized = false;

  try {
    const payload = await verify(token, jwtSecret, 'HS256');
    if (payload.key === key) isAuthorized = true;
  } catch {}

  if (!isAuthorized && key === 'experiences/instrucciones.mp3' && token === clientKey) {
    isAuthorized = true;
  }

  if (!isAuthorized) {
    return c.json({ error: 'Unauthorized. Invalid or expired token.' }, 401);
  }

  if (!c.env.BUCKET) {
    return c.json({ error: 'Storage bucket binding not configured' }, 500);
  }

  try {
    const rangeHeader = c.req.header('Range');
    const headObject = await c.env.BUCKET.head(key);
    if (!headObject) return c.json({ error: 'Audio file not found' }, 404);

    const objectSize = headObject.size;
    let contentType = headObject.httpMetadata?.contentType || 'audio/mpeg';

    if (contentType === 'application/octet-stream') {
      if (key.endsWith('.mp3')) contentType = 'audio/mpeg';
      else if (key.endsWith('.wav')) contentType = 'audio/wav';
      else if (key.endsWith('.ogg')) contentType = 'audio/ogg';
    }

    let start = 0;
    let end = objectSize - 1;
    let status = 200;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      start = parseInt(parts[0], 10);
      if (parts[1]) end = parseInt(parts[1], 10);

      if (start >= objectSize || end >= objectSize) {
        return c.json({ error: 'Requested range not satisfiable' }, 416);
      }
      status = 206;
    }

    const range = rangeHeader ? { offset: start, length: end - start + 1 } : undefined;
    const audioObject = await c.env.BUCKET.get(key, { range });
    if (!audioObject || !audioObject.body) {
      return c.json({ error: 'Failed to retrieve audio content' }, 500);
    }

    const headers = new Headers();
    c.res.headers.forEach((value, k) => headers.set(k, value));
    audioObject.writeHttpMetadata(headers);

    const etag = audioObject.etag || headObject.etag;
    if (etag) {
      headers.set('x-audio-etag', etag);
    }

    headers.set('Accept-Ranges', 'bytes');
    headers.set('Content-Length', (end - start + 1).toString());
    headers.set('Content-Type', contentType);

    if (rangeHeader) {
      headers.set('Content-Range', `bytes ${start}-${end}/${objectSize}`);
    }

    return new Response(audioObject.body, { status, headers });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to stream file from R2:', msg);
    return c.json({ error: `Streaming failed: ${msg}` }, 500);
  }
});

export { audioRouter };
