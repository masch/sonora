import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import app, { setDbClient } from '../index';
import { createPaymentProviders } from '../payments';

vi.mock('../payments', () => ({
  createPaymentProviders: vi.fn(),
}));

// ── Mock KV Store ───────────────────────────────────────────

class MockKVStore {
  private store = new Map<string, string>();
  private shouldThrowOnGet = false;

  throwOnGet(): void {
    this.shouldThrowOnGet = true;
  }

  async get(key: string): Promise<string | null> {
    if (this.shouldThrowOnGet) {
      this.shouldThrowOnGet = false;
      throw new Error('KV error');
    }
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string, _options?: { expirationTtl?: number }): Promise<void> {
    this.store.set(key, value);
  }

  _set(key: string, value: string): void {
    this.store.set(key, value);
  }

  _clear(): void {
    this.store.clear();
  }
}

// ── Helpers ─────────────────────────────────────────────────

const VALID_UUID = '550e8400-e29b-4a4a-a716-446655440000';
const EXPERIENCE_ID = '660e8400-e29b-4a4a-a716-446655440000';

/**
 * Compute the KV key the middleware would use for a given prefix/deviceId.
 *
 * NOTE: injectDeviceId() now passes through the raw X-Device-Id header value
 * (no SHA-256 hashing). c.var.deviceId is the raw value.
 */
async function rateLimitKey(
  prefix: string,
  rawDeviceId: string,
  windowSeconds: number,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  return `rate-limit:${prefix}:${rawDeviceId}:${windowStart}`;
}

describe('Full middleware chain — POST /payments/create with rate limiting', () => {
  let mockProvider: any;
  let mockDb: any;
  let kv: MockKVStore;

  beforeEach(() => {
    vi.clearAllMocks();
    setDbClient(null);
    kv = new MockKVStore();

    mockProvider = {
      createCheckout: vi.fn().mockResolvedValue({
        checkoutUrl: 'https://sandbox.mercadopago.com/checkout/123',
        providerPaymentId: 'mp-pref-12345',
      }),
      getPaymentStatus: vi.fn(),
      processWebhook: vi.fn(),
    };

    (createPaymentProviders as any).mockReturnValue({
      mercadopago: mockProvider,
    });

    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    setDbClient(null);
  });

  it('passes through when no KV binding is present (dev local)', async () => {
    mockDb.limit.mockResolvedValue([{ id: EXPERIENCE_ID, free: false, price: 15000 }]);
    mockDb.returning.mockResolvedValue([{ id: 'purchase-999' }]);
    setDbClient(mockDb);

    // No RATE_LIMIT_STORE in env → rate limiting should pass through
    const res = await app.request(
      '/payments/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': VALID_UUID,
          'X-Device-Platform': 'ios',
        },
        body: JSON.stringify({
          experienceId: EXPERIENCE_ID,
          redirectUrl: 'https://sonora.app/callback',
        }),
      },
      {},
    );

    // Should proceed past rate limiting (no KV → pass through) → eventually fail on payment provider
    // Since we mocked createPaymentProviders, the payment provider IS available
    expect(res.status).toBe(200);
  });

  it('returns rate limit headers on successful requests through the full chain', async () => {
    mockDb.limit.mockResolvedValue([{ id: EXPERIENCE_ID, free: false, price: 15000 }]);
    mockDb.returning.mockResolvedValue([{ id: 'purchase-999' }]);
    setDbClient(mockDb);

    const res = await app.request(
      '/payments/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': VALID_UUID,
          'X-Device-Platform': 'ios',
        },
        body: JSON.stringify({
          experienceId: EXPERIENCE_ID,
          redirectUrl: 'https://sonora.app/callback',
        }),
      },
      { RATE_LIMIT_STORE: kv },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('9');
    expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy();
  });

  it('blocks requests after the payment rate limit is exceeded', async () => {
    mockDb.limit.mockResolvedValue([{ id: EXPERIENCE_ID, free: false, price: 15000 }]);
    mockDb.returning.mockResolvedValue([{ id: 'purchase-999' }]);
    setDbClient(mockDb);

    // Pre-populate KV with 10 requests for this route+device
    kv._clear();
    const key = await rateLimitKey('payments:create', VALID_UUID, 60);
    kv._set(key, '10');

    // 11th request should be 429
    const res = await app.request(
      '/payments/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': VALID_UUID,
          'X-Device-Platform': 'ios',
        },
        body: JSON.stringify({ experienceId: EXPERIENCE_ID }),
      },
      { RATE_LIMIT_STORE: kv },
    );

    expect(res.status).toBe(429);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
    });
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });

  it('preserves existing middleware behavior (DEVICE_ID_REQUIRED still works)', async () => {
    mockDb.limit.mockResolvedValue([{ id: EXPERIENCE_ID, free: false, price: 15000 }]);
    mockDb.returning.mockResolvedValue([{ id: 'purchase-999' }]);
    setDbClient(mockDb);

    const res = await app.request(
      '/payments/create',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experienceId: EXPERIENCE_ID }),
      },
      { RATE_LIMIT_STORE: kv },
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.code).toBe('DEVICE_ID_REQUIRED');
  });
});
