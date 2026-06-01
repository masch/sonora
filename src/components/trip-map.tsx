import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import * as Location from 'expo-location';

import { useAppTranslation } from '@/hooks/use-translation';
import type { TranslationKeys } from '@/i18n/types';
import { getAllTrips } from '@/data/trips';
import { getHaversineDistance } from '@/utils/haversine';
import { ThemedText } from '@/components/themed-text';
import { ScrollScreenWrapper } from '@/components/screen-wrapper';
import { TwView } from '@/tw';

interface Coords {
  latitude: number;
  longitude: number;
}

function formatDistance(
  meters: number,
  t: (key: TranslationKeys, params?: Record<string, unknown>) => string,
): string {
  if (meters >= 1000) {
    return t('map.distanceKilometers', { value: (meters / 1000).toFixed(1) });
  }
  return t('map.distanceMeters', { value: Math.round(meters) });
}

/**
 * Native fallback for the explore map.
 *
 * react-native-maps (MapView) requires a Google Maps API key on Android.
 * Since the map experience lives on the web version with Leaflet (free, no
 * API key), this native version shows a clean trip list with distances.
 */
export default function TripMap() {
  const router = useRouter();
  const { t } = useAppTranslation();
  const trips = getAllTrips();
  const [currentLocation, setCurrentLocation] = useState<Coords | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function getLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!cancelled) {
          setCurrentLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      } catch {
        // Silently ignore — no location, no distance shown
      }
    }

    getLocation();

    return () => {
      cancelled = true;
    };
  }, []);

  if (trips.length === 0) {
    return (
      <TwView className="flex-1 items-center justify-center">
        <ThemedText>{t('map.noTripsTitle')}</ThemedText>
      </TwView>
    );
  }

  const cardDistance = (trip: (typeof trips)[number]): string | null => {
    if (!currentLocation) return null;
    const dist = getHaversineDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      trip.startCoordinates.latitude,
      trip.startCoordinates.longitude,
    );
    return formatDistance(dist, t);
  };

  return (
    <ScrollScreenWrapper>
      <TwView className="gap-4 p-4">
        <TwView className="items-center">
          <ThemedText themeColor="textSecondary" className="text-center">
            {t('map.offlineDescription')}
          </ThemedText>
        </TwView>

        {trips.map((trip) => {
          const dist = cardDistance(trip);
          return (
            <Pressable
              key={trip.id}
              testID={`view-trip-${trip.id}`}
              accessibilityLabel={t('map.viewTrip', { title: trip.title })}
              onPress={() => router.push(`/trips/${trip.id}`)}
            >
              <TwView className="rounded-xl bg-backgroundElement p-4 gap-1">
                <ThemedText className="text-lg font-semibold">{trip.title}</ThemedText>
                <ThemedText themeColor="textSecondary">
                  {t('trips.duration', { minutes: trip.durationMinutes })}
                </ThemedText>
                {dist && (
                  <ThemedText themeColor="textSecondary" type="small">
                    {t('map.distanceFromYou', { distance: dist })}
                  </ThemedText>
                )}
              </TwView>
            </Pressable>
          );
        })}
      </TwView>
    </ScrollScreenWrapper>
  );
}
