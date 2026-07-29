import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';

// ── Mock KV Store ───────────────────────────────────────────

class MockKVStore {
  private store = new Map<string, string>();
  private shouldThrowOnGet = false;
  private shouldThrowOnPut = false;

  throwOnGet(): void {
    this.shouldThrowOnGet = true;
  }

  throwOnPut(): void {
    this.shouldThrowOnPut = true;
  }

  async get(key: string): Promise<string | null> {
    if (this.shouldThrowOnGet) {
      this.shouldThrowOnGet = false;
      throw new Error('Simulated KV get error');
    }
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string, _options?: { expirationTtl?: number }): Promise<void> {
    if (this.shouldThrowOnPut) {
      this.shouldThrowOnPut = false;
      throw new Error('Simulated KV put error');
    }
    this.store.set(key, value);
  }

  /** Pre-populate a key for testing (avoids computing window timestamps). */
  _set(key: string, value: string): void {
    this.store.set(key, value);
  }

  _clear(): void {
    this.store.clear();
  }
}

// ── Test helpers ─────────────────────────────────────────────

const DEVICE_ID = '550e8400-e29b-4a4a-a716-446655440000';

/**
 * Compute the KV key that the middleware will use for a given window.
 * This mirrors buildRateLimitKey() internal to the middleware.
 */
function rateLimitKey(prefix: string, deviceId: string, windowSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  return `rate-limit:${prefix}:${deviceId}:${windowStart}`;
}

// ── The module doesn't exist yet → tests will fail (RED) ──

