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
    trip: { radiusMeters: 100, defaultMode: 'formatDefaultRadius' },
    track: { radiusMeters: 300, defaultMode: 'formatDefaultRadius' },
    bypassGeofence: false,
  },
  audio: { rewindOffsetMs: 10000 },
  feedback: { syncIntervalSec: 30 },
  social: { instagramHandle: 'sonora.derivapoetica' },
};

const DEFAULT_APP_VERSION = {
  appVersion: { minimumVersion: '0.0.0', blockOlderVersions: false },
};

const fullDefaults: RemoteConfigPayload = { ...DEFAULT_REMOTE_CONFIG, ...DEFAULT_APP_VERSION };

/**
 * A cache entry as the store reads it: the payload and the moment it was
 * fetched. `ageMs` decides whether the payload is still an answer in its own
 * right, which is what the revalidation tests below turn on.
 */
function cachedEntry(radiusMeters: number, ageMs: number) {
  return {
    config: {
      ...fullDefaults,
      geofence: {
        trip: { radiusMeters, defaultMode: 'formatDefaultRadius' },
        track: { radiusMeters, defaultMode: 'formatDefaultRadius' },
        bypassGeofence: false,
        bypassIosBrowser: true,
      },
    } as RemoteConfigPayload,
    fetchedAt: Date.now() - ageMs,
  };
}

