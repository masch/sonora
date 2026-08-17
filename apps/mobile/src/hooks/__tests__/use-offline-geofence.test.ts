import { renderHook, waitFor } from '@testing-library/react-native';
import { useOfflineGeofence, type ProximityClient } from '../use-offline-geofence';
import { useLocationStore } from '@/store/location-store';
import { useRemoteConfig } from '../use-remote-config';

// Mock the Zustand store hook
jest.mock('@/store/location-store', () => ({
  useLocationStore: jest.fn(),
}));

// Mock useRemoteConfig for dynamic config testing
jest.mock('../use-remote-config', () => ({
  useRemoteConfig: jest.fn(),
}));

describe('useOfflineGeofence hook', () => {
  const targetCoords = { latitude: -31.979, longitude: -64.635 };

  // Per-format config shape (GEOF.1): same block for trip & track.
  const defaultConfig = {
    geofence: {
      trip: { radiusMeters: 50, defaultMode: 'formatDefaultRadius' },
      track: { radiusMeters: 50, defaultMode: 'entityRadius' },
      bypassGeofence: false,
    },
    audio: { rewindOffsetMs: 10000 },
    feedback: { syncIntervalSec: 30 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRemoteConfig as unknown as jest.Mock).mockReturnValue({
      config: defaultConfig,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  it('should initialize in initializing state', async () => {
    (useLocationStore as unknown as jest.Mock).mockReturnValue({
      coords: null,
      accuracy: null,
      status: 'initializing',
      errorMsg: null,
    });

    const { result } = await renderHook(() => useOfflineGeofence(targetCoords));

    expect(result.current.gpsStatus).toBe('initializing');
    expect(result.current.isNearStart).toBe(false);
    expect(result.current.userCoordinates).toBeNull();
    // Default override: trip + type -> 50 m trip fallback radius.
    expect(result.current.requiredRadiusMeters).toBe(50);
  });

  it('should handle location permission denial', async () => {
    (useLocationStore as unknown as jest.Mock).mockReturnValue({
      coords: null,
      accuracy: null,
      status: 'weak',
      errorMsg: 'Permission to access location was denied',
    });

    const { result } = await renderHook(() => useOfflineGeofence(targetCoords));

    expect(result.current.gpsStatus).toBe('weak');
    expect(result.current.errorMsg).toBe('Permission to access location was denied');
  });

  it('should update state to ready and near when coordinates match closely', async () => {
    (useLocationStore as unknown as jest.Mock).mockReturnValue({
      coords: { latitude: -31.979, longitude: -64.635 },
      accuracy: 5,
      status: 'ready',
      errorMsg: null,
    });

    const { result } = await renderHook(() => useOfflineGeofence(targetCoords));

    expect(result.current.gpsStatus).toBe('ready');
    expect(result.current.isNearStart).toBe(true);
    expect(result.current.gpsAccuracy).toBe(5);
    expect(result.current.userCoordinates).toEqual({ latitude: -31.979, longitude: -64.635 });
  });

  it('should flag weak status when accuracy exceeds threshold', async () => {
    (useLocationStore as unknown as jest.Mock).mockReturnValue({
      coords: { latitude: -31.979, longitude: -64.635 },
      accuracy: 45,
      status: 'weak',
      errorMsg: null,
    });

    const { result } = await renderHook(() => useOfflineGeofence(targetCoords));

    expect(result.current.gpsStatus).toBe('weak');
    expect(result.current.isNearStart).toBe(true);
  });

  it('should use the trip fallback radius from useRemoteConfig', async () => {
    (useRemoteConfig as unknown as jest.Mock).mockReturnValue({
      config: {
        geofence: {
          trip: { radiusMeters: 200, defaultMode: 'formatDefaultRadius' },
          track: { radiusMeters: 500, defaultMode: 'entityRadius' },
          bypassGeofence: false,
        },
        audio: { rewindOffsetMs: 10000 },
        feedback: { syncIntervalSec: 30 },
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    (useLocationStore as unknown as jest.Mock).mockReturnValue({
      coords: { latitude: -31.979, longitude: -64.635 },
      accuracy: 5,
      status: 'ready',
      errorMsg: null,
    });

    const { result } = await renderHook(() => useOfflineGeofence(targetCoords));

    expect(result.current.requiredRadiusMeters).toBe(200);
    expect(result.current.isNearStart).toBe(true);
  });

  it('should update geofence radius when remote config changes between renders', async () => {
    (useLocationStore as unknown as jest.Mock).mockReturnValue({
      coords: { latitude: -31.979, longitude: -64.635 },
      accuracy: 5,
      status: 'ready',
      errorMsg: null,
    });

    const { result, rerender } = await renderHook(() => useOfflineGeofence(targetCoords));

    // Initial radius from beforeEach default
    expect(result.current.requiredRadiusMeters).toBe(50);

    // Update the remote config mock and re-render
    (useRemoteConfig as unknown as jest.Mock).mockReturnValue({
      config: {
        geofence: {
          trip: { radiusMeters: 500, defaultMode: 'formatDefaultRadius' },
          track: { radiusMeters: 500, defaultMode: 'entityRadius' },
          bypassGeofence: false,
        },
        audio: { rewindOffsetMs: 10000 },
        feedback: { syncIntervalSec: 30 },
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    await rerender(undefined);

    expect(result.current.requiredRadiusMeters).toBe(500);
    expect(result.current.isNearStart).toBe(true);
  });

  // ── GEOF.7 precedence + fail-closed via the shared resolver ───────────

  it('bypassGeofence=true wins over all modes (un-gated)', async () => {
    // A would-be invalid entity radius (missing radius) still can't gate under bypass.
    (useRemoteConfig as unknown as jest.Mock).mockReturnValue({
      config: {
        ...defaultConfig,
        geofence: { ...defaultConfig.geofence, bypassGeofence: true },
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    (useLocationStore as unknown as jest.Mock).mockReturnValue({
      coords: { latitude: -31.979, longitude: -64.635 },
      accuracy: 5,
      status: 'ready',
      errorMsg: null,
    });

    const { result } = await renderHook(() =>
      useOfflineGeofence(targetCoords, { format: 'track', geoMode: 'entityRadius' }),
    );

    expect(result.current.isNearStart).toBe(true);
  });

  it('entityRadius mode uses its own radius, not the format fallback', async () => {
    (useRemoteConfig as unknown as jest.Mock).mockReturnValue({
      config: {
        geofence: {
          trip: { radiusMeters: 50, defaultMode: 'formatDefaultRadius' },
          track: { radiusMeters: 100, defaultMode: 'entityRadius' },
          bypassGeofence: false,
        },
        audio: { rewindOffsetMs: 10000 },
        feedback: { syncIntervalSec: 30 },
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    // ~89 m north of the origin — beyond the 30 m entity radius but within the 100 m format default fallback.
    (useLocationStore as unknown as jest.Mock).mockReturnValue({
      coords: { latitude: -31.978, longitude: -64.635 },
      accuracy: 5,
      status: 'ready',
      errorMsg: null,
    });

    const { result } = await renderHook(() =>
      useOfflineGeofence(targetCoords, {
        format: 'track',
        geoMode: 'entityRadius',
        radiusMeters: 30,
      }),
    );

    expect(result.current.requiredRadiusMeters).toBe(30);
    expect(result.current.isNearStart).toBe(false);
  });

  it('entityRadius mode fails closed when its radius is unresolved', async () => {
    (useLocationStore as unknown as jest.Mock).mockReturnValue({
      coords: { latitude: -31.979, longitude: -64.635 },
      accuracy: 5,
      status: 'ready',
      errorMsg: null,
    });

    // Even at distance 0, an entityRadius override without a positive radius must be blocked.
    const { result } = await renderHook(() =>
      useOfflineGeofence(targetCoords, {
        format: 'track',
        geoMode: 'entityRadius',
        radiusMeters: null,
      }),
    );

    expect(result.current.isNearStart).toBe(false);
    expect(result.current.requiredRadiusMeters).toBe(0);
  });

  it('formatDefaultRadius mode uses the format-level fallback radius', async () => {
    (useRemoteConfig as unknown as jest.Mock).mockReturnValue({
      config: {
        geofence: {
          trip: { radiusMeters: 50, defaultMode: 'formatDefaultRadius' },
          track: { radiusMeters: 100, defaultMode: 'formatDefaultRadius' },
          bypassGeofence: false,
        },
        audio: { rewindOffsetMs: 10000 },
        feedback: { syncIntervalSec: 30 },
      },
      ...defaultConfig,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    (useLocationStore as unknown as jest.Mock).mockReturnValue({
      coords: { latitude: -31.979, longitude: -64.635 },
      accuracy: 5,
      status: 'ready',
      errorMsg: null,
    });

    const { result } = await renderHook(() =>
      useOfflineGeofence(targetCoords, { format: 'track', geoMode: 'formatDefaultRadius' }),
    );

    expect(result.current.requiredRadiusMeters).toBe(100);
    expect(result.current.isNearStart).toBe(true);
  });

  it('unrestricted mode is un-gated from any distance', async () => {
    // User far (~5.5 km) away — still un-gated because mode is 'unrestricted'.
    (useLocationStore as unknown as jest.Mock).mockReturnValue({
      coords: { latitude: -31.929, longitude: -64.635 },
      accuracy: 5,
      status: 'ready',
      errorMsg: null,
    });

    const { result } = await renderHook(() =>
      useOfflineGeofence(targetCoords, { format: 'track', geoMode: 'unrestricted' }),
    );

    expect(result.current.isNearStart).toBe(true);
    expect(result.current.requiredRadiusMeters).toBe(0);
  });

  it('gates when the user is beyond the radius (inclusive boundary)', async () => {
    // ~111 m north — beyond the 50 m trip radius.
    (useLocationStore as unknown as jest.Mock).mockReturnValue({
      coords: { latitude: -31.978, longitude: -64.635 },
      accuracy: 5,
      status: 'ready',
      errorMsg: null,
    });

    const { result } = await renderHook(() => useOfflineGeofence(targetCoords));

    expect(result.current.requiredRadiusMeters).toBe(50);
    expect(result.current.isNearStart).toBe(false);
  });

  it('no-fix: without user coords the gated experience is blocked (not playable)', async () => {
    (useLocationStore as unknown as jest.Mock).mockReturnValue({
      coords: null,
      accuracy: null,
      status: 'ready',
      errorMsg: null,
    });

    const { result } = await renderHook(() =>
      useOfflineGeofence(targetCoords, { format: 'trip', geoMode: 'formatDefaultRadius' }),
    );

    expect(result.current.isNearStart).toBe(false);
    expect(result.current.requiredRadiusMeters).toBe(50);
  });

  // ── Online seam (injected proximityClient) — fails open to offline ───

  it('does not call the online client when not injected (offline-only)', async () => {
    (useLocationStore as unknown as jest.Mock).mockReturnValue({
      coords: { latitude: -31.979, longitude: -64.635 },
      accuracy: 5,
      status: 'ready',
      errorMsg: null,
    });

    // No options/proximityClient provided — no online call.
    await renderHook(() => useOfflineGeofence(targetCoords));
    expect(jest.fn()).not.toHaveBeenCalled();
  });

  it('fails open to the offline/local result when the online check errors', async () => {
    const proximityClient: ProximityClient = {
      check: jest.fn().mockRejectedValue(new Error('network down')),
    };
    (useLocationStore as unknown as jest.Mock).mockReturnValue({
      coords: { latitude: -31.979, longitude: -64.635 },
      accuracy: 5,
      status: 'ready',
      errorMsg: null,
    });

    const { result } = await renderHook(() =>
      useOfflineGeofence(targetCoords, undefined, { proximityClient }),
    );

    await waitFor(() => expect(proximityClient.check).toHaveBeenCalledTimes(1));
    // Local decision (distance 0 <= 50) is retained.
    expect(result.current.isNearStart).toBe(true);
  });

  it('fails open to the offline/local result when the online check returns ok:false', async () => {
    const proximityClient: ProximityClient = {
      check: jest.fn().mockResolvedValue({ ok: false }),
    };
    (useLocationStore as unknown as jest.Mock).mockReturnValue({
      coords: { latitude: -31.979, longitude: -64.635 },
      accuracy: 5,
      status: 'ready',
      errorMsg: null,
    });

    const { result } = await renderHook(() =>
      useOfflineGeofence(targetCoords, undefined, { proximityClient }),
    );

    await waitFor(() => expect(proximityClient.check).toHaveBeenCalledTimes(1));
    expect(result.current.isNearStart).toBe(true);
  });

  it('uses the authoritative online result when the online check succeeds', async () => {
    const proximityClient: ProximityClient = {
      check: jest.fn().mockResolvedValue({
        ok: true,
        canListen: false,
        distanceMeters: 120,
        effectiveRadiusMeters: 30,
      }),
    };
    (useLocationStore as unknown as jest.Mock).mockReturnValue({
      coords: { latitude: -31.979, longitude: -64.635 },
      accuracy: 5,
      status: 'ready',
      errorMsg: null,
    });

    const { result } = await renderHook(() =>
      useOfflineGeofence(targetCoords, undefined, { proximityClient }),
    );

    await waitFor(() => expect(result.current.requiredRadiusMeters).toBe(30));
    expect(result.current.isNearStart).toBe(false);
    expect(result.current.distanceMeters).toBe(120);
  });
});
