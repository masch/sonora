import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import app, { setDbClient } from '../index';
import { createPaymentProviders } from '../payments';
import { logger, PURCHASE_STATUSES, type PurchaseStatus } from '@sonora/shared';
import { mapWebhookEventToStatus } from '../routes/payments';

vi.mock('../payments', () => ({
  createPaymentProviders: vi.fn(),
}));

describe('mapWebhookEventToStatus', () => {
  it('maps approved to approved', () => {
    expect(mapWebhookEventToStatus('approved')).toBe('approved');
  });

  it('maps refunded to refunded', () => {
    expect(mapWebhookEventToStatus('refunded')).toBe('refunded');
  });

  it('maps rejected to rejected', () => {
    expect(mapWebhookEventToStatus('rejected')).toBe('rejected');
  });

  it('maps pending to pending', () => {
    expect(mapWebhookEventToStatus('pending')).toBe('pending');
  });

  it('is exhaustive over all PurchaseStatus values', () => {
    for (const status of PURCHASE_STATUSES) {
      const result = mapWebhookEventToStatus(status as PurchaseStatus);
      expect(['approved', 'rejected', 'refunded', 'pending']).toContain(result);
    }
  });
});

describe('POST /payments/create', () => {
  let mockProvider: any;
  let mockDb: any;

  it('returns 400 DEVICE_ID_REQUIRED when X-Device-Id header is missing', async () => {
    mockDb.limit.mockResolvedValue([
      { id: '550e8400-e29b-4a4a-a716-446655440000', free: false, price: 15000 },
    ]);
    mockDb.returning.mockResolvedValue([{ id: 'purchase-999' }]);
    setDbClient(mockDb);

    const res = await app.request(
      '/payments/create',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experienceId: '550e8400-e29b-4a4a-a716-446655440000' }),
      },
      {},
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string; detail: string; status: number };
    expect(body.code).toBe('DEVICE_ID_REQUIRED');
    expect(body.detail).toBe('The X-Device-Id header is required.');
    expect(body.status).toBe(400);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    setDbClient(null);

    // Mock payment provider
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

    // Mock DB client
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

  it('returns 404 when experience is not found', async () => {
    mockDb.limit.mockResolvedValue([]); // Experience not found
    setDbClient(mockDb);

    const res = await app.request(
      '/payments/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': '550e8400-e29b-4a4a-a716-446655440000',
          'X-Device-Platform': 'ios',
        },
        body: JSON.stringify({ experienceId: '00000000-0000-0000-0000-000000000000' }),
      },
      {},
    );

    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('code', 'EXPERIENCE_NOT_FOUND');
    expect(body).toHaveProperty('detail', 'The experience was not found.');
    expect(body).toHaveProperty('status', 404);
  });

  it('returns 400 when experience is free', async () => {
    mockDb.limit.mockResolvedValue([{ id: '550e8400-e29b-41d4-a716-446655440000', free: true }]);
    setDbClient(mockDb);

    const res = await app.request(
      '/payments/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': '550e8400-e29b-4a4a-a716-446655440000',
          'X-Device-Platform': 'ios',
        },
        body: JSON.stringify({ experienceId: '550e8400-e29b-41d4-a716-446655440000' }),
      },
      {},
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('code', 'EXPERIENCE_IS_FREE');
    expect(body).toHaveProperty('detail', 'This experience is free.');
    expect(body).toHaveProperty('status', 400);
  });

  it('returns 400 when experience has no price set', async () => {
    mockDb.limit.mockResolvedValue([
      { id: '550e8400-e29b-41d4-a716-446655440000', free: false, price: null },
    ]);
    setDbClient(mockDb);

    const res = await app.request(
      '/payments/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': '550e8400-e29b-4a4a-a716-446655440000',
          'X-Device-Platform': 'ios',
        },
        body: JSON.stringify({ experienceId: '550e8400-e29b-41d4-a716-446655440000' }),
      },
      {},
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('code', 'NO_PRICE_SET');
    expect(body).toHaveProperty('detail', 'This experience has no price set.');
    expect(body).toHaveProperty('status', 400);
  });

  it('successfully creates checkout, generates unique placeholder ID, and updates DB', async () => {
    const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
    const experienceMock = { id: VALID_UUID, title: 'Amazing Trip', free: false, price: 15000 };
    mockDb.limit.mockResolvedValue([experienceMock]);
    mockDb.returning.mockResolvedValue([{ id: 'purchase-999' }]);
    setDbClient(mockDb);

    const res = await app.request(
      '/payments/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': '550e8400-e29b-4a4a-a716-446655440000',
          'X-Device-Platform': 'ios',
        },
        body: JSON.stringify({ experienceId: VALID_UUID }),
      },
      {},
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      purchaseId: 'purchase-999',
      checkoutUrl: 'https://sandbox.mercadopago.com/checkout/123',
    });

    // Verify insert values had the pending-UUID format
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        experienceId: VALID_UUID,
        provider: 'mercadopago',
        providerPaymentId: expect.stringMatching(/^pending-[a-f0-9-]+$/),
        amount: 15000,
        currency: 'ARS',
        status: 'pending',
      }),
    );

    // Verify update query sets the real provider payment ID
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        providerPaymentId: 'mp-pref-12345',
      }),
    );
  });

  it('includes platform from X-Device-Platform header in purchase values', async () => {
    const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
    const experienceMock = { id: VALID_UUID, title: 'Amazing Trip', free: false, price: 15000 };
    mockDb.limit.mockResolvedValue([experienceMock]);
    mockDb.returning.mockResolvedValue([{ id: 'purchase-999' }]);
    setDbClient(mockDb);

    const res = await app.request(
      '/payments/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': '550e8400-e29b-4a4a-a716-446655440000',
          'X-Device-Platform': 'ios',
        },
        body: JSON.stringify({ experienceId: VALID_UUID }),
      },
      {},
    );

    expect(res.status).toBe(200);
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'ios',
      }),
    );
  });

  it('includes raw device ID in purchase values if X-Device-Id header is present (pass-through)', async () => {
    const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
    const experienceMock = { id: VALID_UUID, title: 'Amazing Trip', free: false, price: 15000 };
    mockDb.limit.mockResolvedValue([experienceMock]);
    mockDb.returning.mockResolvedValue([{ id: 'purchase-999' }]);
    setDbClient(mockDb);

    const res = await app.request(
      '/payments/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': '550e8400-e29b-4a4a-a716-446655440000',
          'X-Device-Platform': 'ios',
        },
        body: JSON.stringify({ experienceId: VALID_UUID }),
      },
      {},
    );

    expect(res.status).toBe(200);
    // Now pass-through: deviceId is the raw header value, not the hash
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: '550e8400-e29b-4a4a-a716-446655440000',
      }),
    );
  });

  it('creates checkout with API-based backUrls and stores redirectUrl in purchase metadata', async () => {
    const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
    const experienceMock = { id: VALID_UUID, title: 'Amazing Trip', free: false, price: 15000 };
    mockDb.limit.mockResolvedValue([experienceMock]);
    mockDb.returning.mockResolvedValue([{ id: 'purchase-999' }]);
    setDbClient(mockDb);

    const res = await app.request(
      '/payments/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': '550e8400-e29b-4a4a-a716-446655440000',
          'X-Device-Platform': 'ios',
        },
        body: JSON.stringify({
          experienceId: VALID_UUID,
          redirectUrl: 'sonora://payment/callback',
        }),
      },
      {},
    );

    expect(res.status).toBe(200);
    // backUrls always point to the API origin (HTTPS-safe for MP auto_return)
    expect(mockProvider.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        backUrls: {
          success: 'http://localhost/payments/return/success/purchase-999',
          failure: 'http://localhost/payments/return/failure/purchase-999',
          pending: 'http://localhost/payments/return/pending/purchase-999',
        },
      }),
    );
    // redirectUrl stored in purchase metadata for the return redirect
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { redirectUrl: 'sonora://payment/callback' },
      }),
    );
  });

  it('creates checkout with API-based backUrls when no redirectUrl is provided', async () => {
    const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
    const experienceMock = { id: VALID_UUID, title: 'Amazing Trip', free: false, price: 15000 };
    mockDb.limit.mockResolvedValue([experienceMock]);
    mockDb.returning.mockResolvedValue([{ id: 'purchase-999' }]);
    setDbClient(mockDb);

    const res = await app.request(
      '/payments/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': '550e8400-e29b-4a4a-a716-446655440000',
          'X-Device-Platform': 'ios',
        },
        body: JSON.stringify({ experienceId: VALID_UUID }),
      },
      {},
    );

    expect(res.status).toBe(200);
    // backUrls always use the API origin, even without redirectUrl
    expect(mockProvider.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        backUrls: {
          success: 'http://localhost/payments/return/success/purchase-999',
          failure: 'http://localhost/payments/return/failure/purchase-999',
          pending: 'http://localhost/payments/return/pending/purchase-999',
        },
      }),
    );
    // metadata is undefined when no redirectUrl is provided
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.not.objectContaining({
        metadata: expect.anything(),
      }),
    );
  });
});

