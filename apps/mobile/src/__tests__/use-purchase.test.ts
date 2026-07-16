import { renderHook, act, waitFor } from '@testing-library/react-native';

// Mocks must be defined BEFORE imports
const mockCreatePayment = jest.fn();
const mockGetPaymentStatus = jest.fn();
const mockCheckPurchased = jest.fn();
const mockLogAccess = jest.fn();
const mockGetPurchasedIds = jest.fn();
const mockAddPurchasedId = jest.fn();
const mockGetUserEmail = jest.fn();
const mockSetUserEmail = jest.fn();
const mockOpenAuthSessionAsync = jest.fn();
const mockCanOpenURL = jest.fn();
const mockOpenURL = jest.fn();
const mockAddEventListener = jest.fn();

jest.mock('@/services/payment-client', () => ({
  PaymentClient: {
    createPayment: (...args: unknown[]) => mockCreatePayment(...args),
    getPaymentStatus: (...args: unknown[]) => mockGetPaymentStatus(...args),
    checkPurchased: (...args: unknown[]) => mockCheckPurchased(...args),
    logAccess: (...args: unknown[]) => mockLogAccess(...args),
  },
}));

jest.mock('@/storage/app-storage', () => ({
  getPurchasedIds: (...args: unknown[]) => mockGetPurchasedIds(...args),
  addPurchasedId: (...args: unknown[]) => mockAddPurchasedId(...args),
  getUserEmail: (...args: unknown[]) => mockGetUserEmail(...args),
  setUserEmail: (...args: unknown[]) => mockSetUserEmail(...args),
}));

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: (...args: unknown[]) => mockOpenAuthSessionAsync(...args),
}));