/** A `/config` answer that differs from the defaults in one readable field. */
function remoteRadius(radiusMeters: number) {
  return {
    geofence: {
      trip: { radiusMeters, defaultMode: 'formatDefaultRadius' },
      track: { radiusMeters, defaultMode: 'formatDefaultRadius' },
      bypassGeofence: false,
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useRemoteConfigStore.setState({
    config: fullDefaults,
    isLoading: true,
    error: null,
    versionStatus: 'ok',
    // A new app run: no `/config` answer has been applied yet, which is what lets the
    // cache draw. Leaving it set from a previous test would hide that path.
    liveConfigApplied: false,
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
        bypassIosBrowser: true,
      },
      audio: { rewindOffsetMs: 20000 },
      feedback: { syncIntervalSec: 300 },
      appVersion: { minimumVersion: '2.0.0', blockOlderVersions: true },
      social: { instagramHandle: 'sonora.derivapoetica' },
      map: {
        renderer: 'leaflet',
        styleUrl: 'https://api.example/media/public/styles/v1.json',
        regions: {},
        download: {
          preload: [],
          autoMaxBytes: 8_000_000,
          cacheMaxBytes: 100_000_000,
          cellular: 'ask',
        },
        layers: { showControl: false, groups: [] },
      },
    };
    mockGetCachedConfig.mockResolvedValue({ config: cachedConfig, fetchedAt: Date.now() });
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

  it('keeps the remote map when its payload carries a nested field this build does not know', async () => {
    // The user-visible consequence of `map` being `.passthrough()`: an unknown
    // sibling field must not cost the app the renderer, the style, the region
    // catalog or the download policy. Every value below differs from
    // DEFAULT_REMOTE_CONFIG.map, so a test that quietly fell back would fail.
    const regions = {
      calamuchita: {
        bbox: [-64.83, -32.28, -64.66, -32.12] as [number, number, number, number],
        label: 'Valle de Calamuchita',
        archiveUrl: 'https://api.example/media/public/tiles/calamuchita/v1.pmtiles',
        archiveBytes: 1_234_567,
      },
    };
    const download = {
      preload: ['calamuchita', 'punilla'],
      autoMaxBytes: 42_000_000,
      cacheMaxBytes: 512_000_000,
      cellular: 'never' as const,
    };
    const styleUrl = 'https://api.example/media/public/styles/v9.json';
    mockApiGet.mockResolvedValue({
      map: {
        renderer: 'maplibre',
        styleUrl,
        regions,
        download,
        futureField: { anything: true },
      },
    });

    await useRemoteConfigStore.getState().init();

    const state = useRemoteConfigStore.getState();
    expect(state.config.map.renderer).toBe('maplibre');
    expect(state.config.map.styleUrl).toBe(styleUrl);
    expect(state.config.map.regions).toEqual(regions);
    expect(state.config.map.download).toEqual(download);
  });

  it('handles type mismatch — discards invalid field, keeps default', async () => {
    mockApiGet.mockResolvedValue({
      geofence: {
        trip: { radiusMeters: 'not-a-number', defaultMode: 'formatDefaultRadius' },
      },
    });

    await useRemoteConfigStore.getState().init();

    const state = useRemoteConfigStore.getState();
    expect(state.config.geofence.trip.radiusMeters).toBe(100);
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
    mockGetCachedConfig.mockResolvedValue({ config: partialCache, fetchedAt: Date.now() });
    mockApiGet.mockRejectedValue(new Error('Offline'));

    await useRemoteConfigStore.getState().init();

    const state = useRemoteConfigStore.getState();
    expect(state.config.geofence.trip.radiusMeters).toBe(999);
    expect(state.config.geofence.track.radiusMeters).toBe(300);
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

    // A run nothing was already doing started, so a caller counting attempts is told so.
    expect(useRemoteConfigStore.getState().refetch()).toBe(true);

    await waitFor(() => {
      expect(useRemoteConfigStore.getState().config.geofence.trip.radiusMeters).toBe(500);
    });

    expect(useRemoteConfigStore.getState().config.geofence.bypassGeofence).toBe(false);
  });

  // ── Revalidation (S1, S2, S5, S6) ───────────────────────────────
  //
  // The field report: a published map version did not reach the phone until the
  // app data was cleared, because `/config` was fetched once per JS process and
  // a single aborted run kept the previous payload for good. These tests pin the
  // three ways that stops being true: a failed run is retried, a cold start gets
  // a budget a sleeping radio can meet, and a cached payload past its max age is
  // never the final answer.

  describe('revalidation', () => {
    it('retries a failed run instead of keeping the previous payload for good', async () => {
      mockApiGet
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockResolvedValueOnce(remoteRadius(700));

      await useRemoteConfigStore.getState().init();

      expect(mockApiGet).toHaveBeenCalledTimes(2);
      const state = useRemoteConfigStore.getState();
      expect(state.config.geofence.trip.radiusMeters).toBe(700);
      expect(state.error).toBeNull();
    });

    it('retries a run that aborted and never surfaces the abort as an error', async () => {
      mockGetCachedConfig.mockResolvedValue(cachedEntry(450, 60 * 60 * 1000));
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockApiGet.mockRejectedValue(abortError);

      await useRemoteConfigStore.getState().init();

      expect(mockApiGet).toHaveBeenCalledTimes(3);
      const state = useRemoteConfigStore.getState();
      expect(state.config.geofence.trip.radiusMeters).toBe(450);
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it('stops after a bounded number of attempts', async () => {
      mockGetCachedConfig.mockResolvedValue(cachedEntry(400, 60 * 60 * 1000));
      mockApiGet.mockRejectedValue(new Error('Network Error'));

      await useRemoteConfigStore.getState().init();

      expect(mockApiGet).toHaveBeenCalledTimes(3);
      expect(useRemoteConfigStore.getState().config.geofence.trip.radiusMeters).toBe(400);
      expect(useRemoteConfigStore.getState().error).toBeNull();
    });

    it('gives a cold-start answer longer than the old three-second budget', async () => {
      // A phone whose radio is asleep answers late. The run has to still be
      // alive at five seconds, which the previous 3 s budget was not.
      jest.useFakeTimers();
      try {
        const signals: AbortSignal[] = [];
        mockApiGet.mockImplementation((_path: string, options?: { signal?: AbortSignal }) => {
          const signal = options!.signal!;
          signals.push(signal);
          return new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => {
              const error = new Error('The operation was aborted');
              error.name = 'AbortError';
              reject(error);
            });
          });
        });

        const initPromise = useRemoteConfigStore.getState().init();
        await jest.advanceTimersByTimeAsync(5_000);

        expect(signals).toHaveLength(1);
        expect(signals[0].aborted).toBe(false);

        // Still bounded: the budget is longer, not absent.
        await jest.advanceTimersByTimeAsync(60_000);
        await initPromise;
        expect(signals[0].aborted).toBe(true);
      } finally {
        jest.useRealTimers();
      }
    });

    it('takes a freshly cached payload as the answer after one attempt', async () => {
      mockGetCachedConfig.mockResolvedValue(cachedEntry(420, 0));
      mockApiGet.mockRejectedValue(new Error('Network Error'));

      await useRemoteConfigStore.getState().init();

      expect(mockApiGet).toHaveBeenCalledTimes(1);
      expect(useRemoteConfigStore.getState().config.geofence.trip.radiusMeters).toBe(420);
    });

    it('keeps trying the network while the cached payload is past its max age', async () => {
      mockGetCachedConfig.mockResolvedValue(cachedEntry(410, 24 * 60 * 60 * 1000));
      mockApiGet.mockRejectedValue(new Error('Network Error'));

      await useRemoteConfigStore.getState().init();

      expect(mockApiGet).toHaveBeenCalledTimes(3);
      // The stale payload still renders: the retries decide the answer, they do
      // not blank the screen while they run.
      expect(useRemoteConfigStore.getState().config.geofence.trip.radiusMeters).toBe(410);
    });

    it('treats a stamp in the future as stale, exactly like one too old', async () => {
      // A clock that was ahead when the entry was written makes its age negative. An
      // age running backwards is not a fresh one: believed, the entry would be an
      // answer for as long as the clock takes to catch up.
      mockGetCachedConfig.mockResolvedValue(cachedEntry(430, -60 * 1000));
      mockApiGet.mockRejectedValue(new Error('Network Error'));

      await useRemoteConfigStore.getState().init();

      expect(mockApiGet).toHaveBeenCalledTimes(3);
      // The retries decide the answer; the untrusted payload is what renders meanwhile.
      expect(useRemoteConfigStore.getState().config.geofence.trip.radiusMeters).toBe(430);
    });

    it('does not trust a cache that carries no fetch time', async () => {
      // Builds before this one wrote the payload alone, and its age is
      // unknowable, so it cannot be the final answer either.
      mockGetCachedConfig.mockResolvedValue(fullDefaults);
      mockApiGet.mockRejectedValue(new Error('Network Error'));

      await useRemoteConfigStore.getState().init();

      expect(mockApiGet).toHaveBeenCalledTimes(3);
      expect(useRemoteConfigStore.getState().config).toEqual(fullDefaults);
    });

    it('does not start a second run while one is in flight, and says it started nothing', async () => {
      let resolveFirst: ((value: unknown) => void) | null = null;
      mockApiGet.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      );
      mockApiGet.mockResolvedValue(remoteRadius(600));

      const initPromise = useRemoteConfigStore.getState().init();
      await new Promise((resolve) => setImmediate(resolve));
      expect(mockApiGet).toHaveBeenCalledTimes(1);

      // Dropped: a caller that counts its own attempts must not pay for this one.
      const started = useRemoteConfigStore.getState().refetch();
      expect(mockApiGet).toHaveBeenCalledTimes(1);

      resolveFirst!(remoteRadius(550));
      await initPromise;
      expect(started).toBe(false);
      expect(useRemoteConfigStore.getState().config.geofence.trip.radiusMeters).toBe(550);
    });

    it('keeps the live payload when a later run reads an older cache entry', async () => {
      // The network answered and its payload is what the app is showing. The cache on
      // the device is older, because the write after that answer is the one that failed:
      // a later run must not put the older entry back over it.
      mockApiGet.mockResolvedValue(remoteRadius(620));
      await useRemoteConfigStore.getState().init();
      expect(useRemoteConfigStore.getState().config.geofence.trip.radiusMeters).toBe(620);

      mockGetCachedConfig.mockResolvedValue(cachedEntry(300, 0));
      mockApiGet.mockRejectedValue(new Error('Offline'));
      useRemoteConfigStore.getState().refetch();

      await waitFor(() => expect(mockGetCachedConfig).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(useRemoteConfigStore.getState().isLoading).toBe(false));

      expect(useRemoteConfigStore.getState().config.geofence.trip.radiusMeters).toBe(620);
    });

    it('recomputes the version status from the payload a revalidation won', async () => {
      await useRemoteConfigStore.getState().init();
      expect(useRemoteConfigStore.getState().versionStatus).toBe('ok');

      // A foreground revalidation is the path a published minimum version now
      // reaches a running app by, so the status has to be recomputed there too.
      mockApiGet.mockResolvedValue({
        appVersion: { minimumVersion: '2.0.0', blockOlderVersions: false },
      });
      useRemoteConfigStore.getState().refetch();

      await waitFor(() => {
        expect(useRemoteConfigStore.getState().versionStatus).toBe('warn');
      });
    });
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
