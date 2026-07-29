import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import app, { setDbClient } from '../../index';
import { createPaymentProviders } from '../../payments';

vi.mock('../../payments', () => ({ createPaymentProviders: vi.fn() }));

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('POST /payments/create — characterization', () => {
  let mockProvider: any;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    setDbClient(null);
    mockProvider = {
      createCheckout: vi.fn().mockResolvedValue({
        checkoutUrl: 'https://sandbox.mercadopago.com/checkout/123',
        providerPaymentId: 'mp-pref-12345',
      }),
    };
    (createPaymentProviders as any).mockReturnValue({ mercadopago: mockProvider });
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

  afterEach(() => setDbClient(null));

  it('captures 200 for valid body', async () => {
    mockDb.limit.mockResolvedValue([{ id: VALID_UUID, title: 'Trip', free: false, price: 15000 }]);
    mockDb.returning.mockResolvedValue([{ id: 'purchase-1' }]);
    setDbClient(mockDb);
    const res = await app.request(
      '/payments/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': '550e8400-e29b-4a4a-a716-446655440000',
        },
        body: JSON.stringify({ experienceId: VALID_UUID }),
      },
      {},
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      purchaseId: 'purchase-1',
      checkoutUrl: 'https://sandbox.mercadopago.com/checkout/123',
    });
  });

  it('captures 422 for empty body (zValidator catches missing experienceId first)', async () => {
    mockDb.limit.mockResolvedValue([]);
    setDbClient(mockDb);
    const res = await app.request(
      '/payments/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': '550e8400-e29b-4a4a-a716-446655440000',
        },
        body: JSON.stringify({}),
      },
      {},
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('code', 'VALIDATION_ERROR');
    expect(body).toHaveProperty('detail', 'The request contains invalid fields.');
    expect(body).toHaveProperty('status', 422);
    const errors = body.errors as Array<Record<string, unknown>>;
    expect(errors[0]).toHaveProperty('path', 'experienceId');
  });

  it('captures 500 for malformed JSON', async () => {
    setDbClient(mockDb);
    const res = await app.request(
      '/payments/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': '550e8400-e29b-4a4a-a716-446655440000',
        },
        body: '{not-json',
      },
      {},
    );
    expect(res.status).toBe(500);
  });

  it('captures 200 with redirectUrl in metadata', async () => {
    mockDb.limit.mockResolvedValue([{ id: VALID_UUID, title: 'Trip', free: false, price: 15000 }]);
    mockDb.returning.mockResolvedValue([{ id: 'purchase-2' }]);
    setDbClient(mockDb);
    const res = await app.request(
      '/payments/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': '550e8400-e29b-4a4a-a716-446655440000',
        },
        body: JSON.stringify({
          experienceId: VALID_UUID,
          redirectUrl: 'https://example.com/cb',
        }),
      },
      {},
    );
    expect(res.status).toBe(200);
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { redirectUrl: 'https://example.com/cb' },
      }),
    );
  });

  it('captures 200 with X-Device-Id header', async () => {
    mockDb.limit.mockResolvedValue([{ id: VALID_UUID, title: 'Trip', free: false, price: 15000 }]);
    mockDb.returning.mockResolvedValue([{ id: 'purchase-3' }]);
    setDbClient(mockDb);
    const res = await app.request(
      '/payments/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': '550e8400-e29b-4a4a-a716-446655440000',
        },
        body: JSON.stringify({ experienceId: VALID_UUID }),
      },
      {},
    );
    expect(res.status).toBe(200);
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: expect.any(String) }),
    );
  });
});

