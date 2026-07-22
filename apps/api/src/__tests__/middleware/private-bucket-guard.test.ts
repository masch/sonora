import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { privateBucketGuard } from '../../middleware/private-bucket-guard';
import type { R2Bucket } from '@cloudflare/workers-types';

// ── Unit tests ─────────────────────────────────────────────

describe('privateBucketGuard unit', () => {
  it('returns problem response when PRIVATE_BUCKET is undefined', async () => {
    const guard = privateBucketGuard();
    const json = vi.fn(
      (body: unknown, status: number) => ({ body, status }) as unknown as Response,
    );
    const c = { env: {}, json } as any;
    const next = vi.fn();

    const result = (await guard(c, next)) as unknown as {
      body: { code: string; status: number };
      status: number;
    };

    expect(result.status).toBe(500);
    expect(result.body.code).toBe('STORAGE_NOT_CONFIG');
    expect(result.body.status).toBe(500);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when PRIVATE_BUCKET is defined', async () => {
    const guard = privateBucketGuard();
    const c = { env: { PRIVATE_BUCKET: {} as R2Bucket }, set: vi.fn(), json: vi.fn() } as any;
    const next = vi.fn();

    await guard(c, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('response has RFC 7807 shape (code, detail, status)', async () => {
    const guard = privateBucketGuard();
    const json = vi.fn((body: unknown, s: number) => ({ body, status: s }) as unknown as Response);
    const c = { env: {}, json } as any;
    const next = vi.fn();

    const result = (await guard(c, next)) as unknown as {
      body: { code: string; detail: string; status: number };
    };

    expect(result.body).toMatchObject({
      code: 'STORAGE_NOT_CONFIG',
      detail: expect.any(String),
      status: 500,
    });
  });
});

// ── Integration tests with Hono app ───────────────────────

describe('privateBucketGuard integration', () => {
  function createTestApp() {
    const app = new Hono<{
      Bindings: { PRIVATE_BUCKET?: R2Bucket };
      Variables: Record<string, unknown>;
    }>();

    app.get('/protected', privateBucketGuard(), (c) => c.json({ ok: true }));

    return app;
  }

  it('blocks request when PRIVATE_BUCKET is not configured', async () => {
    const app = createTestApp();
    const res = await app.request('/protected');
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('code', 'STORAGE_NOT_CONFIG');
    expect(body).toHaveProperty('detail');
    expect(body).toHaveProperty('status', 500);
  });
});
