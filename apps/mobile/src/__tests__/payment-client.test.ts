import { PaymentClient } from '@/services/payment-client';

// Mock ApiClient at the module level
const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock('@/services/api-client', () => ({
  ApiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

describe('PaymentClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPayment', () => {
    it('posts to /payments/create with experienceId', async () => {
      mockPost.mockResolvedValue({
        purchaseId: 'purchase-1',
        checkoutUrl: 'https://mp.com/checkout',
      });

      const result = await PaymentClient.createPayment('exp-1');

      expect(mockPost).toHaveBeenCalledWith('/payments/create', { experienceId: 'exp-1' });
      expect(result.purchaseId).toBe('purchase-1');
      expect(result.checkoutUrl).toBe('https://mp.com/checkout');
    });

    it('propagates errors from ApiClient', async () => {
      mockPost.mockRejectedValue(new Error('Network error'));

      await expect(PaymentClient.createPayment('exp-1')).rejects.toThrow('Network error');
    });
  });

  describe('getPaymentStatus', () => {
    it('gets payment status by purchaseId', async () => {
      mockGet.mockResolvedValue({
        purchaseId: 'purchase-1',
        status: 'approved',
        experienceId: 'exp-1',
        provider: 'mercadopago',
        amount: 15000,
        currency: 'ARS',
        email: 'user@example.com',
      });

      const result = await PaymentClient.getPaymentStatus('purchase-1');

      expect(mockGet).toHaveBeenCalledWith('/payments/status/purchase-1?sync=true');
      expect(result.status).toBe('approved');
      expect(result.email).toBe('user@example.com');
    });
  });

  describe('checkPurchased', () => {
    it('checks purchased status with email query param', async () => {
      mockGet.mockResolvedValue({
        purchased: true,
        purchase: {
          purchaseId: 'purchase-1',
          status: 'approved',
          provider: 'mercadopago',
          amount: 15000,
          currency: 'ARS',
          purchasedAt: '2026-07-11T00:00:00Z',
        },
      });

      const result = await PaymentClient.checkPurchased('exp-1', 'user@example.com');

      expect(mockGet).toHaveBeenCalledWith(
        '/payments/experiences/exp-1/purchased?email=user%40example.com',
      );
      expect(result.purchased).toBe(true);
    });

    it('returns not purchased when no purchases found', async () => {
      mockGet.mockResolvedValue({ purchased: false });

      const result = await PaymentClient.checkPurchased('exp-1', 'nobody@example.com');

      expect(result.purchased).toBe(false);
    });
  });

  describe('listPurchases', () => {
    it('lists purchases by email', async () => {
      mockGet.mockResolvedValue({ purchases: [] });

      const result = await PaymentClient.listPurchases('user@example.com');

      expect(mockGet).toHaveBeenCalledWith('/payments/purchases?email=user%40example.com');
      expect(result.purchases).toEqual([]);
    });
  });

  describe('logAccess', () => {
    it('posts to access log endpoint with correct payload', async () => {
      mockPost.mockResolvedValueOnce({ status: 'ok' });

      await PaymentClient.logAccess('exp-1', 'paid', 'test@example.com', 'ios');

      expect(mockPost).toHaveBeenCalledWith('/payments/experiences/exp-1/access', {
        source: 'paid',
        email: 'test@example.com',
        platform: 'ios',
      });
    });

    it('does not throw on network error (fire-and-forget)', async () => {
      mockPost.mockRejectedValue(new Error('Network error'));

      await expect(PaymentClient.logAccess('exp-1', 'free')).resolves.toBeUndefined();
    });
  });
});
