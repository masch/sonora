import { renderHook } from '@testing-library/react-hooks';
import { useOfflineGeofence } from '../use-offline-geofence';
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

  const defaultConfig = {
    geofence: { radiusMeters: 50 },
    bypassGeofence: false,
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

  it('should initialize in initializing state', () => {
    (useLocationStore as unknown as jest.Mock).mockReturnValue({
      coords: null,
      accuracy: null,
      status: 'initializing',
      errorMsg: null,
    });

    const { result } = renderHook(() => useOfflineGeofence(targetCoords));

    expect(result.current.gpsStatus).toBe('initializing');
    expect(result.current.isNearStart).toBe(false);
    expect(result.current.userCoordinates).toBeNull();
    expect(result.current.requiredRadiusMeters).toBe(50);
  });

  it('should handle location permission denial', () => {
    (useLocationStore as unknown as jest.Mock).mockReturnValue({
      coords: null,
      accuracy: null,
      status: 'weak',
      errorMsg: 'Permission to access location was denied',
    });

    const { result } = renderHook(() => useOfflineGeofence(targetCoords));

    expect(result.current.gpsStatus).toBe('weak');
    expect(result.current.errorMsg).toBe('Permission to access location was denied');
  });

  it('should update state to ready and near when coordinates match closely', () => {
    (useLocationStore as unknown as jest.Mock).mockReturnValue({
      coords: { latitude: -31.979, longitude: -64.635 },
      accuracy: 5,
      status: 'ready',
      errorMsg: null,
    });

    const { result } = renderHook(() => useOfflineGeofence(targetCoords));

    expect(result.current.gpsStatus).toBe('ready');
    expect(result.current.isNearStart).toBe(true);
    expect(result.current.gpsAccuracy).toBe(5);
    expect(result.current.userCoordinates).toEqual({ latitude: -31.979, longitude: -64.635 });
  });

  it('should flag weak status when accuracy exceeds threshold', () => {
    (useLocationStore as unknown as jest.Mock).mockReturnValue({
      coords: { latitude: -31.979, longitude: -64.635 },
      accuracy: 45,
      status: 'weak',
      errorMsg: null,
    });

    const { result } = renderHook(() => useOfflineGeofence(targetCoords));

    expect(result.current.gpsStatus).toBe('weak');
    expect(result.current.isNearStart).toBe(true);
  });

  it('should use geofence radius from useRemoteConfig', () => {
    (useRemoteConfig as unknown as jest.Mock).mockReturnValue({
      config: {
        geofence: { radiusMeters: 200 },
        bypassGeofence: false,
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

    const { result } = renderHook(() => useOfflineGeofence(targetCoords));

    expect(result.current.requiredRadiusMeters).toBe(200);
    expect(result.current.isNearStart).toBe(true);
  });

  it('should update geofence radius when remote config changes between renders', () => {
    (useLocationStore as unknown as jest.Mock).mockReturnValue({
      coords: { latitude: -31.979, longitude: -64.635 },
      accuracy: 5,
      status: 'ready',
      errorMsg: null,
    });

    const { result, rerender } = renderHook(() => useOfflineGeofence(targetCoords));

    // Initial radius from beforeEach default
    expect(result.current.requiredRadiusMeters).toBe(50);

    // Update the remote config mock and re-render
    (useRemoteConfig as unknown as jest.Mock).mockReturnValue({
      config: {
        geofence: { radiusMeters: 500 },
        bypassGeofence: false,
        audio: { rewindOffsetMs: 10000 },
        feedback: { syncIntervalSec: 30 },
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    rerender();

    expect(result.current.requiredRadiusMeters).toBe(500);
    expect(result.current.isNearStart).toBe(true);
  });
});
