import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { useLocationStore } from '@/store/location-store';

import { TAB_BAR_INSET } from '@/components/screen-wrapper';
import LoadingView from '@/components/loading-view';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import {
  TRACK_IMAGES,
  DEFAULT_TRACK_IMAGE,
  SONORA_LOGO,
  SONORA_BANNER_BG,
  SONORA_INSTRUCTIONS_BG,
} from '@/constants/images';
import { fetchExperiences, type Experience } from '@/data/experiences';
import { useAppTranslation } from '@/hooks/use-translation';
import type { TranslationKeys } from '@/i18n/types';
import { TwPressable, TwView } from '@/tw';
import { TwImage } from '@/tw/image';
import { getHaversineDistance } from '@/utils/haversine';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { logger } from '@/utils/logger';

function formatDistance(
  meters: number,
  t: (key: TranslationKeys, params?: Record<string, unknown>) => string,
): string {
  if (meters >= 1000) {
    return t('map.distanceKilometers', { value: (meters / 1000).toFixed(1) });
  }
  return t('map.distanceMeters', { value: Math.round(meters) });
}

export default function TrackMap() {
  const router = useRouter();
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const [tracks, setTracks] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const currentLocation = useLocationStore((state) => state.coords);
  const [showInstructionsOverlay, setShowInstructionsOverlay] = useState(false);

  const loadData = async () => {
    try {
      const list = await fetchExperiences();
      setTracks(list);
      setError(false);
    } catch (err) {
      logger.error('[MAP] Failed to fetch experiences:', err);
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    // Initial data load — setState in .then/.catch callbacks is async, not synchronous
    fetchExperiences()
      .then((list) => {
        setTracks(list);
        setError(false);
      })
      .catch((err) => {
        logger.error('[MAP] Failed to fetch experiences:', err);
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (error) {
    return (
      <TwView className="flex-grow items-center justify-center p-6 bg-background">
        <ThemedText className="text-base font-bold text-text mb-4 text-center">
          {t('experiences.errorLoading')}
        </ThemedText>
        <TwPressable
          onPress={loadData}
          className="px-6 py-2.5 bg-text rounded-xl active:opacity-75"
          testID="track-map-retry-button"
          accessibilityLabel={t('experiences.retry')}
        >
          <ThemedText themeColor="background" className="font-semibold">
            {t('experiences.retry')}
          </ThemedText>
        </TwPressable>
      </TwView>
    );
  }

  if (loading) {
    return <LoadingView message={t('map.loadingMap')} />;
  }

  if (tracks.length === 0) {
    return (
      <TwView className="flex-grow items-center justify-center p-6">
        <ThemedText>{t('map.noTracksTitle')}</ThemedText>
      </TwView>
    );
  }

  const cardDistance = (track: Experience): string | null => {
    if (!currentLocation) return null;
    const dist = getHaversineDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      track.latitude,
      track.longitude,
    );
    return formatDistance(dist, t);
  };

  return (
    <TwView className="flex-1">
      {/* Top Banner */}
      <TwView className="relative w-full h-48 overflow-hidden items-center justify-center bg-zinc-950">
        <TwImage
          source={SONORA_BANNER_BG}
          className="absolute inset-0 w-full h-full"
          contentFit="cover"
          alt=""
        />
        <TwPressable
          onPress={() => setShowInstructionsOverlay(true)}
          accessibilityLabel={t('map.instructionsTitle')}
          testID="show-instructions"
          className="size-40 items-center justify-center z-10"
        >
          <TwImage source={SONORA_LOGO} className="w-full h-full" contentFit="contain" alt="" />
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
        style={Platform.OS === 'ios' ? { paddingBottom: TAB_BAR_INSET } : undefined}
      >
        {/* Instructions Card */}
        <TwView className="relative overflow-hidden rounded-[24px] card-container-solid shadow-md backdrop-blur-md z-10">
          <TwImage
            source={SONORA_INSTRUCTIONS_BG}
            className="w-full h-44"
            contentFit="cover"
            alt=""
          />
          <TwView className="flex-row items-center justify-between p-4 bg-white/40 dark:bg-zinc-800/40">
            <TwView className="flex-row items-center gap-4 flex-1">
              <TwView className="flex-row items-center gap-1.5">
                <Icon
                  ios="clock"
                  android="access_time"
                  web="access_time"
                  size={16}
                  tintColor={colors.textSecondary}
                />
                <ThemedText className="text-[12px] font-bold text-zinc-700 dark:text-zinc-300">
                  {t('map.instructionDuration')}
                </ThemedText>
              </TwView>

              <TwView className="flex-row items-center gap-1.5 flex-1">
                <Icon
                  ios="person"
                  android="person"
                  web="person"
                  size={16}
                  tintColor={colors.textSecondary}
                />
                <TwView className="flex-1">
                  <ThemedText className="text-[14px] font-extrabold text-zinc-800 dark:text-zinc-100 leading-tight">
                    {t('map.instructionsTitle')}
                  </ThemedText>
                  <ThemedText className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 leading-none">
                    {t('map.instructionsSub')}
                  </ThemedText>
                </TwView>
              </TwView>
            </TwView>

            <TwView className="size-10 rounded-full bg-emerald-500 items-center justify-center shadow-sm active:opacity-80">
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
        <TwView className="rounded-[24px] card-container-solid p-4 shadow-md backdrop-blur-md gap-4 z-10">
          <ThemedText className="text-base font-black text-zinc-800 dark:text-zinc-100 tracking-wider">
            {t('map.tracksTitle')}
          </ThemedText>

          <TwView className="flex-col gap-3">
            {tracks.map((track) => {
              const trackImage = TRACK_IMAGES[track.imageKey] || DEFAULT_TRACK_IMAGE;
              const dist = cardDistance(track);

              return (
                <TwPressable
                  key={track.id}
                  testID={`view-track-${track.slug}`}
                  accessibilityLabel={t('map.viewTrack', { title: track.title })}
                  onPress={() =>
                    router.push(`/tracks/${track.id}?title=${encodeURIComponent(track.title)}`)
                  }
                  className="active:opacity-75 mb-1"
                >
                  <TwView className="flex-row items-center justify-between p-3 rounded-xl card-container">
                    <TwImage
                      source={trackImage}
                      className="size-16 rounded-xl mr-3"
                      contentFit="cover"
                      alt=""
                    />

                    <TwView className="flex-1 justify-center mr-1">
                      <ThemedText
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.5}
                        className="text-[12px] font-extrabold text-zinc-800 dark:text-zinc-100 leading-tight"
                      >
                        {track.title}
                      </ThemedText>
                      <ThemedText className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mt-1">
                        {Math.round(track.durationSeconds / 60)} {t('experiences.minAbbr')}
                        {track.format === 'trip' && track.waypoints
                          ? ` · ${t('experiences.sectionsCount', { count: track.waypoints.length })}`
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

                    <TwView className="flex-row items-center gap-2">
                      <TwView className="items-center">
                        {track.priceLabel && (
                          <ThemedText className="text-[9px] font-black text-zinc-800 dark:text-zinc-100 mb-0.5 tracking-tighter">
                            {track.priceLabel}
                          </ThemedText>
                        )}
                        <TwView className="size-10 rounded-full bg-emerald-500 items-center justify-center shadow-sm">
                          <Icon
                            ios="arrow.down"
                            android="arrow_downward"
                            web="arrow_downward"
                            size={18}
                            tintColor="#ffffff"
                          />
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
