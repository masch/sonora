import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../index';

// ── Global defaults ──────────────────────────────────────────

const GLOBAL_DEFAULTS = {
  limit: 30,
  windowSeconds: 60,
  enabled: true,
} as const;

// ── Per-endpoint config (all optional) ──────────────────────

export interface RateLimitConfig {
  limit?: number;
  windowSeconds?: number;
  enabled?: boolean;
  keyPrefix?: string;
}

// ── Named per-route defaults ────────────────────────────────

export const RATE_LIMIT_DEFAULTS = {
  PAYMENTS_CREATE: { limit: 10, windowSeconds: 60, keyPrefix: 'payments:create' },
  EXPERIENCES_ACCESS: { limit: 20, windowSeconds: 60, keyPrefix: 'experiences:access' },
  EXPERIENCES_LIST: { limit: 30, windowSeconds: 60, keyPrefix: 'experiences:list' },
} as const;

// ── Internal helpers ─────────────────────────────────────────

/**
 * Build a KV key for the rate limit counter.
 * Pattern: rate-limit:{prefix}:{deviceId}:{windowStart}
 */
function buildRateLimitKey(prefix: string, deviceId: string, windowStart: number): string {
  return `rate-limit:${prefix}:${deviceId}:${windowStart}`;
}

// ── Middleware ────────────────────────────────────────────────

/**
 * KV-backed rate limiting middleware for Hono.
 *
 * Resolution order (highest priority first):
 *   1. c.env.RATE_LIMITING_ENABLED === 'false' → global kill switch
 *   2. No KV binding → pass through (dev local)
 *   3. config.enabled === false → endpoint-specific disable
 *   4. config.limit ?? global default → effective limit
 *   5. config.windowSeconds ?? global default → effective window
 *
 * Usage:
 *   rateLimit()                                    → 30 req / 60s
 *   rateLimit({ limit: 5 })                        → 5 req / 60s
 *   rateLimit({ limit: 10, windowSeconds: 30 })    → 10 req / 30s
 *   rateLimit({ enabled: false })                  → endpoint without rate limiting
 *   rateLimit(RATE_LIMIT_DEFAULTS.PAYMENTS_CREATE) → 10 req / 60s, payments prefix
 */
export const rateLimit = (
  config?: RateLimitConfig,
): MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> => {
  return async (c, next) => {
    // 1. Global kill switch
    if (c.env?.RATE_LIMITING_ENABLED === 'false') {
      await next();
      return;
    }

    // 2. No KV binding → pass through (dev local)
    const kv = c.env?.RATE_LIMIT_STORE;
    if (!kv) {
      await next();
      return;
    }

    // 3. Resolve effective config
    const effective = {
      limit: config?.limit ?? GLOBAL_DEFAULTS.limit,
      windowSeconds: config?.windowSeconds ?? GLOBAL_DEFAULTS.windowSeconds,
      enabled: config?.enabled ?? GLOBAL_DEFAULTS.enabled,
      keyPrefix: config?.keyPrefix ?? 'default',
    };

    // 4. Per-endpoint disable
    if (!effective.enabled) {
      await next();
      return;
    }

    // 5. Build KV key
    const deviceId = c.var.deviceId || 'anon';
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const windowStart =
      Math.floor(nowInSeconds / effective.windowSeconds) * effective.windowSeconds;
    const key = buildRateLimitKey(effective.keyPrefix, deviceId, windowStart);
    const resetTime = windowStart + effective.windowSeconds;

    // 6. Get counter from KV
    let count: number;
    try {
      const val = await kv.get(key);
      count = val ? parseInt(val, 10) : 0;
    } catch {
      // Fail-closed on KV get error
      return c.json(
        {
          code: 'RATE_LIMIT_EXCEEDED',
          detail: 'Service temporarily unavailable. Please try again later.',
          status: 429,
        },
        429,
        {
          'Retry-After': String(effective.windowSeconds),
          'X-RateLimit-Limit': String(effective.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(resetTime),
        },
      );
    }

    // 7. Check limit
    const remaining = Math.max(0, effective.limit - count);

    if (count >= effective.limit) {
      // Rate limit hit — return 429
      return c.json(
        {
          code: 'RATE_LIMIT_EXCEEDED',
          detail: 'Too many requests. Please try again later.',
          status: 429,
        },
        429,
        {
          'Retry-After': String(resetTime - nowInSeconds),
          'X-RateLimit-Limit': String(effective.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(resetTime),
        },
      );
    }

    // 8. Increment counter (pass through)
    try {
      await kv.put(key, String(count + 1), { expirationTtl: effective.windowSeconds + 5 });
    } catch {
      // Fail-closed on KV put error
      return c.json(
        {
          code: 'RATE_LIMIT_EXCEEDED',
          detail: 'Service temporarily unavailable. Please try again later.',
          status: 429,
        },
        429,
        {
          'Retry-After': String(effective.windowSeconds),
          'X-RateLimit-Limit': String(effective.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(resetTime),
        },
      );
    }

    // 9. Set rate limit headers and continue
    c.header('X-RateLimit-Limit', String(effective.limit));
    c.header('X-RateLimit-Remaining', String(remaining - 1));
    c.header('X-RateLimit-Reset', String(resetTime));
    await next();
  };
};
