import * as Location from 'expo-location';
import { create } from 'zustand';

import { logger } from '@/utils/logger';

export interface LocationState {
  coords: { latitude: number; longitude: number } | null;
  accuracy: number | null;
  status: 'initializing' | 'weak' | 'ready';
  errorMsg: string | null;
}

export interface LocationStore extends LocationState {
  startWatching: () => () => void;
}

export const useLocationStore = create<LocationStore>((set) => ({
  coords: null,
  accuracy: null,
  status: 'initializing',
  errorMsg: null,

  startWatching: () => {
    let subscription: Location.LocationSubscription | null = null;
    let isActive = true;

    async function start() {
      try {
        const { status: permissionStatus } = await Location.requestForegroundPermissionsAsync();
        if (permissionStatus !== 'granted') {
          if (isActive) {
            set({
              coords: null,
              accuracy: null,
              status: 'weak',
              errorMsg: 'Permission to access location was denied',
            });
          }
          return;
        }

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 5,
          },
          (location) => {
            if (!isActive) return;
            const { latitude, longitude, accuracy } = location.coords;
            const isWeak = accuracy !== null && accuracy > 30; // GPS_ACCURACY_THRESHOLD_METERS (30m)

            set({
              coords: { latitude, longitude },
              accuracy,
              status: isWeak ? 'weak' : 'ready',
              errorMsg: null,
            });
          },
        );
      } catch (err: unknown) {
        if (!isActive) return;
        const message = err instanceof Error ? err.message : 'Error tracking GPS signal';
        logger.error('LocationStore tracking error:', err);
        set({
          coords: null,
          accuracy: null,
          status: 'weak',
          errorMsg: message,
        });
      }
    }

    start();

    // Return cleanup function to unsub
    return () => {
      isActive = false;
      if (subscription) {
        subscription.remove();
      }
    };
  },
}));