describe('POST /payments/webhook — characterization', () => {
  let mockProvider: any;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    setDbClient(null);
    mockProvider = { processWebhook: vi.fn() };
    (createPaymentProviders as any).mockReturnValue({ mercadopago: mockProvider });
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      returning: vi.fn(),
    };
  });

  afterEach(() => setDbClient(null));

  it('captures 200 for valid webhook', async () => {
    mockProvider.processWebhook.mockResolvedValue({
      event: 'approved',
      providerPaymentId: 'mp-1',
      externalReference: 'p-a',
      email: 'a@b.com',
    });
    mockDb.limit.mockResolvedValue([]);
    mockDb.returning.mockResolvedValue([{ id: 'p-a', status: 'approved' }]);
    setDbClient(mockDb);
    const res = await app.request(
      '/payments/webhook?data.id=1&type=payment',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'payment', data: { id: '1' } }),
      },
      {},
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('captures 400 for missing data.id query', async () => {
    setDbClient(mockDb);
    const res = await app.request(
      '/payments/webhook',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'payment', data: { id: '1' } }),
      },
      {},
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('code', 'MISSING_DATA_ID');
    expect(body).toHaveProperty('detail', 'The data.id query parameter is required.');
    expect(body).toHaveProperty('status', 400);
  });

  it('captures current behavior for missing body', async () => {
    setDbClient(mockDb);
    const res = await app.request(
      '/payments/webhook?data.id=1',
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      {},
    );
    expect(res.status).toBe(500);
  });

  it('captures duplicate status (MP retry)', async () => {
    mockProvider.processWebhook.mockResolvedValue({
      event: 'approved',
      providerPaymentId: 'mp-1',
      externalReference: 'p-a',
      email: 'a@b.com',
    });
    mockDb.limit.mockResolvedValue([{ status: 'approved' }]);
    setDbClient(mockDb);
    const res = await app.request(
      '/payments/webhook?data.id=1&type=payment',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'payment', data: { id: '1' } }),
      },
      {},
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});

describe('POST /payments/experiences/:id/access — characterization', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    setDbClient(null);
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ price: 1000 }]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => setDbClient(null));

  it('captures 201 for valid body with all fields', async () => {
    setDbClient(mockDb);
    const res = await app.request(
      `/payments/experiences/${VALID_UUID}/access`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': '550e8400-e29b-4a4a-a716-446655440000',
        },
        body: JSON.stringify({ source: 'free', email: 'u@e.com', platform: 'ios' }),
      },
      {},
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('captures 400 for missing device ID', async () => {
    setDbClient(mockDb);
    const res = await app.request(
      `/payments/experiences/${VALID_UUID}/access`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'free' }),
      },
      {},
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('code', 'DEVICE_ID_REQUIRED');
    expect(body).toHaveProperty('detail', 'The X-Device-Id header is required.');
    expect(body).toHaveProperty('status', 400);
  });

  it('captures 201 with null email', async () => {
    setDbClient(mockDb);
    const res = await app.request(
      `/payments/experiences/${VALID_UUID}/access`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': '550e8400-e29b-4a4a-a716-446655440000',
        },
        body: JSON.stringify({ source: 'free', email: null }),
      },
      {},
    );
    expect(res.status).toBe(201);
  });
});

describe('GET /payments/experiences/:id/purchased — characterization', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    setDbClient(null);
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn(),
    };
  });

  afterEach(() => setDbClient(null));

  it('captures 400 when email query missing', async () => {
    setDbClient(mockDb);
    const res = await app.request(`/payments/experiences/${VALID_UUID}/purchased`, {}, {});
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('code', 'VALIDATION_ERROR');
    expect(body).toHaveProperty('detail', 'The request contains invalid fields.');
    expect(body).toHaveProperty('status', 422);
    const errors = body.errors as Array<Record<string, unknown>>;
    expect(errors[0]).toHaveProperty('path', 'email');
  });

  it('captures 200 with email (no purchase)', async () => {
    mockDb.limit.mockResolvedValue([]);
    setDbClient(mockDb);
    const res = await app.request(
      `/payments/experiences/${VALID_UUID}/purchased?email=user@example.com`,
      {},
      {},
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ purchased: false });
  });
});

describe('GET /payments — characterization', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    setDbClient(null);
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => setDbClient(null));

  it('captures 400 when email query missing', async () => {
    setDbClient(mockDb);
    const res = await app.request('/payments/purchases', {}, {});
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('code', 'VALIDATION_ERROR');
    expect(body).toHaveProperty('detail', 'The request contains invalid fields.');
    expect(body).toHaveProperty('status', 422);
    const errors = body.errors as Array<Record<string, unknown>>;
    expect(errors[0]).toHaveProperty('path', 'email');
  });

  it('captures 200 with email query', async () => {
    mockDb.where.mockResolvedValue([]);
    setDbClient(mockDb);
    const res = await app.request('/payments/purchases?email=user@example.com', {}, {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ purchases: [] });
  });
});