jest.mock('expo-linking', () => ({
  createURL: jest.fn(() => 'sonora://payment/callback'),
  canOpenURL: (...args: unknown[]) => mockCanOpenURL(...args),
  openURL: (...args: unknown[]) => mockOpenURL(...args),
  addEventListener: (...args: unknown[]) => mockAddEventListener(...args),
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { usePurchase } from '@/hooks/use-purchase';

describe('usePurchase', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetPurchasedIds.mockResolvedValue(new Set());
    mockGetUserEmail.mockResolvedValue(null);
    mockAddPurchasedId.mockResolvedValue(undefined);
    mockSetUserEmail.mockResolvedValue(undefined);
    mockAddEventListener.mockReturnValue({ remove: jest.fn() });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('sets purchased if experience is in local cache', async () => {
    mockGetPurchasedIds.mockResolvedValue(new Set(['exp-1']));

    const { result } = await renderHook(() => usePurchase('exp-1'));

    await waitFor(() => {
      expect(result.current[0].status).toBe('purchased');
    });
  });

  it('sets free status for free experience with no cache', async () => {
    const { result } = await renderHook(() => usePurchase('exp-1', true));

    await waitFor(() => {
      expect(result.current[0].status).toBe('free');
    });
  });

  it('sets paid status for paid experience with no cache or email', async () => {
    const { result } = await renderHook(() => usePurchase('exp-1', false, 15000));

    await waitFor(() => {
      expect(result.current[0].status).toBe('paid');
    });
    expect(result.current[0].price).toBe(15000);
  });

  it('checks remote email if email is stored', async () => {
    mockGetUserEmail.mockResolvedValue('user@example.com');
    mockCheckPurchased.mockResolvedValue({
      purchased: true,
      purchase: {
        purchaseId: 'p-1',
        status: 'approved',
        provider: 'mercadopago',
        amount: 15000,
        currency: 'ARS',
        purchasedAt: '',
      },
    });

    const { result } = await renderHook(() => usePurchase('exp-1', false, 15000));

    await waitFor(() => {
      expect(result.current[0].status).toBe('purchased');
    });
    expect(mockAddPurchasedId).toHaveBeenCalledWith('exp-1');
  });

  describe('pay', () => {
    it('creates payment and opens auth session', async () => {
      mockCreatePayment.mockResolvedValue({
        purchaseId: 'p-1',
        checkoutUrl: 'https://mp.com/checkout',
      });
      mockOpenAuthSessionAsync.mockResolvedValue({ type: 'success' });

      const { result } = await renderHook(() => usePurchase('exp-1', false, 15000));
      await waitFor(() => expect(result.current[0].status).toBe('paid'));

      await act(async () => {
        await result.current[1].pay();
      });

      expect(mockCreatePayment).toHaveBeenCalledWith('exp-1', expect.any(String));
      expect(mockOpenAuthSessionAsync).toHaveBeenCalled();
    });

    it('falls back to Linking when WebBrowser fails', async () => {
      mockCreatePayment.mockResolvedValue({
        purchaseId: 'p-1',
        checkoutUrl: 'https://mp.com/checkout',
      });
      mockOpenAuthSessionAsync.mockRejectedValue(new Error('Not supported'));
      mockCanOpenURL.mockResolvedValue(true);

      const { result } = await renderHook(() => usePurchase('exp-1', false, 15000));
      await waitFor(() => expect(result.current[0].status).toBe('paid'));

      await act(async () => {
        await result.current[1].pay();
      });

      expect(mockCanOpenURL).toHaveBeenCalledWith('https://mp.com/checkout');
      expect(mockOpenURL).toHaveBeenCalledWith('https://mp.com/checkout');
    });

    it('sets error when no browser available', async () => {
      mockCreatePayment.mockResolvedValue({
        purchaseId: 'p-1',
        checkoutUrl: 'https://mp.com/checkout',
      });
      mockOpenAuthSessionAsync.mockRejectedValue(new Error('Not supported'));
      mockCanOpenURL.mockResolvedValue(false);

      const { result } = await renderHook(() => usePurchase('exp-1', false, 15000));
      await waitFor(() => expect(result.current[0].status).toBe('paid'));

      await act(async () => {
        await result.current[1].pay();
      });

      expect(result.current[0].error).toBe('payments.error.noBrowser');
    });
  });

  describe('polling', () => {
    it('updates status to purchased when polling succeeds', async () => {
      mockCreatePayment.mockResolvedValue({
        purchaseId: 'p-1',
        checkoutUrl: 'https://mp.com/checkout',
      });
      mockOpenAuthSessionAsync.mockResolvedValue({ type: 'success' });
      mockGetPaymentStatus.mockResolvedValue({
        purchaseId: 'p-1',
        status: 'approved',
        experienceId: 'exp-1',
        provider: 'mercadopago',
        amount: 15000,
        currency: 'ARS',
        email: 'user@example.com',
      });

      const { result } = await renderHook(() => usePurchase('exp-1', false, 15000));
      await waitFor(() => expect(result.current[0].status).toBe('paid'));

      await act(async () => {
        await result.current[1].pay();
      });

      // Advance timers past one poll interval
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(result.current[0].status).toBe('purchased');
      });
      expect(mockAddPurchasedId).toHaveBeenCalledWith('exp-1');
      expect(mockSetUserEmail).toHaveBeenCalledWith('user@example.com');
      expect(mockLogAccess).toHaveBeenCalledWith('exp-1', 'paid', 'user@example.com', 'ios');
    });

    it('sets error when payment is rejected', async () => {
      mockCreatePayment.mockResolvedValue({
        purchaseId: 'p-1',
        checkoutUrl: 'https://mp.com/checkout',
      });
      mockOpenAuthSessionAsync.mockResolvedValue({ type: 'success' });
      mockGetPaymentStatus.mockResolvedValue({
        purchaseId: 'p-1',
        status: 'rejected',
        experienceId: 'exp-1',
        provider: 'mercadopago',
        amount: 15000,
        currency: 'ARS',
      });

      const { result } = await renderHook(() => usePurchase('exp-1', false, 15000));
      await waitFor(() => expect(result.current[0].status).toBe('paid'));

      await act(async () => {
        await result.current[1].pay();
      });

      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(result.current[0].error).toBe('payments.error.rejected');
      });
    });

    it('timeouts after max polling attempts', async () => {
      mockCreatePayment.mockResolvedValue({
        purchaseId: 'p-1',
        checkoutUrl: 'https://mp.com/checkout',
      });
      mockOpenAuthSessionAsync.mockResolvedValue({ type: 'success' });
      mockGetPaymentStatus.mockResolvedValue({
        purchaseId: 'p-1',
        status: 'pending',
        experienceId: 'exp-1',
        provider: 'mercadopago',
        amount: 15000,
        currency: 'ARS',
      });

      const { result } = await renderHook(() => usePurchase('exp-1', false, 15000));
      await waitFor(() => expect(result.current[0].status).toBe('paid'));

      await act(async () => {
        await result.current[1].pay();
      });

      // Advance past max polling attempts (15 * 2000 = 30000ms)
      await act(async () => {
        jest.advanceTimersByTime(31000);
      });

      await waitFor(() => {
        expect(result.current[0].error).toBe('payments.pending');
      });
    });
  });

  describe('restore', () => {
    it('marks as purchased when restore succeeds', async () => {
      mockCheckPurchased.mockResolvedValue({
        purchased: true,
        purchase: {
          purchaseId: 'p-1',
          status: 'approved',
          provider: 'mercadopago',
          amount: 15000,
          currency: 'ARS',
          purchasedAt: '',
        },
      });

      const { result } = await renderHook(() => usePurchase('exp-1', false, 15000));
      await waitFor(() => expect(result.current[0].status).toBe('paid'));

      await act(async () => {
        const success = await result.current[1].restore('user@example.com');
        expect(success).toBe(true);
      });

      expect(result.current[0].status).toBe('purchased');
      expect(mockSetUserEmail).toHaveBeenCalledWith('user@example.com');
      expect(mockAddPurchasedId).toHaveBeenCalledWith('exp-1');
      expect(mockLogAccess).toHaveBeenCalledWith('exp-1', 'restored', 'user@example.com', 'ios');
    });

    it('returns false when no purchases found', async () => {
      mockCheckPurchased.mockResolvedValue({ purchased: false });

      const { result } = await renderHook(() => usePurchase('exp-1', false, 15000));
      await waitFor(() => expect(result.current[0].status).toBe('paid'));

      await act(async () => {
        const success = await result.current[1].restore('nobody@example.com');
        expect(success).toBe(false);
      });
    });

    it('sets error on network failure', async () => {
      mockCheckPurchased.mockRejectedValue(new Error('Network error'));

      const { result } = await renderHook(() => usePurchase('exp-1', false, 15000));
      await waitFor(() => expect(result.current[0].status).toBe('paid'));

      await act(async () => {
        const success = await result.current[1].restore('user@example.com');
        expect(success).toBe(false);
      });

      expect(result.current[0].error).toBe('payments.error.restore');
    });
  });

  describe('refresh', () => {
    it('re-checks purchase status', async () => {
      mockGetPurchasedIds.mockResolvedValue(new Set(['exp-1']));

      const { result } = await renderHook(() => usePurchase('exp-1', true));
      await waitFor(() => expect(result.current[0].status).toBe('purchased'));

      mockGetPurchasedIds.mockResolvedValue(new Set());

      await act(async () => {
        await result.current[1].refresh();
      });

      await waitFor(() => {
        expect(result.current[0].status).toBe('free');
      });
    });
  });

  describe('deep linking', () => {
    it('starts polling when matching redirect URL with query params is received', async () => {
      let listener: ((event: { url: string }) => void) | null = null;
      mockAddEventListener.mockImplementation((event, cb) => {
        if (event === 'url') {
          listener = cb;
        }
        return { remove: jest.fn() };
      });

      mockCreatePayment.mockResolvedValue({
        purchaseId: 'purchase-123',
        checkoutUrl: 'https://checkout.url',
      });
      mockGetPaymentStatus.mockResolvedValue({
        purchaseId: 'purchase-123',
        status: 'pending',
        experienceId: 'exp-1',
      });

      const { result } = await renderHook(() => usePurchase('exp-1', false, 15000));
      await waitFor(() => expect(result.current[0].status).toBe('paid'));

      // Start the payment flow to set pollingRef.current.purchaseId
      mockOpenAuthSessionAsync.mockResolvedValue({ type: 'success' });
      await act(async () => {
        await result.current[1].pay();
      });

      expect(listener).not.toBeNull();

      // Trigger the deep link url event with query params
      await act(async () => {
        listener!({
          url: 'sonora://payment/success/purchase-123?collection_id=123&status=approved',
        });
      });

      // Advance timers to trigger the polling interval
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      // It should strip query parameters and extract 'purchase-123', matching the current purchaseId
      // and call getPaymentStatus
      expect(mockGetPaymentStatus).toHaveBeenCalledWith('purchase-123');
    });
  });
});
