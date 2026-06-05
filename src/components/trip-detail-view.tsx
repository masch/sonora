import { useState, useCallback } from 'react';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import AudioMediaControls from '@/components/audio-media-controls';
import DownloadProgressCard from '@/components/download-progress-card';
import FeedbackForm from '@/components/feedback-form';
import GpsPrecisionBadge from '@/components/gps-precision-badge';
import { ScreenWrapper, ScrollScreenWrapper } from '@/components/screen-wrapper';
import { ThemedText } from '@/components/themed-text';
import TripDetailMap from '@/components/trip-detail-map';
import { getTripById } from '@/data/trips';
import { useFeedbackTrigger } from '@/hooks/use-feedback-trigger';
import { useFeedbackQueue } from '@/hooks/use-feedback-queue';
import { useFeedbackSync } from '@/hooks/use-feedback-sync';
import { useImmersionPlayer } from '@/hooks/use-immersion-player';
import { useOfflineGeofence } from '@/hooks/use-offline-geofence';
import { useAppTranslation } from '@/hooks/use-translation';
import { useTripDownload } from '@/hooks/use-trip-download';
import { TwPressable, TwText, TwView } from '@/tw';
import type { FeedbackStatus } from '@/types/feedback';

const API_URL = 'https://sonora-api.YOUR-WORKER.workers.dev/feedback';

interface TripDetailViewProps {
  tripId: string;
}

// Web: fixed padding below the horizontal tab bar via Tailwind spacing
const CONTENT_PADDING = 'pt-16 pb-6';

/**
 * Shared trip detail view used by trips/[id].tsx (dynamic route).
 * Receives a concrete tripId instead of reading from route params.
 */
export default function TripDetailView({ tripId }: TripDetailViewProps) {
  const { t } = useAppTranslation();
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus | undefined>();
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [showManualFeedback, setShowManualFeedback] = useState(false);

  const trip = getTripById(tripId);

  // Hooks MUST be called unconditionally (rules-of-hooks)
  const geofence = useOfflineGeofence(trip?.startCoordinates ?? { latitude: 0, longitude: 0 });
  const download = useTripDownload(trip?.id ?? null, trip?.audioRemoteUrl ?? null);
  const player = useImmersionPlayer(download.localAudioUri);
  const feedbackTrigger = useFeedbackTrigger(trip ?? undefined, {
    didJustFinish: player.status === 'stopped',
    isNearStart: geofence.isNearStart,
  });
  const feedbackQueue = useFeedbackQueue();

  // Auto-sync feedback queue on connectivity restore
  useFeedbackSync();

  const handleFeedbackSubmit = useCallback(
    async (message: string) => {
      setFeedbackStatus('sending');
      setFeedbackError(null);

      // Resolve UUID inside callback to avoid capturing trip object in deps
      const currentTrip = getTripById(tripId);
      const tripUuid = currentTrip?.uuid ?? tripId;

      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripId: tripUuid,
            message,
            idempotencyKey:
              crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
            createdAt: new Date().toISOString(),
          }),
        });

        if (response.status === 201) {
          setFeedbackStatus('sent');
        } else {
          // Server error — queue offline
          await feedbackQueue.enqueue({ tripId: tripUuid, message });
          setFeedbackStatus('queued');
        }
      } catch {
        // Network error — queue offline
        try {
          await feedbackQueue.enqueue({ tripId: tripUuid, message });
          setFeedbackStatus('queued');
        } catch {
          setFeedbackStatus('error');
          setFeedbackError(t('feedback.form.error'));
        }
      }
    },
    [tripId, feedbackQueue, t],
  );

  const handleFeedbackDismiss = useCallback(() => {
    setFeedbackStatus(undefined);
    setFeedbackError(null);
    setShowManualFeedback(false);
    feedbackTrigger.dismiss();
  }, [feedbackTrigger]);

  if (!trip) {
    return (
      <ScreenWrapper>
        <TwView className="flex-1 items-center justify-center px-6">
          <Stack.Screen options={{ title: t('trips.notFound') }} />
          <ThemedText themeColor="text">{t('trips.notFound')}</ThemedText>
        </TwView>
      </ScreenWrapper>
    );
  }

  const showFeedbackForm =
    feedbackTrigger.showFeedback || showManualFeedback || feedbackStatus !== undefined;

  const innerView = (
    <TwView className="self-center w-full max-w-[800px] px-6 items-center gap-6">
      {/* Trip header */}
      <TwView className="items-center gap-2 pt-6">
        <ThemedText type="default" className="text-2xl font-bold text-center">
          {trip.title}
        </ThemedText>
        <ThemedText type="small" className="text-center">
          {t('trips.duration', { minutes: trip.durationMinutes })}
        </ThemedText>
      </TwView>

      <ThemedText type="default" className="text-center">
        {trip.description}
      </ThemedText>

      {/* Mini map */}
      <TripDetailMap
        latitude={trip.startCoordinates.latitude}
        longitude={trip.startCoordinates.longitude}
      />

      {/* GPS precision */}
      <GpsPrecisionBadge
        gpsStatus={geofence.gpsStatus}
        gpsAccuracy={geofence.gpsAccuracy}
        distanceMeters={geofence.distanceMeters}
        isNearStart={geofence.isNearStart}
        requiredRadiusMeters={geofence.requiredRadiusMeters}
      />

      {/* Download card */}
      <DownloadProgressCard
        status={download.status}
        progress={download.progress}
        errorMsg={download.errorMsg}
        onDownload={download.startDownload}
        onDelete={download.deleteTripLocal}
      />

      {/* Audio player — only shown when download completed */}
      {download.status === 'completed' ? (
        <AudioMediaControls
          status={player.status}
          positionMs={player.positionMs}
          durationMs={player.durationMs}
          errorMsg={player.errorMsg}
          onPlay={player.play}
          onPause={player.pause}
          onStop={player.stop}
          disabled={!download.localAudioUri}
        />
      ) : download.status === 'downloading' ? (
        <TwView className="bg-backgroundElement gap-2 self-stretch p-4 rounded-[24px] items-center">
          <TwText className="text-sm text-zinc-400">{t('index.waitingForDownload')}</TwText>
        </TwView>
      ) : null}

      {/* Manual feedback button (when feedbackTrigger is 'manual') */}
      {trip.feedbackTrigger === 'manual' && (
        <TwView className="self-stretch">
          <TwView className="bg-violet-600 rounded-xl overflow-hidden">
            <TwPressable
              accessibilityLabel={t('feedback.form.title')}
              testID="feedback-manual-button"
              className="py-3 items-center active:opacity-80"
              onPress={() => setShowManualFeedback(true)}
            >
              <TwText className="text-white font-bold text-sm">{t('feedback.form.title')}</TwText>
            </TwPressable>
          </TwView>
        </TwView>
      )}
    </TwView>
  );

  return (
    <TwView className="flex-1">
      <Stack.Screen options={{ title: trip.title }} />
      {Platform.OS === 'web' ? (
        <ScreenWrapper>
          <TwView className={`${CONTENT_PADDING} flex-1`}>{innerView}</TwView>
        </ScreenWrapper>
      ) : (
        <ScrollScreenWrapper contentContainerClassName={CONTENT_PADDING}>
          {innerView}
        </ScrollScreenWrapper>
      )}

      {/* Feedback form modal */}
      <FeedbackForm
        visible={showFeedbackForm}
        onSubmit={handleFeedbackSubmit}
        onDismiss={handleFeedbackDismiss}
        status={feedbackStatus}
        errorMsg={feedbackError}
      />
    </TwView>
  );
}
