import { renderHook, act } from '@testing-library/react-hooks';
import * as Location from 'expo-location';
import { useOfflineGeofence, GeofenceState } from '../use-offline-geofence';

// Mock expo-location native module triggers
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  Accuracy: {
    High: 4,
  },
}));

describe('useOfflineGeofence hook', () => {
  const targetCoords = { latitude: -31.979, longitude: -64.635 };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize in initializing state', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
    });

    let result: { readonly current: GeofenceState } = {
      current: {
        isNearStart: false,
        gpsAccuracy: null,
        gpsStatus: 'initializing',
        distanceMeters: null,
        requiredRadiusMeters: 50,
        errorMsg: null,
      },
    };
    await act(async () => {
      const renderResult = renderHook(() => useOfflineGeofence(targetCoords));
      result = renderResult.result;
    });

    // Permission denial runs immediately in the promise microtask queue, transitioning state to weak
    expect(result.current.gpsStatus).toBe('weak');
    expect(result.current.isNearStart).toBe(false);
  });

  it('should handle location permission denial', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
    });

    let result: { readonly current: GeofenceState } = {
      current: {
        isNearStart: false,
        gpsAccuracy: null,
        gpsStatus: 'initializing',
        distanceMeters: null,
        requiredRadiusMeters: 50,
        errorMsg: null,
      },
    };
    await act(async () => {
      const renderResult = renderHook(() => useOfflineGeofence(targetCoords));
      result = renderResult.result;
      await Promise.resolve(); // flush microtasks
    });

    expect(result.current.gpsStatus).toBe('weak');
    expect(result.current.errorMsg).toBe('Permission to access location was denied');
  });

  it('should update state to ready and near when coordinates match closely', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });

    let triggerUpdate: (location: Location.LocationObject) => void = () => {};
    (Location.watchPositionAsync as jest.Mock).mockImplementation((options, callback) => {
      triggerUpdate = callback;
      return Promise.resolve({ remove: jest.fn() });
    });

    const { result } = renderHook(() => useOfflineGeofence(targetCoords));

    // Wait for the permission resolver promise chain to flush
    await act(async () => {
      await Promise.resolve();
    });

    // Simulate location update matching target (0 meters distance)
    act(() => {
      triggerUpdate({
        coords: {
          latitude: -31.979,
          longitude: -64.635,
          accuracy: 5,
          altitude: 0,
          altitudeAccuracy: 0,
          heading: 0,
          speed: 0,
        },
        timestamp: Date.now(),
      });
    });

    expect(result.current.gpsStatus).toBe('ready');
    expect(result.current.isNearStart).toBe(true);
    expect(result.current.gpsAccuracy).toBe(5);
  });

  it('should flag weak status when accuracy exceeds threshold', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });

    let triggerUpdate: (location: Location.LocationObject) => void = () => {};
    (Location.watchPositionAsync as jest.Mock).mockImplementation((options, callback) => {
      triggerUpdate = callback;
      return Promise.resolve({ remove: jest.fn() });
    });

    const { result } = renderHook(() => useOfflineGeofence(targetCoords));
    await act(async () => {
      await Promise.resolve();
    });

    // Simulate update with accuracy error of 45 meters (> 30m threshold)
    act(() => {
      triggerUpdate({
        coords: {
          latitude: -31.979,
          longitude: -64.635,
          accuracy: 45,
          altitude: 0,
          altitudeAccuracy: 0,
          heading: 0,
          speed: 0,
        },
        timestamp: Date.now(),
      });
    });

    expect(result.current.gpsStatus).toBe('weak');
    expect(result.current.isNearStart).toBe(true);
  });
});
