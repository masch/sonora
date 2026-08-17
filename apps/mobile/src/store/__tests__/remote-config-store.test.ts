import type { RemoteConfigPayload } from '@sonora/shared';
import { DEFAULT_REMOTE_CONFIG } from '@sonora/shared';
import { ApiClient } from '../../services/api-client';
import { getCachedConfig, setCachedConfig } from '../../storage/config-cache';
import { computeVersionStatus, useRemoteConfigStore } from '../remote-config-store';

// Mock Constants so installedVersion is stable for versionStatus tests
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));

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

// Per-format geofence shape (GEOF.1). Note: track.defaultMode is 'formatDefaultRadius' per
// USER DECISION C (matches DEFAULT_REMOTE_CONFIG; both walkable formats use the format default).
const DEFAULT_CONFIG = {
  geofence: {
    trip: { radiusMeters: 30, defaultMode: 'formatDefaultRadius' },
    track: { radiusMeters: 100000, defaultMode: 'formatDefaultRadius' },
    bypassGeofence: false,
  },
  audio: { rewindOffsetMs: 10000 },
  feedback: { syncIntervalSec: 30 },
};

const DEFAULT_APP_VERSION = {
  appVersion: { minimumVersion: '0.0.0', blockOlderVersions: false },
};

const fullDefaults: RemoteConfigPayload = { ...DEFAULT_REMOTE_CONFIG, ...DEFAULT_APP_VERSION };

beforeEach(() => {
  jest.clearAllMocks();
  useRemoteConfigStore.setState({
    config: fullDefaults,
    isLoading: true,
    error: null,
    versionStatus: 'ok',
  });
  mockGetCachedConfig.mockResolvedValue(null);
  mockApiGet.mockResolvedValue({});
});

// ── computeVersionStatus (pure function) ───────────────────────────

describe('computeVersionStatus', () => {
  it('returns ok when installed version meets minimum', () => {
    const result = computeVersionStatus('1.5.0', '1.0.0', true, undefined, undefined);
    expect(result).toBe('ok');
  });

  it('returns ok when installed version equals minimum', () => {
    const result = computeVersionStatus('1.0.0', '1.0.0', true, undefined, undefined);
    expect(result).toBe('ok');
  });

  it('returns block when installed version is below minimum and blockOlderVersions is true', () => {
    const result = computeVersionStatus('1.0.0', '2.0.0', true, undefined, undefined);
    expect(result).toBe('block');
  });

  it('returns warn when installed version is below minimum and blockOlderVersions is false', () => {
    const result = computeVersionStatus('1.0.0', '2.0.0', false, undefined, undefined);
    expect(result).toBe('warn');
  });

  it('downgrades block to warn within grace period range', () => {
    const start = new Date(Date.now() - 86400000).toISOString(); // yesterday
    const end = new Date(Date.now() + 86400000).toISOString(); // tomorrow
    const result = computeVersionStatus('1.0.0', '2.0.0', true, start, end);
    expect(result).toBe('warn');
  });

  it('keeps block after grace period ends', () => {
    const start = '2026-01-01T00:00:00Z';
    const end = '2026-01-10T00:00:00Z';
    const result = computeVersionStatus('1.0.0', '2.0.0', true, start, end);
    expect(result).toBe('block');
  });

  it('returns block before grace period starts', () => {
    const start = new Date(Date.now() + 86400000).toISOString(); // tomorrow
    const end = new Date(Date.now() + 86400000 * 2).toISOString(); // day after
    const result = computeVersionStatus('1.0.0', '2.0.0', true, start, end);
    expect(result).toBe('block');
  });

  it('returns block when grace period dates are missing (no grace, strict mode)', () => {
    const result = computeVersionStatus('1.0.0', '2.0.0', true, undefined, undefined);
    expect(result).toBe('block');
  });

  it('returns ok when installedVersion is empty (offline first-launch)', () => {
    const result = computeVersionStatus('', '1.0.0', true, undefined, undefined);
    expect(result).toBe('ok');
  });

  it('returns block when installedVersion is invalid semver', () => {
    const result = computeVersionStatus('not-a-version', '1.0.0', true, undefined, undefined);
    expect(result).toBe('block');
  });

  it('returns ok when minimumVersion is default (0.0.0)', () => {
    const result = computeVersionStatus('1.0.0', '0.0.0', true, undefined, undefined);
    expect(result).toBe('ok');
  });

  it('returns ok when below minimum but blockOlderVersions is false', () => {
    const result = computeVersionStatus('1.0.0', '2.0.0', false, undefined, undefined);
    expect(result).toBe('warn');
  });
});

