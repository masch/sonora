import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MercadoPagoProvider } from '../payments/mercadopago';

describe('MercadoPagoProvider', () => {
  let provider: MercadoPagoProvider;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    provider = new MercadoPagoProvider({
      accessToken: 'TEST-123456',
      webhookSecret: 'webhook-secret',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('createCheckout', () => {
    it('returns checkout URL and provider payment ID', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: '123456789',
            init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=123456789',
            sandbox_init_point:
              'https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=123456789',
          }),
        text: () => Promise.resolve(''),
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

      // Should prefer sandbox_init_point when using TEST token
      expect(result.checkoutUrl).toContain('sandbox');
      expect(result.providerPaymentId).toBe('123456789');
    });

    it('uses init_point when sandbox_init_point is not available', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: '123456789',
            init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=123456789',
          }),
        text: () => Promise.resolve(''),
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

    it('sends correct MP API payload', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: '123', init_point: 'https://mp.com/checkout' }),
        text: () => Promise.resolve(''),
      });

      await provider.createCheckout({
        purchaseId: 'p-1',
        experienceTitle: 'Test Exp',
        amount: 10000,
        currency: 'ARS',
        backUrls: {
          success: 'sonora://success',
          failure: 'sonora://failure',
          pending: 'sonora://pending',
        },
        notificationUrl: 'https://api.example.com/webhook',
      });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toContain('/checkout/preferences');

      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(callArgs[1].body);
      } catch {
        // test setup guarantee
      }
      const items = body.items as Array<Record<string, unknown>>;
      expect(items[0].title).toBe('Test Exp');
      expect(items[0].unit_price).toBe(10000);
      expect(items[0].currency_id).toBe('ARS');
      expect(body.external_reference).toBe('p-1');
      expect(body.auto_return).toBe('approved');
      expect(body.notification_url).toBe('https://api.example.com/webhook');
    });
  });

  describe('processWebhook', () => {
    it('fetches payment details and returns approved status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
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
          }),
        text: () => Promise.resolve(''),
      });

      const result = await provider.processWebhook(
        { type: 'payment', data: { id: '987654' } },
        { 'x-signature': 'abc' },
      );

      expect(result.event).toBe('approved');
      expect(result.email).toBe('buyer@example.com');
      expect(result.amount).toBe(15000);
      expect(result.currency).toBe('ARS');
      expect(result.metadata?.payment_method_id).toBe('visa');
      expect(result.metadata?.installments).toBe(3);
      expect(result.metadata?.payer_id).toBe('12345');
    });

    it('throws on non-payment notification', async () => {
      await expect(
        provider.processWebhook({ type: 'plan', data: { id: 'plan_123' } }, {}),
      ).rejects.toThrow('Ignored non-payment notification');
    });

    it('throws when data.id is missing', async () => {
      await expect(provider.processWebhook({ type: 'payment' }, {})).rejects.toThrow(
        'Ignored non-payment notification',
      );
    });
  });

  describe('getPaymentStatus', () => {
    it('returns mapped payment status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            status: 'approved',
            payer: { email: 'buyer@example.com' },
            transaction_amount: 15000,
            currency_id: 'ARS',
          }),
        text: () => Promise.resolve(''),
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
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ status: mp }),
          text: () => Promise.resolve(''),
        });

        const result = await provider.getPaymentStatus('123');
        expect(result.status).toBe(expected);
      }
    });
  });
});
