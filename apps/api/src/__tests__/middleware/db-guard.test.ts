import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { dbGuard } from '../../middleware/db-guard';
import type { DbClient } from '../../db';

// ── Unit tests ─────────────────────────────────────────────

describe('dbGuard unit', () => {
  it('returns problem response when db is undefined', async () => {
    const guard = dbGuard();
    const json = vi.fn(
      (body: unknown, status: number) => ({ body, status }) as unknown as Response,
    );
    const c = { var: { db: undefined }, json } as any;
    const next = vi.fn();

    const result = (await guard(c, next)) as unknown as {
      body: { code: string; status: number };
      status: number;
    };

    expect(result.status).toBe(500);
    expect(result.body.code).toBe('DB_NOT_AVAILABLE');
    expect(result.body.status).toBe(500);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns problem response when db is null', async () => {
    const guard = dbGuard();
    const json = vi.fn(
      (body: unknown, status: number) => ({ body, status }) as unknown as Response,
    );
    const c = { var: { db: null }, json } as any;
    const next = vi.fn();

    const result = (await guard(c, next)) as unknown as { status: number };

    expect(result.status).toBe(500);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when db is defined', async () => {
    const guard = dbGuard();
    const c = { var: { db: {} as DbClient }, json: vi.fn() } as any;
    const next = vi.fn();

    await guard(c, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('response has RFC 7807 shape (code, detail, status)', async () => {
    const guard = dbGuard();
    const json = vi.fn((body: unknown, s: number) => ({ body, status: s }) as unknown as Response);
    const c = { var: { db: undefined }, json } as any;
    const next = vi.fn();

    const result = (await guard(c, next)) as unknown as {
      body: { code: string; detail: string; status: number };
    };

    expect(result.body).toMatchObject({
      code: 'DB_NOT_AVAILABLE',
      detail: expect.any(String),
      status: 500,
    });
  });
});

// ── Integration tests with Hono app ───────────────────────

describe('dbGuard integration', () => {
  function createTestApp() {
    const app = new Hono<{
      Bindings: Record<string, unknown>;
      Variables: { db?: DbClient };
    }>();

    app.get('/protected', dbGuard(), (c) => c.json({ ok: true }));

    return app;
  }

  it('blocks request when no db is set on context', async () => {
    const app = createTestApp();
    const res = await app.request('/protected');
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('code', 'DB_NOT_AVAILABLE');
    expect(body).toHaveProperty('detail');
    expect(body).toHaveProperty('status', 500);
  });

  it('allows request when db is set on context via middleware override', async () => {
    // Test that dbGuard passes through when db is present.
    // We simulate by creating a wrapper that sets db before dbGuard.
    const app = new Hono<{
      Bindings: Record<string, unknown>;
      Variables: { db?: DbClient };
    }>();

    app.use('*', async (c, next) => {
      c.set('db', {} as DbClient);
      await next();
    });

    app.get('/protected', dbGuard(), (c) => c.json({ ok: true }));

    const res = await app.request('/protected');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
