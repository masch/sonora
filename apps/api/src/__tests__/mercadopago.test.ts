import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MercadoPagoProvider } from '../payments/mercadopago';

const mockCreate = vi.fn();
const mockGet = vi.fn();
const mockSearch = vi.fn();

async function computeSignature(
  secret: string,
  dataId: string,
  requestId: string,
  ts: number,
): Promise<string> {
  const message = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

vi.mock('mercadopago', () => {
  class InvalidSignatureError extends Error {
    reason: string;
    constructor(reason: string, _requestId?: string, _timestamp?: string) {
      super(`Invalid webhook signature: ${reason}`);
      this.name = 'InvalidWebhookSignatureError';
      this.reason = reason;
    }
  }

  function parseSignatureHeader(header: string): { ts?: string; hashes: Record<string, string> } {
    const hashes: Record<string, string> = {};
    let ts: string | undefined;
    for (const part of header.split(',')) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      const key = part.substring(0, eq).trim().toLowerCase();
      const value = part.substring(eq + 1).trim();
      if (!key || !value) continue;
      if (key === 'ts') ts = value;
      else if (/^v\d+$/.test(key)) hashes[key] = value;
    }
    return { ts, hashes };
  }

  return {
    MercadoPagoConfig: vi.fn(),
    Preference: vi.fn().mockImplementation(
      class {
        create = mockCreate;
      } as unknown as (...args: unknown[]) => unknown,
    ),
    Payment: vi.fn().mockImplementation(
      class {
        get = mockGet;
        search = mockSearch;
      } as unknown as (...args: unknown[]) => unknown,
    ),
    WebhookSignatureValidator: {
      validate(options: {
        xSignature: string;
        xRequestId: string;
        dataId: string;
        secret: string;
      }): void {
        const crypto = require('crypto');
        const { ts, hashes } = parseSignatureHeader(options.xSignature);
        if (!ts || !hashes.v1) {
          throw new InvalidSignatureError('SignatureMismatch');
        }
        const manifest = `id:${options.dataId};request-id:${options.xRequestId};ts:${ts};`;
        const computed = crypto.createHmac('sha256', options.secret).update(manifest).digest('hex');
        if (computed !== hashes.v1) {
          throw new InvalidSignatureError('SignatureMismatch');
        }
      },
    },
    InvalidWebhookSignatureError: InvalidSignatureError,
  };
});