// ── Store integration ──────────────────────────────────────────────

describe('RemoteConfigStore', () => {
  it('initialises with loading state and defaults', () => {
    const state = useRemoteConfigStore.getState();
    expect(state.config).toEqual(fullDefaults);
    expect(state.isLoading).toBe(true);
    expect(state.error).toBeNull();
    expect(state.versionStatus).toBe('ok');
  });

  it('fetch API and merge remote config on init', async () => {
    mockApiGet.mockResolvedValue({
      geofence: {
        trip: { radiusMeters: 200, defaultMode: 'formatDefaultRadius' },
        track: { radiusMeters: 50, defaultMode: 'formatDefaultRadius' },
        bypassGeofence: true,
      },
    });

    await useRemoteConfigStore.getState().init();

    const state = useRemoteConfigStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.config.geofence.trip.radiusMeters).toBe(200);
    expect(state.config.geofence.bypassGeofence).toBe(true);
    expect(state.config.audio.rewindOffsetMs).toBe(10000);
    expect(state.config.feedback.syncIntervalSec).toBe(30);
    expect(mockSetCachedConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        geofence: expect.objectContaining({
          trip: { radiusMeters: 200, defaultMode: 'formatDefaultRadius' },
          track: { radiusMeters: 50, defaultMode: 'formatDefaultRadius' },
          bypassGeofence: true,
        }),
      }),
    );
  });

  it('uses defaults when API fetch fails and no cache exists', async () => {
    mockApiGet.mockRejectedValue(new Error('Network Error'));

    await useRemoteConfigStore.getState().init();

    const state = useRemoteConfigStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.config).toMatchObject(DEFAULT_CONFIG);
  });

  it('uses cached config when API fails and cache exists', async () => {
    const cachedConfig: RemoteConfigPayload = {
      geofence: {
        trip: { radiusMeters: 300, defaultMode: 'formatDefaultRadius' },
        track: { radiusMeters: 300, defaultMode: 'formatDefaultRadius' },
        bypassGeofence: true,
      },
      audio: { rewindOffsetMs: 20000 },
      feedback: { syncIntervalSec: 300 },
      appVersion: { minimumVersion: '2.0.0', blockOlderVersions: true },
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
    mockApiGet.mockResolvedValue({
      geofence: {
        trip: { radiusMeters: 50, defaultMode: 'formatDefaultRadius' },
        track: { radiusMeters: 50, defaultMode: 'formatDefaultRadius' },
        bypassGeofence: true,
      },
    });

    await useRemoteConfigStore.getState().init();

    const state = useRemoteConfigStore.getState();
    expect(state.config.geofence.bypassGeofence).toBe(true);
    expect(state.config.geofence.trip.radiusMeters).toBe(50);
    expect(state.config.geofence.track.radiusMeters).toBe(50);
    expect(state.config.audio.rewindOffsetMs).toBe(10000);
  });

  it('handles type mismatch — discards invalid field, keeps default', async () => {
    mockApiGet.mockResolvedValue({
      geofence: {
        trip: { radiusMeters: 'not-a-number', defaultMode: 'formatDefaultRadius' },
      },
    });

    await useRemoteConfigStore.getState().init();

    const state = useRemoteConfigStore.getState();
    expect(state.config.geofence.trip.radiusMeters).toBe(30);
  });

  it('falls back to defaults when API request is aborted (timeout)', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    mockApiGet.mockRejectedValue(abortError);

    await useRemoteConfigStore.getState().init();

    const state = useRemoteConfigStore.getState();
    expect(state.config).toMatchObject(DEFAULT_CONFIG);
    expect(state.error).toBeNull();
  });

  it('fills missing cache fields with defaults', async () => {
    const partialCache = {
      geofence: { trip: { radiusMeters: 999 } },
    } as unknown as RemoteConfigPayload;
    mockGetCachedConfig.mockResolvedValue(partialCache);
    mockApiGet.mockRejectedValue(new Error('Offline'));

    await useRemoteConfigStore.getState().init();

    const state = useRemoteConfigStore.getState();
    expect(state.config.geofence.trip.radiusMeters).toBe(999);
    expect(state.config.geofence.track.radiusMeters).toBe(100000);
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

  describe('versionStatus after init', () => {
    it('returns warn when API returns higher minimumVersion and blockOlderVersions is false', async () => {
      mockApiGet.mockResolvedValue({
        appVersion: { minimumVersion: '2.0.0', blockOlderVersions: false },
      });

      await useRemoteConfigStore.getState().init();

      const state = useRemoteConfigStore.getState();
      expect(state.versionStatus).toBe('warn');
    });

    it('returns block when API returns higher minimumVersion and blockOlderVersions is true', async () => {
      mockApiGet.mockResolvedValue({
        appVersion: { minimumVersion: '2.0.0', blockOlderVersions: true },
      });

      await useRemoteConfigStore.getState().init();

      const { versionStatus } = useRemoteConfigStore.getState();
      expect(versionStatus).toBe('block');
    });

    it('downgrades block to warn when grace period is in range', async () => {
      const start = new Date(Date.now() - 86400000).toISOString(); // yesterday
      const end = new Date(Date.now() + 86400000).toISOString(); // tomorrow
      mockApiGet.mockResolvedValue({
        appVersion: {
          minimumVersion: '2.0.0',
          blockOlderVersions: true,
          gracePeriodStart: start,
          gracePeriodEnd: end,
        },
      });

      await useRemoteConfigStore.getState().init();

      const { versionStatus } = useRemoteConfigStore.getState();
      expect(versionStatus).toBe('warn');
    });

    it('returns ok when app version meets minimum from API', async () => {
      mockApiGet.mockResolvedValue({
        appVersion: { minimumVersion: '0.5.0', blockOlderVersions: true },
      });

      await useRemoteConfigStore.getState().init();

      const { versionStatus } = useRemoteConfigStore.getState();
      expect(versionStatus).toBe('ok');
    });

    it('returns ok when init fails and no cache (offline first-launch fallback)', async () => {
      mockGetCachedConfig.mockResolvedValue(null);
      mockApiGet.mockRejectedValue(new Error('Offline'));

      await useRemoteConfigStore.getState().init();

      const { versionStatus } = useRemoteConfigStore.getState();
      expect(versionStatus).toBe('ok');
    });
  });

  it('refetch triggers a new API call and updates config', async () => {
    mockApiGet.mockResolvedValueOnce({
      geofence: {
        trip: { radiusMeters: 100, defaultMode: 'formatDefaultRadius' },
        track: { radiusMeters: 100, defaultMode: 'formatDefaultRadius' },
        bypassGeofence: false,
      },
    });

    await useRemoteConfigStore.getState().init();

    expect(useRemoteConfigStore.getState().config.geofence.trip.radiusMeters).toBe(100);

    mockApiGet.mockResolvedValueOnce({
      geofence: {
        trip: { radiusMeters: 500, defaultMode: 'formatDefaultRadius' },
        track: { radiusMeters: 500, defaultMode: 'formatDefaultRadius' },
        bypassGeofence: false,
      },
    });

    useRemoteConfigStore.getState().refetch();

    await waitFor(() => {
      expect(useRemoteConfigStore.getState().config.geofence.trip.radiusMeters).toBe(500);
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
