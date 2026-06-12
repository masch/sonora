import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { getHaversineDistance } from '@/utils/haversine';
import { logger } from '@/utils/logger';

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
const GPS_ACCURACY_THRESHOLD_METERS = 30;

export function useOfflineGeofence(
  targetCoords: {
    latitude: number;
    longitude: number;
  } | null,
): GeofenceState {
  // If targetCoords becomes null, clear target immediately during render to avoid synchronous setStates in useEffect
  const currentCoords = targetCoords;
  const isTargetNull = currentCoords === null;

  const [state, setState] = useState<GeofenceState>({
    isNearStart: false,
    gpsAccuracy: null,
    gpsStatus: 'initializing',
    distanceMeters: null,
    requiredRadiusMeters: GEOFENCE_RADIUS_METERS,
    userCoordinates: null,
    errorMsg: null,
  });

  useEffect(() => {
    if (isTargetNull) {
      logger.warn('useOfflineGeofence hook initialized or updated, but targetCoords is null');
      return;
    }

    let subscription: Location.LocationSubscription | null = null;

    async function startWatching() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setState((prev) => ({
            ...prev,
            gpsStatus: 'weak',
            userCoordinates: null,
            errorMsg: 'Permission to access location was denied',
          }));
          return;
        }

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 5,
          },
          (location) => {
            if (!targetCoords) {
              logger.warn(
                'watchPositionAsync received coordinate updates but targetCoords is null',
              );
              return;
            }

            const { latitude, longitude, accuracy } = location.coords;
            const distance = getHaversineDistance(
              latitude,
              longitude,
              targetCoords.latitude,
              targetCoords.longitude,
            );

            const isNear = distance <= GEOFENCE_RADIUS_METERS;
            const isWeak = accuracy !== null && accuracy > GPS_ACCURACY_THRESHOLD_METERS;

            setState({
              isNearStart: isNear,
              gpsAccuracy: accuracy,
              gpsStatus: isWeak ? 'weak' : 'ready',
              distanceMeters: distance,
              requiredRadiusMeters: GEOFENCE_RADIUS_METERS,
              userCoordinates: { latitude, longitude },
              errorMsg: null,
            });
          },
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error tracking GPS signal';
        setState((prev) => ({
          ...prev,
          gpsStatus: 'weak',
          userCoordinates: null,
          errorMsg: message,
        }));
      }
    }

    startWatching();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [isTargetNull, targetCoords]);

  return state;
}
