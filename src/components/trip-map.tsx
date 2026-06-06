import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { TAB_BAR_INSET } from '@/components/screen-wrapper';

import { ThemedText } from '@/components/themed-text';
import { getAllTrips } from '@/data/trips';
import { useAppTranslation } from '@/hooks/use-translation';
import type { TranslationKeys } from '@/i18n/types';
import { TwPressable, TwView } from '@/tw';
import { TwImage } from '@/tw/image';
import { Icon } from '@/components/icon';
import { getHaversineDistance } from '@/utils/haversine';

const bannerBg = require('@/assets/images/sonora/banner-fondo-logo-1.png');
const logoImg = require('@/assets/images/sonora/logo.png');
const mainBg = require('@/assets/images/sonora/fondo-recorridos-sec-1.png');
const instructionsBg = require('@/assets/images/sonora/cover-instrucciones-1.png');

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
  const [showInstructionsOverlay, setShowInstructionsOverlay] = useState(false);

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
      <TwView className="flex-grow items-center justify-center p-6">
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
    <TwView className="flex-1">
      {/* Top Banner */}
      <TwView className="relative w-full h-48 overflow-hidden items-center justify-center bg-zinc-950">
        <TwImage
          source={bannerBg}
          className="absolute inset-0 w-full h-full"
          contentFit="cover"
          alt=""
        />
        <TwPressable
          onPress={() => setShowInstructionsOverlay(true)}
          accessibilityLabel={t('map.instructionsTitle')}
          testID="show-instructions"
          className="w-40 h-40 items-center justify-center z-10"
        >
          <TwImage source={logoImg} className="w-full h-full" contentFit="contain" alt="" />
        </TwPressable>
        <TwView className="absolute top-4 right-4 bg-white/20 p-2 rounded-full backdrop-blur-md">
          <Icon
            ios="speaker.wave.2.fill"
            android="volume_up"
            web="volume_up"
            size={18}
            tintColor="#000000"
          />
        </TwView>

        {/* Dynamic Opaque Instructions Overlay */}
        {showInstructionsOverlay && (
          <TwPressable
            onPress={() => setShowInstructionsOverlay(false)}
            accessibilityLabel={t('common.dismiss')}
            testID="dismiss-instructions"
            className="absolute inset-[12px] rounded-[24px] items-center justify-center px-5 py-3 z-30 bg-[rgba(38,30,43,0.94)] border-[1.5px] border-[rgba(255,255,255,0.06)]"
          >
            <ThemedText className="text-center font-bold text-zinc-100 text-[10px] leading-relaxed uppercase tracking-wider">
              {t('map.overlayTitle')}
            </ThemedText>
          </TwPressable>
        )}
      </TwView>

      {/* Main Content Area */}
      <TwView
        className="relative flex-1 gap-3 p-4"
        style={{ paddingBottom: TAB_BAR_INSET }}
      >
        <TwImage
          source={mainBg}
          className="absolute inset-0 w-full h-full"
          contentFit="cover"
          alt=""
        />
        {/* Instructions Card */}
        <TwView className="relative overflow-hidden rounded-[24px] bg-white/80 shadow-md backdrop-blur-md z-10">
          <TwImage source={instructionsBg} className="w-full h-44" contentFit="cover" alt="" />
          <TwView className="flex-row items-center justify-between p-4 bg-white/40">
            <TwView className="flex-row items-center gap-4 flex-1">
              <TwView className="flex-row items-center gap-1.5">
                <Icon
                  ios="clock"
                  android="access_time"
                  web="access_time"
                  size={16}
                  tintColor="#444444"
                />
                <ThemedText className="text-[12px] font-bold text-zinc-700">
                  {t('map.instructionDuration')}
                </ThemedText>
              </TwView>

              <TwView className="flex-row items-center gap-1.5 flex-1">
                <Icon ios="person" android="person" web="person" size={16} tintColor="#444444" />
                <TwView className="flex-1">
                  <ThemedText className="text-[14px] font-extrabold text-zinc-800 leading-tight">
                    {t('map.instructionsTitle')}
                  </ThemedText>
                  <ThemedText className="text-[10px] font-semibold text-zinc-600 leading-none">
                    {t('map.instructionsSub')}
                  </ThemedText>
                </TwView>
              </TwView>
            </TwView>

            <TwView className="w-10 h-10 rounded-full bg-emerald-500 items-center justify-center shadow-sm active:opacity-80">
              <Icon
                ios="play.fill"
                android="play_arrow"
                web="play_arrow"
                size={18}
                tintColor="#ffffff"
              />
            </TwView>
          </TwView>
        </TwView>

        {/* Recorridos List Container */}
        <TwView className="rounded-[24px] bg-white/80 p-4 shadow-md backdrop-blur-md gap-4 z-10">
          <ThemedText className="text-base font-black text-zinc-800 tracking-wider">
            {t('map.tripsTitle')}
          </ThemedText>

          <TwView className="flex-col gap-3">
            {trips.map((trip, idx) => {
              const tripImage =
                trip.imageKey === 'deriva-centro'
                  ? require('@/assets/images/sonora/deriva-centro.png')
                  : require('@/assets/images/sonora/bonus-track.png');

              const dist = cardDistance(trip);

              return (
                <TwPressable
                  key={trip.id}
                  testID={`view-trip-${trip.id}`}
                  accessibilityLabel={t('map.viewTrip', { title: trip.title })}
                  onPress={() => router.push(`/trips/${trip.id}`)}
                  className="active:opacity-75 mb-1"
                >
                  <TwView className="flex-row items-center justify-between p-3 rounded-xl bg-white/50 border border-zinc-200/30">
                    {/* Left Cover Image */}
                    <TwImage
                      source={tripImage}
                      className="w-16 h-16 rounded-xl mr-3"
                      contentFit="cover"
                      alt=""
                    />

                    {/* Center details */}
                    <TwView className="flex-1 justify-center mr-1">
                      <ThemedText
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.5}
                        className="text-[12px] font-extrabold text-zinc-800 leading-tight"
                      >
                        {trip.title}
                      </ThemedText>
                      <ThemedText className="text-[11px] font-bold text-zinc-600 mt-1">
                        {trip.durationMinutes} {t('trips.minAbbr')} ·{' '}
                        {trip.sectionsCount
                          ? `${t('trips.sectionsCount', { count: trip.sectionsCount })} · `
                          : ''}
                        {trip.typeLabel ? `${trip.typeLabel}` : ''}
                        {trip.distanceMeters && trip.distanceMeters > 0
                          ? `${trip.distanceMeters}${t('trips.metersAbbr')}`
                          : ''}
                      </ThemedText>
                      {dist && (
                        <ThemedText
                          themeColor="textSecondary"
                          type="small"
                          className="text-[9px] mt-0.5"
                        >
                          {t('map.distanceFromYou', { distance: dist })}
                        </ThemedText>
                      )}
                    </TwView>

                    {/* Right action/price */}
                    <TwView className="flex-row items-center gap-2">
                      {trip.distanceMeters !== undefined && trip.distanceMeters === 0 && (
                        <ThemedText className="text-[11px] font-black text-zinc-700">
                          {t('map.zeroDistance')}
                        </ThemedText>
                      )}
                      <TwView className="items-center">
                        {trip.priceLabel && (
                          <ThemedText className="text-[9px] font-black text-zinc-800 mb-0.5 tracking-tighter">
                            {trip.priceLabel}
                          </ThemedText>
                        )}
                        <TwView className="w-10 h-10 rounded-full bg-emerald-500 items-center justify-center shadow-sm">
                          {trip.isDownloadable ? (
                            <Icon
                              ios="arrow.down"
                              android="arrow_downward"
                              web="arrow_downward"
                              size={18}
                              tintColor="#ffffff"
                            />
                          ) : (
                            <Icon
                              ios="play.fill"
                              android="play_arrow"
                              web="play_arrow"
                              size={18}
                              tintColor="#ffffff"
                            />
                          )}
                        </TwView>
                      </TwView>
                    </TwView>
                  </TwView>
                </TwPressable>
              );
            })}
          </TwView>
        </TwView>
      </TwView>
    </TwView>
  );
}
