import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import LoadingView from '@/components/loading-view';
import { ScrollScreenWrapper } from '@/components/screen-wrapper';
import { ThemedText } from '@/components/themed-text';
import TrackDetailView from '@/components/track-detail-view';
import TripDetailView from '@/components/trip-detail-view';
import { SONORA_TRACKS_BG, SONORA_TRIP_BG } from '@/constants/images';
import { fetchExperiences, isPlayableExperience, type Experience } from '@/data/experiences';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useAppTranslation } from '@/hooks/use-translation';
import { TwPressable, TwView } from '@/tw';
import { logger } from '@/utils/logger';

const CONTENT_PADDING = 'pb-6';

export default function TrackDetailScreen() {
  const { id, title: initialTitle } = useLocalSearchParams<{ id: string; title?: string }>();
  const { t } = useAppTranslation();
  const colors = useThemeColors();

  const [state, setState] = useState<{
    track: Experience | null;
    loading: boolean;
    error: boolean;
    prevId: string;
  }>({
    track: null,
    loading: true,
    error: false,
    prevId: id,
  });

  // Sync state on render if ID changes (no ref.current access during render)
  if (id !== state.prevId) {
    setState({
      track: null,
      loading: true,
      error: false,
      prevId: id,
    });
  }

  useEffect(() => {
    let active = true;

    fetchExperiences()
      .then((list) => {
        if (!active) return;
        const found = list.find((e) => e.slug === id || e.id === id);
        setState((prev) => ({
          ...prev,
          track: found ?? null,
          loading: false,
        }));
      })
      .catch((err) => {
        if (!active) return;
        logger.error('[DETAIL] Failed to fetch experience:', err);
        setState((prev) => ({
          ...prev,
          error: true,
          loading: false,
        }));
      });

    return () => {
      active = false;
    };
  }, [id]);

  const { track, loading, error } = state;
  const [refreshingExperience, setRefreshingExperience] = useState(false);

  // After a successful purchase the fetched experience may predate the
  // payment, so it has no signed audioUrl. Re-fetch so the backend can
  // include the audio link now that the purchase is approved (the client is
  // network-first, so this also refreshes the shared list cache).
  const handlePurchased = async () => {
    setRefreshingExperience(true);
    try {
      const list = await fetchExperiences();
      const found = list.find((e) => e.slug === id || e.id === id);
      if (found) {
        setState((prev) => ({ ...prev, track: found }));
      }
      setRefreshingExperience(false);
    } catch (err) {
      logger.error('[DETAIL] Failed to refresh experience after purchase:', err);
      setRefreshingExperience(false);
    }
  };

  const handleRetry = () => {
    setState((prev) => ({
      ...prev,
      loading: true,
      error: false,
    }));
    fetchExperiences()
      .then((list) => {
        const found = list.find((e) => e.slug === id || e.id === id);
        setState((prev) => ({
          ...prev,
          track: found ?? null,
          loading: false,
        }));
      })
      .catch((err) => {
        logger.error('[DETAIL] Failed to fetch experience:', err);
        setState((prev) => ({
          ...prev,
          error: true,
          loading: false,
        }));
      });
  };

  if (error) {
    return (
      <TwView className="flex-grow items-center justify-center p-6 bg-background">
        <ThemedText className="text-base font-bold text-text mb-4 text-center">
          {t('experiences.errorLoading')}
        </ThemedText>
        <TwPressable
          onPress={handleRetry}
          className="px-6 py-2.5 bg-text rounded-xl active:opacity-75"
          testID="track-detail-retry-button"
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
    return (
      <>
        <Stack.Screen
          options={
            initialTitle
              ? { title: initialTitle }
              : { headerTitle: () => <ActivityIndicator size="small" /> }
          }
        />
        <LoadingView message={t('map.loadingMap')} />
      </>
    );
  }

  if (!track || !isPlayableExperience(track)) {
    return (
      <TwView className="flex-grow items-center justify-center px-6">
        <Stack.Screen options={{ title: t('experiences.notFound') }} />
        <ThemedText themeColor="text">{t('experiences.notFound')}</ThemedText>
      </TwView>
    );
  }

  const isTrip = track.format === 'trip';

  return (
    <>
      <Stack.Screen
        options={{
          title: track.title,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
        }}
      />
      <ScrollScreenWrapper
        withTabBar={false}
        disableBottomPadding
        backgroundImage={isTrip ? SONORA_TRIP_BG : SONORA_TRACKS_BG}
        contentContainerClassName={isTrip ? CONTENT_PADDING : 'grow'}
      >
        {isTrip ? (
          <TripDetailView
            key={track.id}
            track={track}
            showGPSDetails={false}
            onPurchased={handlePurchased}
            refreshingExperience={refreshingExperience}
          />
        ) : (
          <TrackDetailView
            key={track.id}
            track={track}
            onPurchased={handlePurchased}
            refreshingExperience={refreshingExperience}
          />
        )}
      </ScrollScreenWrapper>
    </>
  );
}
