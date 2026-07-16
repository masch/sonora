import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MercadoPagoProvider } from '../payments/mercadopago';

const mockCreate = vi.fn();
const mockGet = vi.fn();
const mockSearch = vi.fn();

vi.mock('mercadopago', () => {
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
  };
});

describe('MercadoPagoProvider', () => {
  let provider: MercadoPagoProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new MercadoPagoProvider({
      accessToken: 'TEST-123456',
      webhookSecret: 'webhook-secret',
    });
  });

  describe('createCheckout', () => {
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
