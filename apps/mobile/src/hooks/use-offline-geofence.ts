import { APP_CONFIG } from '@/config/app-config';
import { useLocationStore } from '@/store/location-store';
import { getHaversineDistance } from '@/utils/haversine';

const { radiusMeters } = APP_CONFIG.geofence;

export interface GeofenceState {
  isNearStart: boolean;
  gpsAccuracy: number | null;
  gpsStatus: 'initializing' | 'weak' | 'ready';
  distanceMeters: number | null;
  requiredRadiusMeters: number;
  userCoordinates: { latitude: number; longitude: number } | null;
  errorMsg: string | null;
}

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
      requiredRadiusMeters: radiusMeters,
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

  const isNear = distance <= radiusMeters;

  return {
    isNearStart: isNear,
    gpsAccuracy: accuracy,
    gpsStatus: status,
    distanceMeters: distance,
    requiredRadiusMeters: radiusMeters,
    userCoordinates: coords,
    errorMsg: errorMsg,
  };
}