describe('rateLimit middleware — unit', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('pass-through scenarios', () => {
    it('passes through when no KV binding exists (dev local)', async () => {
      const mod = await import('../../middleware/rate-limit-guard');
      const { rateLimit: rl } = mod;

      const app = new Hono<{ Variables: { deviceId?: string } }>();
      app.use('*', async (c, next) => {
        const did = c.req.header('X-Device-Id');
        if (did) c.set('deviceId', did);
        await next();
      });
      app.get('/test', rl() as MiddlewareHandler<any>, (c) => c.json({ ok: true }));

      const res = await app.request('/test', {
        headers: { 'X-Device-Id': DEVICE_ID },
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });

    it('passes through when RATE_LIMITING_ENABLED is false', async () => {
      const mod = await import('../../middleware/rate-limit-guard');
      const { rateLimit: rl } = mod;

      const kv = new MockKVStore();
      const app = new Hono<{
        Bindings: { RATE_LIMIT_STORE: MockKVStore; RATE_LIMITING_ENABLED: string };
        Variables: { deviceId?: string };
      }>();
      app.use('*', async (c, next) => {
        const did = c.req.header('X-Device-Id');
        if (did) c.set('deviceId', did);
        await next();
      });
      app.get('/test', rl() as MiddlewareHandler<any>, (c) => c.json({ ok: true }));

      const res = await app.request(
        '/test',
        { headers: { 'X-Device-Id': DEVICE_ID } },
        { RATE_LIMIT_STORE: kv, RATE_LIMITING_ENABLED: 'false' },
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });

    it('passes through when per-endpoint rate limiting is disabled', async () => {
      const mod = await import('../../middleware/rate-limit-guard');
      const { rateLimit: rl } = mod;

      const kv = new MockKVStore();
      const app = new Hono<{
        Bindings: { RATE_LIMIT_STORE: MockKVStore };
        Variables: { deviceId?: string };
      }>();
      app.use('*', async (c, next) => {
        const did = c.req.header('X-Device-Id');
        if (did) c.set('deviceId', did);
        await next();
      });
      app.get('/test', rl({ enabled: false }) as MiddlewareHandler<any>, (c) =>
        c.json({ ok: true }),
      );

      const res = await app.request(
        '/test',
        { headers: { 'X-Device-Id': DEVICE_ID } },
        { RATE_LIMIT_STORE: kv },
      );
      expect(res.status).toBe(200);
    });
  });

  describe('rate limit enforcement', () => {
    it('allows requests under the limit and sets rate limit headers', async () => {
      const mod = await import('../../middleware/rate-limit-guard');
      const { rateLimit: rl } = mod;

      const kv = new MockKVStore();
      const app = new Hono<{
        Bindings: { RATE_LIMIT_STORE: MockKVStore };
        Variables: { deviceId?: string };
      }>();
      app.use('*', async (c, next) => {
        const did = c.req.header('X-Device-Id');
        if (did) c.set('deviceId', did);
        await next();
      });
      app.get(
        '/test',
        rl({ limit: 10, windowSeconds: 60, keyPrefix: 'test' }) as MiddlewareHandler<any>,
        (c) => c.json({ ok: true }),
      );

      const res = await app.request(
        '/test',
        { headers: { 'X-Device-Id': DEVICE_ID } },
        { RATE_LIMIT_STORE: kv },
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
      // First request: count 0, limit 10 → remaining after increment = 10 - 0 - 1 = 9
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('9');
      expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy();
      expect(res.headers.get('Retry-After')).toBeNull();
    });

    it('decrements remaining across consecutive requests', async () => {
      const mod = await import('../../middleware/rate-limit-guard');
      const { rateLimit: rl } = mod;

      const kv = new MockKVStore();
      const app = new Hono<{
        Bindings: { RATE_LIMIT_STORE: MockKVStore };
        Variables: { deviceId?: string };
      }>();
      app.use('*', async (c, next) => {
        const did = c.req.header('X-Device-Id');
        if (did) c.set('deviceId', did);
        await next();
      });
      app.get(
        '/test',
        rl({ limit: 10, windowSeconds: 60, keyPrefix: 'test' }) as MiddlewareHandler<any>,
        (c) => c.json({ ok: true }),
      );

      // 1st request → remaining 9
      let res = await app.request(
        '/test',
        { headers: { 'X-Device-Id': DEVICE_ID } },
        { RATE_LIMIT_STORE: kv },
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('9');

      // 2nd request → remaining 8
      res = await app.request(
        '/test',
        { headers: { 'X-Device-Id': DEVICE_ID } },
        { RATE_LIMIT_STORE: kv },
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('8');

      // 3rd request → remaining 7
      res = await app.request(
        '/test',
        { headers: { 'X-Device-Id': DEVICE_ID } },
        { RATE_LIMIT_STORE: kv },
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('7');
    });

    it('returns 429 when count reaches the limit', async () => {
      const mod = await import('../../middleware/rate-limit-guard');
      const { rateLimit: rl } = mod;

      const kv = new MockKVStore();
      const app = new Hono<{
        Bindings: { RATE_LIMIT_STORE: MockKVStore };
        Variables: { deviceId?: string };
      }>();
      app.use('*', async (c, next) => {
        const did = c.req.header('X-Device-Id');
        if (did) c.set('deviceId', did);
        await next();
      });
      app.get(
        '/test',
        rl({ limit: 3, windowSeconds: 60, keyPrefix: 'test' }) as MiddlewareHandler<any>,
        (c) => c.json({ ok: true }),
      );

      // Send 3 allowed requests
      for (let i = 0; i < 3; i++) {
        const r = await app.request(
          '/test',
          { headers: { 'X-Device-Id': DEVICE_ID } },
          { RATE_LIMIT_STORE: kv },
        );
        expect(r.status).toBe(200);
      }

      // 4th request should be 429
      const res = await app.request(
        '/test',
        { headers: { 'X-Device-Id': DEVICE_ID } },
        { RATE_LIMIT_STORE: kv },
      );

      expect(res.status).toBe(429);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body).toMatchObject({
        code: 'RATE_LIMIT_EXCEEDED',
        detail: 'Too many requests. Please try again later.',
        status: 429,
      });
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(res.headers.get('Retry-After')).toBeTruthy();
      expect(res.headers.get('X-RateLimit-Limit')).toBe('3');
      expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy();
    });

    it('returns 429 when pre-populated count is at the limit', async () => {
      const mod = await import('../../middleware/rate-limit-guard');
      const { rateLimit: rl } = mod;

      const kv = new MockKVStore();
      // Pre-populate KV with count=10 (at limit of 10)
      const key = rateLimitKey('test', DEVICE_ID, 60);
      kv._set(key, '10');

      const app = new Hono<{
        Bindings: { RATE_LIMIT_STORE: MockKVStore };
        Variables: { deviceId?: string };
      }>();
      app.use('*', async (c, next) => {
        const did = c.req.header('X-Device-Id');
        if (did) c.set('deviceId', did);
        await next();
      });
      app.get(
        '/test',
        rl({ limit: 10, windowSeconds: 60, keyPrefix: 'test' }) as MiddlewareHandler<any>,
        (c) => c.json({ ok: true }),
      );

      const res = await app.request(
        '/test',
        { headers: { 'X-Device-Id': DEVICE_ID } },
        { RATE_LIMIT_STORE: kv },
      );
      expect(res.status).toBe(429);
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
    });

    it('returns 429 when count is over the limit', async () => {
      const mod = await import('../../middleware/rate-limit-guard');
      const { rateLimit: rl } = mod;

      const kv = new MockKVStore();
      const key = rateLimitKey('test', DEVICE_ID, 60);
      kv._set(key, '15'); // Over limit of 10

      const app = new Hono<{
        Bindings: { RATE_LIMIT_STORE: MockKVStore };
        Variables: { deviceId?: string };
      }>();
      app.use('*', async (c, next) => {
        const did = c.req.header('X-Device-Id');
        if (did) c.set('deviceId', did);
        await next();
      });
      app.get(
        '/test',
        rl({ limit: 10, windowSeconds: 60, keyPrefix: 'test' }) as MiddlewareHandler<any>,
        (c) => c.json({ ok: true }),
      );

      const res = await app.request(
        '/test',
        { headers: { 'X-Device-Id': DEVICE_ID } },
        { RATE_LIMIT_STORE: kv },
      );
      expect(res.status).toBe(429);
    });
  });

  describe('fail-closed behavior', () => {
    it('returns 429 when KV get throws', async () => {
      const mod = await import('../../middleware/rate-limit-guard');
      const { rateLimit: rl } = mod;

      const kv = new MockKVStore();
      kv.throwOnGet();

      const app = new Hono<{
        Bindings: { RATE_LIMIT_STORE: MockKVStore };
        Variables: { deviceId?: string };
      }>();
      app.use('*', async (c, next) => {
        const did = c.req.header('X-Device-Id');
        if (did) c.set('deviceId', did);
        await next();
      });
      app.get('/test', rl() as MiddlewareHandler<any>, (c) => c.json({ ok: true }));

      const res = await app.request(
        '/test',
        { headers: { 'X-Device-Id': DEVICE_ID } },
        { RATE_LIMIT_STORE: kv },
      );
      expect(res.status).toBe(429);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.detail).toBe('Service temporarily unavailable. Please try again later.');
      expect(res.headers.get('Retry-After')).toBeTruthy();
    });

    it('returns 429 when KV put throws', async () => {
      const mod = await import('../../middleware/rate-limit-guard');
      const { rateLimit: rl } = mod;

      const kv = new MockKVStore();
      // First request should work (get returns null, then put throws)
      kv.throwOnPut();

      const app = new Hono<{
        Bindings: { RATE_LIMIT_STORE: MockKVStore };
        Variables: { deviceId?: string };
      }>();
      app.use('*', async (c, next) => {
        const did = c.req.header('X-Device-Id');
        if (did) c.set('deviceId', did);
        await next();
      });
      app.get('/test', rl() as MiddlewareHandler<any>, (c) => c.json({ ok: true }));

      const res = await app.request(
        '/test',
        { headers: { 'X-Device-Id': DEVICE_ID } },
        { RATE_LIMIT_STORE: kv },
      );
      expect(res.status).toBe(429);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.detail).toBe('Service temporarily unavailable. Please try again later.');
    });
  });

  describe('counter isolation', () => {
    it('uses independent counters for different device IDs', async () => {
      const mod = await import('../../middleware/rate-limit-guard');
      const { rateLimit: rl } = mod;

      const kv = new MockKVStore();
      const deviceA = '550e8400-e29b-4a4a-a716-446655440001';
      const deviceB = '550e8400-e29b-4a4a-a716-446655440002';

      // Pre-populate deviceA at limit, deviceB at 0
      const keyA = rateLimitKey('test', deviceA, 60);
      kv._set(keyA, '10');

      const app = new Hono<{
        Bindings: { RATE_LIMIT_STORE: MockKVStore };
        Variables: { deviceId?: string };
      }>();
      app.use('*', async (c, next) => {
        const did = c.req.header('X-Device-Id');
        if (did) c.set('deviceId', did);
        await next();
      });
      app.get(
        '/test',
        rl({ limit: 10, windowSeconds: 60, keyPrefix: 'test' }) as MiddlewareHandler<any>,
        (c) => c.json({ ok: true }),
      );

      // Device A → 429
      let res = await app.request(
        '/test',
        { headers: { 'X-Device-Id': deviceA } },
        { RATE_LIMIT_STORE: kv },
      );
      expect(res.status).toBe(429);

      // Device B → 200
      res = await app.request(
        '/test',
        { headers: { 'X-Device-Id': deviceB } },
        { RATE_LIMIT_STORE: kv },
      );
      expect(res.status).toBe(200);
    });

    it('uses independent counters for different key prefixes', async () => {
      const mod = await import('../../middleware/rate-limit-guard');
      const { rateLimit: rl } = mod;

      const kv = new MockKVStore();

      // Pre-populate prefix "route-a" at limit, "route-b" at 0
      const keyA = rateLimitKey('route-a', DEVICE_ID, 60);
      kv._set(keyA, '10');

      const app = new Hono<{
        Bindings: { RATE_LIMIT_STORE: MockKVStore };
        Variables: { deviceId?: string };
      }>();
      app.use('*', async (c, next) => {
        const did = c.req.header('X-Device-Id');
        if (did) c.set('deviceId', did);
        await next();
      });

      // Two different routes with different prefixes
      const mwA = rl({
        limit: 10,
        windowSeconds: 60,
        keyPrefix: 'route-a',
      }) as MiddlewareHandler<any>;
      const mwB = rl({
        limit: 10,
        windowSeconds: 60,
        keyPrefix: 'route-b',
      }) as MiddlewareHandler<any>;

      app.get('/route-a', mwA, (c) => c.json({ ok: true }));
      app.get('/route-b', mwB, (c) => c.json({ ok: true }));

      // Route A → 429
      let res = await app.request(
        '/route-a',
        { headers: { 'X-Device-Id': DEVICE_ID } },
        { RATE_LIMIT_STORE: kv },
      );
      expect(res.status).toBe(429);

      // Route B → 200
      res = await app.request(
        '/route-b',
        { headers: { 'X-Device-Id': DEVICE_ID } },
        { RATE_LIMIT_STORE: kv },
      );
      expect(res.status).toBe(200);
    });

    it('uses "anon" when no deviceId is set', async () => {
      const mod = await import('../../middleware/rate-limit-guard');
      const { rateLimit: rl } = mod;

      const kv = new MockKVStore();
      const key = rateLimitKey('test', 'anon', 60);
      kv._set(key, '10');

      const app = new Hono<{
        Bindings: { RATE_LIMIT_STORE: MockKVStore };
        Variables: { deviceId?: string };
      }>();
      // No inject-device-id stub → deviceId stays undefined
      app.get(
        '/test',
        rl({ limit: 10, windowSeconds: 60, keyPrefix: 'test' }) as MiddlewareHandler<any>,
        (c) => c.json({ ok: true }),
      );

      const res = await app.request('/test', {}, { RATE_LIMIT_STORE: kv });
      expect(res.status).toBe(429);
    });
  });

  describe('default config (no arguments)', () => {
    it('applies global defaults when called with no arguments', async () => {
      const mod = await import('../../middleware/rate-limit-guard');
      const { rateLimit: rl } = mod;

      const kv = new MockKVStore();
      const app = new Hono<{
        Bindings: { RATE_LIMIT_STORE: MockKVStore };
        Variables: { deviceId?: string };
      }>();
      app.use('*', async (c, next) => {
        const did = c.req.header('X-Device-Id');
        if (did) c.set('deviceId', did);
        await next();
      });
      app.get('/test', rl() as MiddlewareHandler<any>, (c) => c.json({ ok: true }));

      // Default limit is 30, window 60s
      const res = await app.request(
        '/test',
        { headers: { 'X-Device-Id': DEVICE_ID } },
        { RATE_LIMIT_STORE: kv },
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('X-RateLimit-Limit')).toBe('30');
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('29');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Stress / Concurrent tests
  // ═══════════════════════════════════════════════════════════════

  describe('rateLimit middleware — stress (concurrent race)', () => {
    /**
     * Async mock KV store that simulates real KV latency.
     * Each get/put has a random delay (configurable range).
     * This creates a realistic race window between read and write.
     *
     * KV in production is a network call with 5-100ms latency,
     * so concurrent requests can overlap in the get→check→put window.
     */
    class AsyncMockKVStore {
      private store = new Map<string, string>();
      private readonly minDelay: number;
      private readonly maxDelay: number;

      constructor(minDelay = 5, maxDelay = 15) {
        this.minDelay = minDelay;
        this.maxDelay = maxDelay;
      }

      private async delay(): Promise<void> {
        const ms = this.minDelay + Math.random() * (this.maxDelay - this.minDelay);
        return new Promise((r) => setTimeout(r, ms));
      }

      async get(key: string): Promise<string | null> {
        await this.delay();
        return this.store.get(key) ?? null;
      }

      async put(key: string, value: string, _options?: { expirationTtl?: number }): Promise<void> {
        await this.delay();
        this.store.set(key, value);
      }

      _set(key: string, value: string): void {
        this.store.set(key, value);
      }

      _clear(): void {
        this.store.clear();
      }
    }

    /**
     * Race mock KV store that holds the FIRST put() until releasePut()
     * is called. This deterministically reproduces the get-then-put race:
     * request A reads count=0, starts writing; request B reads count=0
     * (before A's write completes); both increment independently.
     */
    class RaceMockKVStore {
      private store = new Map<string, string>();
      private heldPut: (() => void) | null = null;
      private heldPutPromise: Promise<void> | null = null;
      private putsCalled = 0;

      /** Hold the next put() call until releasePut(). */
      holdFirstPut(): void {
        this.heldPutPromise = new Promise((resolve) => {
          this.heldPut = resolve;
        });
      }

      /** Release the held put() call so it completes. */
      releasePut(): void {
        this.heldPut?.();
        this.heldPut = null;
        this.heldPutPromise = null;
      }

      get putCount(): number {
        return this.putsCalled;
      }

      async get(key: string): Promise<string | null> {
        return this.store.get(key) ?? null;
      }

      async put(key: string, value: string, _options?: { expirationTtl?: number }): Promise<void> {
        this.putsCalled++;
        // Hold BEFORE writing so request B reads the OLD count
        if (this.putsCalled === 1 && this.heldPutPromise) {
          await this.heldPutPromise;
        }
        this.store.set(key, value);
      }

      _set(key: string, value: string): void {
        this.store.set(key, value);
      }

      _clear(): void {
        this.store.clear();
      }
    }

    describe('burst — async KV with latency', () => {
      it('allows all requests through with different device IDs (independent counters)', async () => {
        const mod = await import('../../middleware/rate-limit-guard');
        const { rateLimit: rl } = mod;

        const kv = new AsyncMockKVStore(5, 15);
        const LIMIT = 10;
        const BURST = 50;

        const app = new Hono<{
          Bindings: { RATE_LIMIT_STORE: AsyncMockKVStore };
          Variables: { deviceId?: string };
        }>();
        app.use('*', async (c, next) => {
          const did = c.req.header('X-Device-Id');
          if (did) c.set('deviceId', did);
          await next();
        });
        app.get(
          '/test',
          rl({ limit: LIMIT, windowSeconds: 60, keyPrefix: 'stress' }) as MiddlewareHandler<any>,
          (c) => c.json({ ok: true }),
        );

        const results = await Promise.all(
          Array.from({ length: BURST }, (_, i) =>
            app.request(
              '/test',
              { headers: { 'X-Device-Id': `stress-device-${i}` } },
              { RATE_LIMIT_STORE: kv },
            ),
          ),
        );

        const passed = results.filter((r) => r.status === 200).length;
        const blocked = results.filter((r) => r.status === 429).length;

        expect(passed).toBe(BURST);
        expect(blocked).toBe(0);
      });

      it('may exceed limit for the same device under concurrent burst (known race)', async () => {
        const mod = await import('../../middleware/rate-limit-guard');
        const { rateLimit: rl } = mod;

        const kv = new AsyncMockKVStore(3, 10);
        const LIMIT = 10;
        const BURST = 50;

        const app = new Hono<{
          Bindings: { RATE_LIMIT_STORE: AsyncMockKVStore };
          Variables: { deviceId?: string };
        }>();
        app.use('*', async (c, next) => {
          const did = c.req.header('X-Device-Id');
          if (did) c.set('deviceId', did);
          await next();
        });
        app.get(
          '/test',
          rl({ limit: LIMIT, windowSeconds: 60, keyPrefix: 'stress' }) as MiddlewareHandler<any>,
          (c) => c.json({ ok: true }),
        );

        const results = await Promise.all(
          Array.from({ length: BURST }, () =>
            app.request(
              '/test',
              { headers: { 'X-Device-Id': DEVICE_ID } },
              { RATE_LIMIT_STORE: kv },
            ),
          ),
        );

        const passed = results.filter((r) => r.status === 200).length;
        const blocked = results.filter((r) => r.status === 429).length;

        // With async latency, some requests overlap in the get-put window.
        // The count after burst may exceed LIMIT — this documents the known
        // limitation of KV's non-atomic get-then-put pattern.
        expect(passed).toBeGreaterThanOrEqual(1);
        expect(passed + blocked).toBe(BURST);
        console.warn(
          `[stress/async] limit=${LIMIT} burst=${BURST}: ${passed} passed, ${blocked} blocked` +
            ` (overrun: ${Math.max(0, passed - LIMIT)})`,
        );
      });

      it('isolates concurrent bursts across different device IDs', async () => {
        const mod = await import('../../middleware/rate-limit-guard');
        const { rateLimit: rl } = mod;

        const kv = new AsyncMockKVStore(3, 8);
        const LIMIT = 10;
        const DEVICES = 5;
        const REQS_PER_DEVICE = 15;

        const app = new Hono<{
          Bindings: { RATE_LIMIT_STORE: AsyncMockKVStore };
          Variables: { deviceId?: string };
        }>();
        app.use('*', async (c, next) => {
          const did = c.req.header('X-Device-Id');
          if (did) c.set('deviceId', did);
          await next();
        });
        app.get(
          '/test',
          rl({ limit: LIMIT, windowSeconds: 60, keyPrefix: 'stress' }) as MiddlewareHandler<any>,
          (c) => c.json({ ok: true }),
        );

        const results = await Promise.all(
          Array.from({ length: DEVICES * REQS_PER_DEVICE }, (_, i) => {
            const deviceIndex = Math.floor(i / REQS_PER_DEVICE);
            return app.request(
              '/test',
              { headers: { 'X-Device-Id': `device-${deviceIndex}` } },
              { RATE_LIMIT_STORE: kv },
            );
          }),
        );

        const passed = results.filter((r) => r.status === 200).length;
        const blocked = results.filter((r) => r.status === 429).length;

        expect(passed).toBeGreaterThanOrEqual(1);
        expect(passed + blocked).toBe(DEVICES * REQS_PER_DEVICE);
        console.warn(
          `[stress/isolated] ${DEVICES} devices x ${REQS_PER_DEVICE} reqs, limit ${LIMIT}:` +
            ` ${passed} passed, ${blocked} blocked`,
        );
      });
    });

    describe('controlled race — stalling KV get', () => {
      /**
       * PROVES the atomicity gap: request A reads count=0, holds put()
       * while request B also reads count=0. Both see count before either
       * writes, so both pass through — exceeding the limit.
       *
       * RaceMockKVStore holds the FIRST put() via holdFirstPut().
       * While it's held, request B's get() returns the SAME count (null)
       * because A's write hasn't happened yet.
       */
      it('proves the get-then-put race: two concurrent requests can exceed limit', async () => {
        const mod = await import('../../middleware/rate-limit-guard');
        const { rateLimit: rl } = mod;

        const kv = new RaceMockKVStore();
        kv.holdFirstPut();
        const LIMIT = 1;

        const app = new Hono<{
          Bindings: { RATE_LIMIT_STORE: RaceMockKVStore };
          Variables: { deviceId?: string };
        }>();
        app.use('*', async (c, next) => {
          const did = c.req.header('X-Device-Id');
          if (did) c.set('deviceId', did);
          await next();
        });
        app.get(
          '/test',
          rl({ limit: LIMIT, windowSeconds: 60, keyPrefix: 'race' }) as MiddlewareHandler<any>,
          (c) => c.json({ ok: true }),
        );

        // Fire request A — reads count=0, passes check, starts put() (held)
        const res1Promise = app.request(
          '/test',
          { headers: { 'X-Device-Id': DEVICE_ID } },
          { RATE_LIMIT_STORE: kv },
        );

        // Small delay so A reliably enters put() before B calls get()
        await new Promise((r) => setTimeout(r, 20));

        // Request B — reads count=0 (A's write hasn't completed yet)
        const res2 = await app.request(
          '/test',
          { headers: { 'X-Device-Id': DEVICE_ID } },
          { RATE_LIMIT_STORE: kv },
        );

        // B also sees count=0 and passes through
        expect(res2.status).toBe(200);

        // Now release A's held put so it can complete
        kv.releasePut();

        const res1 = await res1Promise;
        expect(res1.status).toBe(200);
      });

      it('respects limit when requests are sequential (no race)', async () => {
        const mod = await import('../../middleware/rate-limit-guard');
        const { rateLimit: rl } = mod;

        const kv = new RaceMockKVStore();
        const LIMIT = 1;

        const app = new Hono<{
          Bindings: { RATE_LIMIT_STORE: RaceMockKVStore };
          Variables: { deviceId?: string };
        }>();
        app.use('*', async (c, next) => {
          const did = c.req.header('X-Device-Id');
          if (did) c.set('deviceId', did);
          await next();
        });
        app.get(
          '/test',
          rl({ limit: LIMIT, windowSeconds: 60, keyPrefix: 'race' }) as MiddlewareHandler<any>,
          (c) => c.json({ ok: true }),
        );

        // Sequential: second request AFTER first completes its put()
        const res1 = await app.request(
          '/test',
          { headers: { 'X-Device-Id': DEVICE_ID } },
          { RATE_LIMIT_STORE: kv },
        );
        const res2 = await app.request(
          '/test',
          { headers: { 'X-Device-Id': DEVICE_ID } },
          { RATE_LIMIT_STORE: kv },
        );

        expect(res1.status).toBe(200);
        expect(res2.status).toBe(429);
      });
    });
  });
});
