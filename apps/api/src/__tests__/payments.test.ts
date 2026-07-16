import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import app, { setDbClient } from '../index';
import { createPaymentProviders } from '../payments';

vi.mock('../payments', () => ({
  createPaymentProviders: vi.fn(),
}));

describe('POST /payments/create', () => {
  let mockProvider: any;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    setDbClient(null);

    // Mock payment provider
    mockProvider = {
      createCheckout: vi.fn().mockResolvedValue({
        checkoutUrl: 'https://sandbox.mercadopago.com/checkout/123',
        providerPaymentId: 'mp-pref-12345',
      }),
    };

    (createPaymentProviders as any).mockReturnValue({
      mercadopago: mockProvider,
    });

    // Mock DB client
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experienceId: 'non-existent' }),
      },
      {},
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Experience not found' });
  });

  it('returns 400 when experience is free', async () => {
    mockDb.limit.mockResolvedValue([{ id: 'exp-1', free: true }]);
    setDbClient(mockDb);

    const res = await app.request(
      '/payments/create',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experienceId: 'exp-1' }),
      },
      {},
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Experience is free' });
  });

  it('returns 400 when experience has no price set', async () => {
    mockDb.limit.mockResolvedValue([{ id: 'exp-1', free: false, price: null }]);
    setDbClient(mockDb);

    const res = await app.request(
      '/payments/create',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experienceId: 'exp-1' }),
      },
      {},
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Experience has no price set' });
  });

  it('successfully creates checkout, generates unique placeholder ID, and updates DB', async () => {
    const experienceMock = { id: 'exp-1', title: 'Amazing Trip', free: false, price: 15000 };
    mockDb.limit.mockResolvedValue([experienceMock]);
    mockDb.returning.mockResolvedValue([{ id: 'purchase-999' }]);
    setDbClient(mockDb);

    const res = await app.request(
      '/payments/create',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experienceId: 'exp-1' }),
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
        experienceId: 'exp-1',
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

  it('successfully creates checkout with a web redirect URL and adapts backUrls scheme', async () => {
    const experienceMock = { id: 'exp-1', title: 'Amazing Trip', free: false, price: 15000 };
    mockDb.limit.mockResolvedValue([experienceMock]);
    mockDb.returning.mockResolvedValue([{ id: 'purchase-999' }]);
    setDbClient(mockDb);

    const res = await app.request(
      '/payments/create',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experienceId: 'exp-1',
          redirectUrl: 'http://localhost:8081/payment/callback',
        }),
      },
      {},
    );

    expect(res.status).toBe(200);
    expect(mockProvider.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        backUrls: {
          success: 'http://localhost:8081/payment/success/purchase-999',
          failure: 'http://localhost:8081/payment/failure/purchase-999',
          pending: 'http://localhost:8081/payment/pending/purchase-999',
        },
      }),
    );
  });

  it('formats default redirect URLs correctly without triple slashes when no redirectUrl is provided', async () => {
    const experienceMock = { id: 'exp-1', title: 'Amazing Trip', free: false, price: 15000 };
    mockDb.limit.mockResolvedValue([experienceMock]);
    mockDb.returning.mockResolvedValue([{ id: 'purchase-999' }]);
    setDbClient(mockDb);

    const res = await app.request(
      '/payments/create',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experienceId: 'exp-1' }),
      },
      {},
    );

    expect(res.status).toBe(200);
    expect(mockProvider.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        backUrls: {
          success: 'sonora://payment/success/purchase-999',
          failure: 'sonora://payment/failure/purchase-999',
          pending: 'sonora://payment/pending/purchase-999',
        },
      }),
    );
  });
});
