import { DEFAULT_REMOTE_CONFIG } from '@sonora/shared';
import type { RemoteConfigPayload } from '@sonora/shared';
import { ApiClient } from '../../services/api-client';
import { getCachedConfig, setCachedConfig } from '../../storage/config-cache';
import { useRemoteConfigStore } from '../remote-config-store';

// ── Mocks ──────────────────────────────────────────────────────────

jest.mock('../../storage/config-cache', () => ({
  getCachedConfig: jest.fn(),
  setCachedConfig: jest.fn().mockResolvedValue(undefined),
  clearCachedConfig: jest.fn(),
}));

jest.mock('../../services/api-client', () => ({
  ApiClient: {
    get: jest.fn(),
  },
}));

const mockApiGet = ApiClient.get as jest.Mock;
const mockGetCachedConfig = getCachedConfig as jest.Mock;
const mockSetCachedConfig = setCachedConfig as jest.Mock;

const DEFAULT_CONFIG = {
  geofence: { radiusMeters: 50, bypassGeofence: false },
  audio: { rewindOffsetMs: 10000 },
  feedback: { syncIntervalSec: 30 },
};

beforeEach(() => {
  jest.clearAllMocks();
  useRemoteConfigStore.setState({
    config: DEFAULT_REMOTE_CONFIG,
    isLoading: true,
    error: null,
  });
  mockGetCachedConfig.mockResolvedValue(null);
  mockApiGet.mockResolvedValue({});
});

// ── Tests ──────────────────────────────────────────────────────────

describe('RemoteConfigStore', () => {
  it('initialises with loading state and defaults', () => {
    const state = useRemoteConfigStore.getState();
    expect(state.config).toEqual(DEFAULT_REMOTE_CONFIG);
    expect(state.isLoading).toBe(true);
    expect(state.error).toBeNull();
  });

  it('fetch API and merge remote config on init', async () => {
    mockApiGet.mockResolvedValue({
      geofence: { radiusMeters: 200, bypassGeofence: true },
    });

    await useRemoteConfigStore.getState().init();

    const state = useRemoteConfigStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.config.geofence.radiusMeters).toBe(200);
    expect(state.config.geofence.bypassGeofence).toBe(true);
    expect(state.config.audio.rewindOffsetMs).toBe(10000);
    expect(state.config.feedback.syncIntervalSec).toBe(30);
    expect(mockSetCachedConfig).toHaveBeenCalledWith(
      expect.objectContaining({ geofence: { radiusMeters: 200, bypassGeofence: true } }),
    );
  });

  it('uses defaults when API fetch fails and no cache exists', async () => {
    mockApiGet.mockRejectedValue(new Error('Network Error'));

    await useRemoteConfigStore.getState().init();

    const state = useRemoteConfigStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.config).toEqual(DEFAULT_CONFIG);
  });

  it('uses cached config when API fails and cache exists', async () => {
    const cachedConfig: RemoteConfigPayload = {
      geofence: { radiusMeters: 300, bypassGeofence: true },
      audio: { rewindOffsetMs: 20000 },
      feedback: { syncIntervalSec: 300 },
    };
    mockGetCachedConfig.mockResolvedValue(cachedConfig);
    mockApiGet.mockRejectedValue(new Error('Offline'));

    await useRemoteConfigStore.getState().init();

    const state = useRemoteConfigStore.getState();
    expect(state.config).toEqual(cachedConfig);
  });

  it('sets error when API fails and no cache', async () => {
    mockGetCachedConfig.mockResolvedValue(null);
    mockApiGet.mockRejectedValue(new Error('Server Error'));

    await useRemoteConfigStore.getState().init();

    const state = useRemoteConfigStore.getState();
    expect(state.error).toBeDefined();
    expect(state.error!.message).toBe('Server Error');
  });

  it('handles partial response — received fields override, missing keep defaults', async () => {
    mockApiGet.mockResolvedValue({ geofence: { radiusMeters: 50, bypassGeofence: true } });

    await useRemoteConfigStore.getState().init();

    const state = useRemoteConfigStore.getState();
    expect(state.config.geofence.bypassGeofence).toBe(true);
    expect(state.config.geofence.radiusMeters).toBe(50);
    expect(state.config.audio.rewindOffsetMs).toBe(10000);
  });

  it('handles type mismatch — discards invalid field, keeps default', async () => {
    mockApiGet.mockResolvedValue({
      geofence: { radiusMeters: 'not-a-number' },
    });

    await useRemoteConfigStore.getState().init();

    const state = useRemoteConfigStore.getState();
    expect(state.config.geofence.radiusMeters).toBe(50);
  });

  it('falls back to defaults when API request is aborted (timeout)', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    mockApiGet.mockRejectedValue(abortError);

    await useRemoteConfigStore.getState().init();

    const state = useRemoteConfigStore.getState();
    expect(state.config).toEqual(DEFAULT_CONFIG);
    expect(state.error).toBeNull();
  });

  it('fills missing cache fields with defaults', async () => {
    const partialCache = { geofence: { radiusMeters: 999 } } as RemoteConfigPayload;
    mockGetCachedConfig.mockResolvedValue(partialCache);
    mockApiGet.mockRejectedValue(new Error('Offline'));

    await useRemoteConfigStore.getState().init();

    const state = useRemoteConfigStore.getState();
    expect(state.config.geofence.radiusMeters).toBe(999);
    expect(state.config.geofence.bypassGeofence).toBe(false);
    expect(state.config.audio.rewindOffsetMs).toBe(10000);
    expect(state.config.feedback.syncIntervalSec).toBe(30);
  });

  it('passes an AbortSignal to ApiClient.get for timeout control', async () => {
    let capturedSignal: AbortSignal | undefined;
    mockApiGet.mockImplementation((_path: string, options?: { signal?: AbortSignal }) => {
      capturedSignal = options?.signal;
      return Promise.reject(new Error('ignore'));
    });

    await useRemoteConfigStore.getState().init();

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal!.aborted).toBe(false);
    expect(capturedSignal!.constructor.name).toBe('AbortSignal');
  });

  it('refetch triggers a new API call and updates config', async () => {
    mockApiGet.mockResolvedValueOnce({ geofence: { radiusMeters: 100, bypassGeofence: false } });

    await useRemoteConfigStore.getState().init();

    expect(useRemoteConfigStore.getState().config.geofence.radiusMeters).toBe(100);

    mockApiGet.mockResolvedValueOnce({ geofence: { radiusMeters: 500, bypassGeofence: false } });

    useRemoteConfigStore.getState().refetch();

    await waitFor(() => {
      expect(useRemoteConfigStore.getState().config.geofence.radiusMeters).toBe(500);
    });

    expect(useRemoteConfigStore.getState().config.geofence.bypassGeofence).toBe(false);
  });
});

/** Small poll-based helper so refetch tests work without jest timers. */
function waitFor(predicate: () => boolean | void, timeout = 2000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      try {
        const result = predicate();
        if (result !== false) {
          resolve();
          return;
        }
      } catch {
        // keep polling
      }
      if (Date.now() - start > timeout) {
        reject(new Error('waitFor timed out'));
        return;
      }
      setImmediate(check);
    }
    check();
  });
}