describe('MercadoPagoProvider', () => {
  describe('constructor', () => {
    it('throws when accessToken is empty', () => {
      expect(
        () =>
          new MercadoPagoProvider({
            accessToken: '',
            webhookSecret: 'valid-secret',
            environment: 'test',
            mpBypassSignature: false,
            signatureMaxAgeMinutes: 5,
          }),
      ).toThrow(TypeError);
    });

    it('throws when accessToken is undefined', () => {
      expect(
        () =>
          new MercadoPagoProvider({
            accessToken: undefined as unknown as string,
            webhookSecret: 'valid-secret',
            environment: 'test',
            mpBypassSignature: false,
            signatureMaxAgeMinutes: 5,
          }),
      ).toThrow(TypeError);
    });

    it('throws when webhookSecret is empty', () => {
      expect(
        () =>
          new MercadoPagoProvider({
            accessToken: 'TEST-123456',
            webhookSecret: '',
            environment: 'test',
            mpBypassSignature: false,
            signatureMaxAgeMinutes: 5,
          }),
      ).toThrow(TypeError);
    });

    it('throws when webhookSecret is undefined', () => {
      expect(
        () =>
          new MercadoPagoProvider({
            accessToken: 'TEST-123456',
            webhookSecret: undefined as unknown as string,
            environment: 'test',
            mpBypassSignature: false,
            signatureMaxAgeMinutes: 5,
          }),
      ).toThrow(TypeError);
    });

    it('constructs successfully with valid credentials', () => {
      const p = new MercadoPagoProvider({
        accessToken: 'TEST-123456',
        webhookSecret: 'valid-secret',
        environment: 'test',
        mpBypassSignature: false,
        signatureMaxAgeMinutes: 5,
      });
      expect(p).toBeInstanceOf(MercadoPagoProvider);
      expect(p.name).toBe('mercadopago');
    });
  });

  let provider: MercadoPagoProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new MercadoPagoProvider({
      accessToken: 'TEST-123456',
      webhookSecret: 'webhook-secret',
      environment: 'test',
      mpBypassSignature: false,
      signatureMaxAgeMinutes: 5,
    });
  });

  describe('createCheckout', () => {
    it('converts amount (cents) to unit_price (pesos) correctly', async () => {
      mockCreate.mockResolvedValue({
        id: '123456789',
        init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=123456789',
        sandbox_init_point:
          'https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=123456789',
      });

      const amountCents = 15000; // 150.00 pesos
      await provider.createCheckout({
        purchaseId: 'purchase-2',
        experienceTitle: 'Conversion Test',
        amount: amountCents,
        currency: 'ARS',
        backUrls: {
          success: 'sonora://payment/success/purchase-2',
          failure: 'sonora://payment/failure/purchase-2',
          pending: 'sonora://payment/pending/purchase-2',
        },
        notificationUrl: 'https://api.example.com/payments/webhook',
      });

      // Verify that the SDK received unit_price in major units (cents/100)
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            items: expect.arrayContaining([
              expect.objectContaining({ unit_price: amountCents / 100 }),
            ]),
          }),
        }),
      );
    });

    it('propagates errors from MercadoPago SDK', async () => {
      mockCreate.mockRejectedValue(new Error('MP SDK failure'));

      await expect(
        provider.createCheckout({
          purchaseId: 'purchase-err',
          experienceTitle: 'Error Test',
          amount: 10000,
          currency: 'ARS',
          backUrls: {
            success: 'sonora://payment/success/purchase-err',
            failure: 'sonora://payment/failure/purchase-err',
            pending: 'sonora://payment/pending/purchase-err',
          },
          notificationUrl: 'https://api.example.com/payments/webhook',
        }),
      ).rejects.toThrow('MP SDK failure');
    });

    it('returns checkout URL and provider payment ID', async () => {
      mockCreate.mockResolvedValue({
        id: '123456789',
        init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=123456789',
        sandbox_init_point:
          'https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=123456789',
      });

      const result = await provider.createCheckout({
        purchaseId: 'purchase-1',
        experienceTitle: 'Test Experience',
        amount: 15000,
        currency: 'ARS',
        backUrls: {
          success: 'sonora://payment/success/purchase-1',
          failure: 'sonora://payment/failure/purchase-1',
          pending: 'sonora://payment/pending/purchase-1',
        },
        notificationUrl: 'https://api.example.com/payments/webhook',
      });

      expect(result.checkoutUrl).toContain('sandbox');
      expect(result.providerPaymentId).toBe('123456789');
    });

    it('uses init_point when sandbox_init_point is not available', async () => {
      mockCreate.mockResolvedValue({
        id: '123456789',
        init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=123456789',
      });

      const result = await provider.createCheckout({
        purchaseId: 'purchase-1',
        experienceTitle: 'Test',
        amount: 15000,
        currency: 'ARS',
        backUrls: {
          success: 'sonora://payment/success/purchase-1',
          failure: 'sonora://payment/failure/purchase-1',
          pending: 'sonora://payment/pending/purchase-1',
        },
        notificationUrl: 'https://api.example.com/payments/webhook',
      });

      expect(result.checkoutUrl).toContain('mercadopago.com.ar');
    });
  });

  describe('processWebhook', () => {
    it('fetches payment details and returns approved status', async () => {
      const ts = Math.floor(Date.now() / 1000);
      const requestId = 'req-test-123';
      const hmac = await computeSignature('webhook-secret', '987654', requestId, ts);

      mockGet.mockResolvedValue({
        id: 987654,
        status: 'approved',
        payer: { email: 'buyer@example.com', id: '12345' },
        transaction_amount: 15000,
        currency_id: 'ARS',
        payment_method_id: 'visa',
        payment_type_id: 'credit_card',
        installments: 3,
        installment_amount: 5000,
        transaction_details: {
          net_received_amount: 14500,
          overpaid_amount: 0,
          total_paid_amount: 15000,
        },
      });

      const result = await provider.processWebhook(
        { type: 'payment', data: { id: '987654' } },
        {
          'x-signature': `ts=${ts},v1=${hmac}`,
          'x-request-id': requestId,
        },
        '987654',
      );

      expect(result.event).toBe('approved');
      expect(result.email).toBe('buyer@example.com');
      expect(result.amount).toBe(15000);
      expect(result.currency).toBe('ARS');
      expect(result.metadata?.payment_method_id).toBe('visa');
      expect(result.metadata?.installments).toBe(3);
      expect(result.metadata?.payer_id).toBe('12345');
    });

    it('throws InvalidSignature error for missing signature headers', async () => {
      mockGet.mockResolvedValue({ id: 1, status: 'approved' });

      await expect(
        provider.processWebhook(
          { type: 'payment', data: { id: '987654' } },
          { 'x-signature': '' },
          '987654',
        ),
      ).rejects.toThrow('Invalid signature');
    });

    it('throws InvalidSignature error for tampered HMAC and logs warning', async () => {
      // Spy on logger.warn
      const { logger } = await import('@sonora/shared');
      const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

      const ts = Math.floor(Date.now() / 1000);
      const requestId = 'req-invalid-456';

      await expect(
        provider.processWebhook(
          { type: 'payment', data: { id: '987654' } },
          {
            'x-signature': `ts=${ts},v1=0000111122223333444455556666777788889999aaaabbbbccccddddeeeeffff`,
            'x-request-id': requestId,
          },
          '987654',
        ),
      ).rejects.toThrow('Invalid signature');

      expect(warnSpy).toHaveBeenCalledWith(
        '[METRIC:invalid_signature_total] Invalid signature',
        expect.objectContaining({
          ts: String(ts),
          'x-request-id': requestId,
          'data.id': '987654',
          reason: expect.any(String),
        }),
      );

      warnSpy.mockRestore();
    });

    it('throws on non-payment notification', async () => {
      await expect(
        provider.processWebhook({ type: 'plan', data: { id: 'plan_123' } }, {}, 'plan_123'),
      ).rejects.toThrow('Ignored non-payment notification');
    });

    it('throws when data.id is missing', async () => {
      await expect(provider.processWebhook({ type: 'payment' }, {}, '')).rejects.toThrow(
        'Missing data.id',
      );
    });
  });

  describe('getPaymentStatus', () => {
    it('returns mapped payment status', async () => {
      mockGet.mockResolvedValue({
        status: 'approved',
        payer: { email: 'buyer@example.com' },
        transaction_amount: 15000,
        currency_id: 'ARS',
      });

      const result = await provider.getPaymentStatus('987654');

      expect(result.status).toBe('approved');
      expect(result.email).toBe('buyer@example.com');
      expect(result.amount).toBe(15000);
      expect(result.currency).toBe('ARS');
    });

    it('maps MP statuses correctly', async () => {
      const statusMap: Array<{ mp: string; expected: string }> = [
        { mp: 'approved', expected: 'approved' },
        { mp: 'pending', expected: 'pending' },
        { mp: 'in_process', expected: 'pending' },
        { mp: 'in_mediation', expected: 'pending' },
        { mp: 'rejected', expected: 'rejected' },
        { mp: 'cancelled', expected: 'rejected' },
        { mp: 'charged_back', expected: 'rejected' },
        { mp: 'refunded', expected: 'refunded' },
        { mp: 'unknown_status', expected: 'pending' },
      ];

      for (const { mp, expected } of statusMap) {
        mockGet.mockResolvedValueOnce({ status: mp });
        const result = await provider.getPaymentStatus('123');
        expect(result.status).toBe(expected);
      }
    });

    it('uses search result if externalReference is provided and found', async () => {
      mockSearch.mockResolvedValue({
        results: [
          {
            status: 'approved',
            payer: { email: 'search-buyer@example.com' },
            transaction_amount: 15000,
            currency_id: 'ARS',
          },
        ],
      });

      const result = await provider.getPaymentStatus('123', 'ext-ref-456');

      expect(result.status).toBe('approved');
      expect(result.email).toBe('search-buyer@example.com');
      expect(mockSearch).toHaveBeenCalledWith({
        options: { external_reference: 'ext-ref-456' },
      });
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('falls back to get when search results are empty', async () => {
      mockSearch.mockResolvedValue({ results: [] });
      mockGet.mockResolvedValue({
        status: 'pending',
        payer: { email: 'fallback@example.com' },
      });

      const result = await provider.getPaymentStatus('123', 'ext-ref-456');

      expect(result.status).toBe('pending');
      expect(result.email).toBe('fallback@example.com');
      expect(mockGet).toHaveBeenCalledWith({ id: '123' });
    });

    it('safely handles get failure and returns pending status', async () => {
      mockSearch.mockResolvedValue({ results: [] });
      mockGet.mockRejectedValue(new Error('MP API Error'));

      const result = await provider.getPaymentStatus('123', 'ext-ref-456');

      expect(result.status).toBe('pending');
      expect(result.email).toBeUndefined();
    });
  });
});
