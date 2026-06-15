import { useLocationStore } from '@/store/location-store';
import { getHaversineDistance } from '@/utils/haversine';

export interface GeofenceState {
  isNearStart: boolean;
  gpsAccuracy: number | null;
  gpsStatus: 'initializing' | 'weak' | 'ready';
  distanceMeters: number | null;
  requiredRadiusMeters: number;
  userCoordinates: { latitude: number; longitude: number } | null;
  errorMsg: string | null;
}

const GEOFENCE_RADIUS_METERS = 50;

export function useOfflineGeofence(
  targetCoords: {
    latitude: number;
    longitude: number;
  } | null,
): GeofenceState {
  const { coords, accuracy, status, errorMsg } = useLocationStore();

  if (!targetCoords || !coords) {
    return {
      isNearStart: false,
      gpsAccuracy: accuracy,
      gpsStatus: status,
      distanceMeters: null,
      requiredRadiusMeters: GEOFENCE_RADIUS_METERS,
      userCoordinates: coords,
      errorMsg: errorMsg,
    };
  }

  const distance = getHaversineDistance(
    coords.latitude,
    coords.longitude,
    targetCoords.latitude,
    targetCoords.longitude,
  );

  const isNear = distance <= GEOFENCE_RADIUS_METERS;

  return {
    isNearStart: isNear,
    gpsAccuracy: accuracy,
    gpsStatus: status,
    distanceMeters: distance,
    requiredRadiusMeters: GEOFENCE_RADIUS_METERS,
    userCoordinates: coords,
    errorMsg: errorMsg,
  };
}
