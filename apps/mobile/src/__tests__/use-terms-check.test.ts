import { Platform } from 'react-native';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { ApiError } from '@sonora/shared';
import { useTermsCheck } from '@/hooks/use-terms-check';
import * as storage from '@/storage/app-storage';
import { ApiClient } from '@/services/api-client';

jest.mock('@/storage/app-storage');
const mockStorage = storage as jest.Mocked<typeof storage>;

jest.mock('@/services/api-client', () => ({
  ApiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));
const mockApiClient = ApiClient as unknown as { get: jest.Mock; post: jest.Mock };

describe('useTermsCheck', () => {
  const remoteTerms = {
    version: '2026.09.1',
    lang: 'en' as const,
    title: 'Terms and Conditions',
    content: 'Legal content...',
    contentHash: 'a'.repeat(64),
    publishedAt: '2026-09-14T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.getAcceptedTermsVersion.mockResolvedValue(null);
    mockStorage.setAcceptedTermsVersion.mockResolvedValue(undefined);
    mockStorage.getDeviceId.mockResolvedValue('device-123-uuid');
  });

  it('sets status to needs_acceptance on first start when remote terms fetched', async () => {
    mockStorage.getAcceptedTermsVersion.mockResolvedValue(null);
    mockApiClient.get.mockResolvedValue(remoteTerms);

    const { result } = await renderHook(() => useTermsCheck());

    await waitFor(() => {
      expect(result.current.status).toBe('needs_acceptance');
    });
    expect(result.current.terms).toEqual(remoteTerms);
    expect(mockApiClient.get).toHaveBeenCalledWith('/terms?lang=en', { skipCache: true });
  });

  it('sets status to accepted when stored version matches remote version', async () => {
    mockStorage.getAcceptedTermsVersion.mockResolvedValue('2026.09.1');
    mockApiClient.get.mockResolvedValue(remoteTerms);

    const { result } = await renderHook(() => useTermsCheck());

    await waitFor(() => {
      expect(result.current.status).toBe('accepted');
    });
  });

  it('sets status to needs_acceptance when remote version is newer than stored version', async () => {
    mockStorage.getAcceptedTermsVersion.mockResolvedValue('2025.01.1');
    mockApiClient.get.mockResolvedValue(remoteTerms);

    const { result } = await renderHook(() => useTermsCheck());

    await waitFor(() => {
      expect(result.current.status).toBe('needs_acceptance');
    });
    expect(result.current.terms?.version).toBe('2026.09.1');
  });

  it('sets status to offline_blocked on first start when ApiClient.get fails', async () => {
    mockStorage.getAcceptedTermsVersion.mockResolvedValue(null);
    mockApiClient.get.mockRejectedValue(new Error('Network error'));

    const { result } = await renderHook(() => useTermsCheck());

    await waitFor(() => {
      expect(result.current.status).toBe('offline_blocked');
    });
    expect(result.current.isBlocking).toBe(true);
    expect(result.current.blockingError).toEqual({
      title: 'terms.offlineTitle',
      description: 'terms.networkError',
    });
    expect(result.current.terms).toBeNull();
    expect(result.current.error).toBe('terms.networkError');
  });

  it('sets status to accepted on offline subsequent start if version previously accepted', async () => {
    mockStorage.getAcceptedTermsVersion.mockResolvedValue('2026.09.1');
    mockApiClient.get.mockRejectedValue(new Error('Network error'));

    const { result } = await renderHook(() => useTermsCheck());

    await waitFor(() => {
      expect(result.current.status).toBe('accepted');
    });
    expect(result.current.isBlocking).toBe(false);
    expect(result.current.blockingError).toBeNull();
  });

  it('sets status to error and does not bypass offline when ApiClient.get throws ApiError', async () => {
    mockStorage.getAcceptedTermsVersion.mockResolvedValue('2026.09.1');
    mockApiClient.get.mockRejectedValue(new ApiError(404, 'Not Found', 'No active terms'));

    const { result } = await renderHook(() => useTermsCheck());

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(result.current.isBlocking).toBe(true);
    expect(result.current.blockingError).toEqual({
      title: 'terms.errorTitle',
      description: 'terms.errorDescription',
    });
    expect(result.current.terms).toBeNull();
    expect(result.current.error).toBe('terms.errorDescription');
  });

  it('sets status to error when ApiClient.get throws ApiError on first launch', async () => {
    mockStorage.getAcceptedTermsVersion.mockResolvedValue(null);
    mockApiClient.get.mockRejectedValue(
      new ApiError(500, 'Internal Server Error', 'Server failure'),
    );

    const { result } = await renderHook(() => useTermsCheck());

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(result.current.terms).toBeNull();
    expect(result.current.error).toBe('terms.errorDescription');
  });

  it('submits acceptance, persists version, and updates status to accepted', async () => {
    mockStorage.getAcceptedTermsVersion.mockResolvedValue(null);
    mockApiClient.get.mockResolvedValue(remoteTerms);
    mockApiClient.post.mockResolvedValue({ success: true });

    const { result } = await renderHook(() => useTermsCheck());

    await waitFor(() => {
      expect(result.current.status).toBe('needs_acceptance');
    });

    let success = false;
    await act(async () => {
      success = await result.current.acceptTerms();
    });

    expect(success).toBe(true);
    expect(mockApiClient.post).toHaveBeenCalledWith('/terms/accept', {
      deviceId: 'device-123-uuid',
      version: '2026.09.1',
      lang: 'en',
      contentHash: 'a'.repeat(64),
      platform: expect.any(String),
    });

    expect(mockStorage.setAcceptedTermsVersion).toHaveBeenCalledWith('2026.09.1');
    expect(result.current.status).toBe('accepted');
  });

  it('re-checks terms when retry() is called and transitions from offline to needs_acceptance', async () => {
    mockStorage.getAcceptedTermsVersion.mockResolvedValue(null);
    mockApiClient.get.mockRejectedValueOnce(new Error('Initial failure'));

    const { result } = await renderHook(() => useTermsCheck());

    await waitFor(() => {
      expect(result.current.status).toBe('offline_blocked');
    });

    mockApiClient.get.mockResolvedValueOnce(remoteTerms);

    await act(async () => {
      await result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('needs_acceptance');
    });
  });

  it('returns false and sets error when acceptTerms fails with an error', async () => {
    mockStorage.getAcceptedTermsVersion.mockResolvedValue(null);
    mockApiClient.get.mockResolvedValue(remoteTerms);
    mockApiClient.post.mockRejectedValue(new Error('Server error 500'));

    const { result } = await renderHook(() => useTermsCheck());

    await waitFor(() => {
      expect(result.current.status).toBe('needs_acceptance');
    });

    let success = true;
    await act(async () => {
      success = await result.current.acceptTerms();
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe('terms.errorDescription');
  });

  it('returns false and sets error when persisting accepted version fails', async () => {
    mockStorage.getAcceptedTermsVersion.mockResolvedValue(null);
    mockApiClient.get.mockResolvedValue(remoteTerms);
    mockApiClient.post.mockResolvedValue({ success: true });
    mockStorage.setAcceptedTermsVersion.mockRejectedValue(new Error('Disk failure'));

    const { result } = await renderHook(() => useTermsCheck());

    await waitFor(() => {
      expect(result.current.status).toBe('needs_acceptance');
    });

    let success = true;
    await act(async () => {
      success = await result.current.acceptTerms();
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe('terms.errorDescription');
    expect(result.current.status).toBe('needs_acceptance');
  });

  it('returns false from acceptTerms if terms is null', async () => {
    mockStorage.getAcceptedTermsVersion.mockResolvedValue(null);
    mockApiClient.get.mockRejectedValue(new Error('Network error'));

    const { result } = await renderHook(() => useTermsCheck());

    await waitFor(() => {
      expect(result.current.status).toBe('offline_blocked');
    });

    let success = true;
    await act(async () => {
      success = await result.current.acceptTerms();
    });

    expect(success).toBe(false);
  });

  it('handles non-Error instance rejection in acceptTerms', async () => {
    mockStorage.getAcceptedTermsVersion.mockResolvedValue(null);
    mockApiClient.get.mockResolvedValue(remoteTerms);
    mockApiClient.post.mockRejectedValue('raw string error');

    const { result } = await renderHook(() => useTermsCheck());

    await waitFor(() => {
      expect(result.current.status).toBe('needs_acceptance');
    });

    let success = true;
    await act(async () => {
      success = await result.current.acceptTerms();
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe('terms.errorDescription');
  });

  it('aborts state update if unmounted before ApiClient.get completes', async () => {
    mockStorage.getAcceptedTermsVersion.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(null), 50)),
    );

    const { unmount, result } = await renderHook(() => useTermsCheck());
    unmount();

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(result.current.status).toBe('checking');
  });

  it('submits acceptance with platform android and web', async () => {
    mockStorage.getAcceptedTermsVersion.mockResolvedValue(null);
    mockApiClient.get.mockResolvedValue(remoteTerms);
    mockApiClient.post.mockResolvedValue({ success: true });

    const { result } = await renderHook(() => useTermsCheck());

    await waitFor(() => {
      expect(result.current.status).toBe('needs_acceptance');
    });

    const originalOS = Platform.OS;
    try {
      (Platform as { OS: string }).OS = 'android';
      await act(async () => {
        await result.current.acceptTerms();
      });
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/terms/accept',
        expect.objectContaining({ platform: 'android' }),
      );

      (Platform as { OS: string }).OS = 'windows';
      await act(async () => {
        await result.current.acceptTerms();
      });
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/terms/accept',
        expect.objectContaining({ platform: 'web' }),
      );
    } finally {
      (Platform as { OS: string }).OS = originalOS;
    }
  });

  it('handles non-Error exception in checkTerms fetch', async () => {
    mockStorage.getAcceptedTermsVersion.mockResolvedValue(null);
    mockApiClient.get.mockRejectedValue('String network error');

    const { result } = await renderHook(() => useTermsCheck());

    await waitFor(() => {
      expect(result.current.status).toBe('offline_blocked');
    });
    expect(result.current.error).toBe('terms.networkError');
  });

  it('aborts state update if unmounted before ApiClient.get rejection completes', async () => {
    mockApiClient.get.mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error('Delayed crash')), 50)),
    );

    const { unmount, result } = await renderHook(() => useTermsCheck());
    unmount();

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(result.current.status).toBe('checking');
  });
});
