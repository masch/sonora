import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import app, { setDbClient } from '../index';
import { createPaymentProviders } from '../payments';
import { logger } from '@sonora/shared';

vi.mock('../payments', () => ({
  createPaymentProviders: vi.fn(),
}));

/**
 * Redaction regression tests for `routes/payments.ts`.
 *
 * The spec (delta requirement 7) mandates query-stripped redirect/target URLs and
 * presence-flag-only webhook metadata. The 25 behavioral tests in payments.test.ts
 * do not exercise the redacted log arguments, so these tests pin the invariants
 * directly: sensitive values (query tokens, PII, full metadata objects) must never
 * appear in any logged argument.
 */

function allLogArgs(...spies: Array<ReturnType<typeof vi.spyOn>>): string {
  return spies
    .flatMap((spy) => spy.mock.calls)
    .map((call) =>
      call.map((arg: unknown) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '),
    )
    .join('\n');
}

describe('payments log redaction invariants', () => {
  let mockProvider: any;
  let mockDb: any;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    setDbClient(null);

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

    infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    setDbClient(null);
    infoSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('POST /payments/create logs receivedRedirectUrl with query string stripped', async () => {
    const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
    mockDb.limit.mockResolvedValue([
      { id: VALID_UUID, title: 'Amazing Trip', free: false, price: 15000 },
    ]);
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
          redirectUrl: 'https://my-web-app.com/callback?token=secret-token&page=1',
        }),
      },
      {},
    );

    expect(res.status).toBe(200);

    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('[PAYMENTS] Creating payment checkout'),
      expect.objectContaining({
        receivedRedirectUrl: 'https://my-web-app.com/callback',
      }),
    );

    const logs = allLogArgs(infoSpy, warnSpy);
    expect(logs).not.toContain('token=secret-token');
    expect(logs).not.toContain('redirectUrl=');
  });

  it('POST /payments/webhook logs metadata presence flags, never the metadata objects', async () => {
    mockProvider.processWebhook.mockResolvedValue({
      event: 'approved',
      providerPaymentId: 'mp-987654',
      externalReference: 'purchase-abc-123',
      email: 'buyer@example.com',
      amount: 15000,
      currency: 'ARS',
      metadata: {
        redirectUrl: 'https://my-web-app.com/r?signed=1',
        phone: '555-1234',
      },
    });

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

    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('[WEBHOOK] Updating purchase status & preserving metadata'),
      expect.objectContaining({
        purchaseId: 'purchase-abc-123',
        newStatus: 'approved',
        existingMetadataPresent: false,
        incomingMetadataPresent: true,
        mergedMetadataCount: 2,
      }),
    );

    const logs = allLogArgs(infoSpy, warnSpy);
    expect(logs).not.toContain('buyer@example.com');
    expect(logs).not.toContain('signed=1');
    expect(logs).not.toContain('555-1234');
    expect(logs).not.toContain('redirectUrl');
  });

  it('GET /payments/return redirect logs query-stripped rawRedirectUrl and finalTargetUrl', async () => {
    setDbClient(mockDb);
    mockDb.limit.mockResolvedValue([
      { metadata: { redirectUrl: 'https://my-web-app.com/callback?token=deep-link-secret' } },
    ]);

    const res = await app.request('/payments/return/success/purchase-123');
    expect(res.status).toBe(302);

    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('[PAYMENTS] Return endpoint redirecting'),
      expect.objectContaining({
        rawRedirectUrl: 'https://my-web-app.com/callback',
        finalTargetUrl: 'https://my-web-app.com/payments/success/purchase-123',
      }),
    );

    const logs = allLogArgs(infoSpy, warnSpy);
    expect(logs).not.toContain('deep-link-secret');
  });

  it('GET /payments/return referer fallback never logs the raw Referer header', async () => {
    // No metadata → falls through to referer origin fallback
    setDbClient(mockDb);
    mockDb.limit.mockResolvedValue([{}]);

    const res = await app.request('/payments/return/success/purchase-123', {
      headers: { Referer: 'https://my-web-app.com/some/path?utm=secret-campaign' },
    });
    expect(res.status).toBe(302);

    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('[PAYMENTS] Return endpoint falling back to referer origin'),
      expect.objectContaining({
        refererOrigin: 'https://my-web-app.com',
      }),
    );

    const logs = allLogArgs(infoSpy, warnSpy);
    expect(logs).not.toContain('utm=secret-campaign');
    expect(logs).not.toContain('some/path');
  });
});
