import { renderHook } from '@testing-library/react-hooks';
import { useOfflineGeofence } from '../use-offline-geofence';
import { useLocationStore } from '@/store/location-store';

// Mock the Zustand store hook
jest.mock('@/store/location-store', () => ({
  useLocationStore: jest.fn(),
}));

describe('useOfflineGeofence hook', () => {
  const targetCoords = { latitude: -31.979, longitude: -64.635 };

  beforeEach(() => {
    jest.clearAllMocks();
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
});