describe('POST /payments/webhook', () => {
  let mockProvider: any;
  let mockDb: any;
  let infoSpy: any;
  let warnSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    setDbClient(null);

    mockProvider = {
      processWebhook: vi.fn(),
    };

    (createPaymentProviders as any).mockReturnValue({
      mercadopago: mockProvider,
    });

    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      returning: vi.fn(),
    };

    infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    setDbClient(null);
    infoSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('processes a valid payment webhook (pending → approved)', async () => {
    mockProvider.processWebhook.mockResolvedValue({
      event: 'approved',
      providerPaymentId: 'mp-987654',
      externalReference: 'purchase-abc-123',
      email: 'buyer@example.com',
      amount: 15000,
      currency: 'ARS',
    });

    // No existing purchase found — first webhook
    setDbClient(mockDb);
    mockDb.limit.mockResolvedValue([]);
    mockDb.returning.mockResolvedValue([
      { id: 'purchase-abc-123', providerPaymentId: 'mp-987654', status: 'approved' },
    ]);

    const res = await app.request(
      '/payments/webhook?data.id=987654&type=payment',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'payment', data: { id: '987654' } }),
      },
      {},
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
    // Should query by externalReference (our purchase UUID)
    expect(mockDb.where).toHaveBeenCalledWith(expect.any(Object));
    expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved' }));
  });

  it('skips duplicate webhook with same status (MP retry)', async () => {
    mockProvider.processWebhook.mockResolvedValue({
      event: 'approved',
      providerPaymentId: 'mp-987654',
      externalReference: 'purchase-abc-123',
      email: 'buyer@example.com',
      amount: 15000,
      currency: 'ARS',
    });

    // Purchase already has approved status
    setDbClient(mockDb);
    mockDb.limit.mockResolvedValue([{ status: 'approved' }]);

    const res = await app.request(
      '/payments/webhook?data.id=987654&type=payment',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'payment', data: { id: '987654' } }),
      },
      {},
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
    // Should NOT update DB
    expect(mockDb.set).not.toHaveBeenCalled();
    // Should log at info level — same status, no update needed
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('[WEBHOOK] Duplicate notification'),
      expect.any(Object),
    );
  });

  it('blocks replay attack — refunded → approved is invalid', async () => {
    mockProvider.processWebhook.mockResolvedValue({
      event: 'approved',
      providerPaymentId: 'mp-987654',
      externalReference: 'purchase-abc-123',
      email: 'buyer@example.com',
      amount: 15000,
      currency: 'ARS',
    });

    // Purchase is already refunded
    setDbClient(mockDb);
    mockDb.limit.mockResolvedValue([{ status: 'refunded' }]);

    const res = await app.request(
      '/payments/webhook?data.id=987654&type=payment',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'payment', data: { id: '987654' } }),
      },
      {},
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
    // Should NOT update DB
    expect(mockDb.set).not.toHaveBeenCalled();
    // Should log at warn level with metric
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[METRIC:invalid_webhook_transition_total]'),
      expect.objectContaining({
        from: 'refunded',
        attempted: 'approved',
      }),
    );
  });

  it('processes legitimate refund (approved → refunded)', async () => {
    mockProvider.processWebhook.mockResolvedValue({
      event: 'refunded',
      providerPaymentId: 'mp-987654',
      externalReference: 'purchase-abc-123',
      email: 'buyer@example.com',
      amount: 15000,
      currency: 'ARS',
    });

    setDbClient(mockDb);
    mockDb.limit.mockResolvedValue([{ status: 'approved' }]);
    mockDb.returning.mockResolvedValue([
      { id: 'purchase-abc-123', providerPaymentId: 'mp-987654', status: 'refunded' },
    ]);

    const res = await app.request(
      '/payments/webhook?data.id=987654&type=payment',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'payment', data: { id: '987654' } }),
      },
      {},
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
    expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'refunded' }));
  });

  describe('GET /payments/return/:status/:purchaseId', () => {
    it('redirects to metadata.redirectUrl when present', async () => {
      setDbClient(mockDb);
      mockDb.limit.mockResolvedValue([{ metadata: { redirectUrl: 'sonora://payment/callback' } }]);

      const res = await app.request('/payments/return/success/purchase-123');
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('sonora://payments/success/purchase-123');
    });

    it('redirects to web app origin with status and purchaseId when redirectUrl is a web origin', async () => {
      setDbClient(mockDb);
      mockDb.limit.mockResolvedValue([
        { metadata: { redirectUrl: 'https://sonoraderivapoeticas-team-sonora--staging.expo.app' } },
      ]);

      const res = await app.request('/payments/return/success/purchase-123');
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe(
        'https://sonoraderivapoeticas-team-sonora--staging.expo.app/payments/success/purchase-123',
      );
    });

    it('preserves existing redirectUrl metadata when webhook updates purchase status', async () => {
      setDbClient(mockDb);
      mockProvider.processWebhook.mockResolvedValue({
        externalReference: 'purchase-123',
        providerPaymentId: 'mp-123456',
        event: 'approved',
        metadata: {},
      });
      // Mock existing purchase with redirectUrl metadata
      mockDb.limit.mockResolvedValue([
        { status: 'pending', metadata: { redirectUrl: 'https://my-web-app.com' } },
      ]);
      mockDb.returning.mockResolvedValue([
        {
          id: 'purchase-123',
          status: 'approved',
          metadata: { redirectUrl: 'https://my-web-app.com' },
        },
      ]);

      const res = await app.request(
        '/payments/webhook?data.id=123456&type=payment',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'payment', data: { id: '123456' } }),
        },
        {},
      );

      expect(res.status).toBe(200);
      // Ensure db.update set metadata preserving existing redirectUrl
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { redirectUrl: 'https://my-web-app.com' },
        }),
      );
    });

    it('redirects native API callback HTTP URL to native deep link', async () => {
      setDbClient(mockDb);
      mockDb.limit.mockResolvedValue([
        { metadata: { redirectUrl: 'https://api.sonora.com/payments/callback' } },
      ]);

      const res = await app.request('/payments/return/success/purchase-123');
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toContain('://payments/success/purchase-123');
    });

    it('handles malformed redirectUrl gracefully in return endpoint', async () => {
      setDbClient(mockDb);
      mockDb.limit.mockResolvedValue([{ metadata: { redirectUrl: 'http://:' } }]);

      const res = await app.request('/payments/return/success/purchase-123');
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toContain('/payments/callback');
    });

    it('ignores Mercado Pago referer header and redirects to callback URL fallback', async () => {
      setDbClient(mockDb);
      mockDb.limit.mockResolvedValue([{}]); // No redirectUrl in metadata

      const res = await app.request('/payments/return/success/purchase-123', {
        headers: { Referer: 'https://sandbox.mercadopago.com.ar/checkout/v1/redirect/123' },
      });
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toContain('/payments/callback');
    });

    it('uses non-gateway referer origin when metadata.redirectUrl is missing', async () => {
      setDbClient(mockDb);
      mockDb.limit.mockResolvedValue([{}]);

      const res = await app.request('/payments/return/success/purchase-123', {
        headers: { Referer: 'https://my-app.example.com/checkout' },
      });
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('https://my-app.example.com');
    });
  });
});
