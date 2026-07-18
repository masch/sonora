import { sign } from 'hono/jwt';
import { describe, expect, it, vi } from 'vitest';
import app from '../index';

const mockR2Bucket = {
  put: vi.fn(async (key: string, _: any, __?: any) => {
    return {
      key,
      size: 100,
    };
  }),
  get: vi.fn(async (key: string, _?: any) => {
    if (key === 'non-existent.mp3') return null;
    return {
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('mock audio content'));
          controller.close();
        },
      }),
      size: 17,
      httpEtag: 'mock-etag',
      writeHttpMetadata: (headers: Headers) => {
        headers.set('Content-Type', 'audio/mpeg');
      },
    };
  }),
  head: vi.fn(async (key: string) => {
    if (key === 'non-existent.mp3') return null;
    return {
      size: 17,
      httpMetadata: {
        contentType: 'audio/mpeg',
      },
    };
  }),
};

describe('Audio Router', () => {
  const env = {
    ADMIN_API_KEY: 'test-admin-key',
    JWT_SECRET: 'test-jwt-secret',
    CLIENT_API_KEY: 'test-client-key',
    BUCKET: mockR2Bucket as unknown as R2Bucket,
  };

  const generateToken = async (key: string, secret = 'test-jwt-secret') => {
    return await sign(
      {
        key,
        exp: Math.floor(Date.now() / 1000) + 60,
      },
      secret,
    );
  };

  describe('POST /audio/upload', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const res = await app.request(
        '/audio/upload',
        {
          method: 'POST',
        },
        env,
      );
      expect(res.status).toBe(401);
    });

    it('returns 401 when Authorization header is invalid', async () => {
      const res = await app.request(
        '/audio/upload',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer invalid-key',
          },
        },
        env,
      );
      expect(res.status).toBe(401);
    });

    it('returns 400 when file or key is missing', async () => {
      const formData = new FormData();
      const res = await app.request(
        '/audio/upload',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer test-admin-key',
          },
          body: formData,
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it('successfully uploads audio and returns streamUrl', async () => {
      const formData = new FormData();
      formData.append('key', 'experiences/test.mp3');
      formData.append(
        'file',
        new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' }),
        'test.mp3',
      );

      const res = await app.request(
        '/audio/upload',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer test-admin-key',
          },
          body: formData,
        },
        env,
      );

      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.key).toBe('experiences/test.mp3');
      expect(body.streamUrl).toContain('/audio/stream?key=experiences%2Ftest.mp3');
      expect(mockR2Bucket.put).toHaveBeenCalled();
    });

    it('returns 500 when ADMIN_API_KEY environment variable is missing', async () => {
      const res = await app.request(
        '/audio/upload',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer test-admin-key',
          },
        },
        { BUCKET: mockR2Bucket as unknown as R2Bucket },
      );
      expect(res.status).toBe(500);
      const body = (await res.json()) as any;
      expect(body.error).toContain('ADMIN_API_KEY is missing');
    });

    it('returns 500 when BUCKET binding is missing', async () => {
      const formData = new FormData();
      formData.append('key', 'experiences/test.mp3');
      formData.append(
        'file',
        new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' }),
        'test.mp3',
      );

      const res = await app.request(
        '/audio/upload',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer test-admin-key',
          },
          body: formData,
        },
        { ADMIN_API_KEY: 'test-admin-key' },
      );
      expect(res.status).toBe(500);
      const body = (await res.json()) as any;
      expect(body.error).toContain('Storage bucket binding not configured');
    });
  });

  describe('GET /audio/stream', () => {
    it('returns 401 when user is unauthorized', async () => {
      const res = await app.request('/audio/stream?key=experiences/test.mp3', {}, env);
      expect(res.status).toBe(401);
    });

    it('returns 404 when key does not exist', async () => {
      const token = await generateToken('non-existent.mp3');
      const res = await app.request(
        '/audio/stream?key=non-existent.mp3',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it('streams full audio when Range header is not present', async () => {
      const token = await generateToken('experiences/test.mp3');
      const res = await app.request(
        '/audio/stream?key=experiences/test.mp3',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        env,
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Length')).toBe('17');
      expect(res.headers.get('Content-Type')).toBe('audio/mpeg');
      const text = await res.text();
      expect(text).toBe('mock audio content');
    });

    it('streams full audio when query token is present instead of Authorization header', async () => {
      const token = await generateToken('experiences/test.mp3');
      const res = await app.request(
        `/audio/stream?key=experiences/test.mp3&token=${token}`,
        {},
        env,
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Length')).toBe('17');
      expect(res.headers.get('Content-Type')).toBe('audio/mpeg');
      const text = await res.text();
      expect(text).toBe('mock audio content');
    });

    it('streams partial audio when Range header is present', async () => {
      const token = await generateToken('experiences/test.mp3');
      const res = await app.request(
        '/audio/stream?key=experiences/test.mp3',
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Range: 'bytes=0-10',
          },
        },
        env,
      );

      expect(res.status).toBe(206);
      expect(res.headers.get('Content-Range')).toBe('bytes 0-10/17');
      expect(res.headers.get('Content-Length')).toBe('11');
      expect(mockR2Bucket.get).toHaveBeenCalledWith('experiences/test.mp3', {
        range: { offset: 0, length: 11 },
      });
    });

    it('returns 401 when query token is invalid', async () => {
      const res = await app.request(
        '/audio/stream?key=experiences/test.mp3&token=invalid-key',
        {},
        env,
      );
      expect(res.status).toBe(401);
    });

    it('returns 400 when key parameter is missing', async () => {
      const token = await generateToken('experiences/test.mp3');
      const res = await app.request(
        '/audio/stream',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it('returns 416 when requested range is out of bounds', async () => {
      const token = await generateToken('experiences/test.mp3');
      const res = await app.request(
        '/audio/stream?key=experiences/test.mp3',
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Range: 'bytes=100-200',
          },
        },
        env,
      );
      expect(res.status).toBe(416);
    });

    it('returns 500 when BUCKET binding is missing', async () => {
      const token = await generateToken('experiences/test.mp3');
      const res = await app.request(
        '/audio/stream?key=experiences/test.mp3',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        { JWT_SECRET: 'test-jwt-secret' },
      );
      expect(res.status).toBe(500);
    });
  });
});
