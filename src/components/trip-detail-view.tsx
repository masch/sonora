import { useState, useEffect, useRef } from 'react';
import { Stack } from 'expo-router';

import FeedbackForm from '@/components/feedback-form';
import GpsPrecisionBadge from '@/components/gps-precision-badge';
import { ThemedText } from '@/components/themed-text';
import TripDetailMap from '@/components/trip-detail-map';
import UnifiedAudioController from '@/components/unified-audio-controller';
import { APP_CONFIG } from '@/config/app-config';
import { getTripById } from '@/data/trips';
import { useFeedbackTrigger } from '@/hooks/use-feedback-trigger';
import { useFeedbackQueue } from '@/hooks/use-feedback-queue';
import { useFeedbackSync } from '@/hooks/use-feedback-sync';
import { useImmersionPlayer } from '@/hooks/use-immersion-player';
import { useOfflineGeofence } from '@/hooks/use-offline-geofence';
import { useAppTranslation } from '@/hooks/use-translation';
import { useTripDownload } from '@/hooks/use-trip-download';
import { TwPressable, TwView } from '@/tw';
import { TwImage } from '@/tw/image';
import { Icon } from '@/components/icon';
import type { FeedbackStatus } from '@/types/feedback';

const mainBg = require('@/assets/images/sonora/fondo-recorridos-sec-1.png');

const API_URL = 'https://sonora-api.YOUR-WORKER.workers.dev/feedback';

interface TripDetailViewProps {
  tripId: string;
  isWeb: boolean;
}

/**
 * Shared trip detail view used by trips/[id].tsx (dynamic route).
 * Receives a concrete tripId instead of reading from route params.
 */
export default function TripDetailView({ tripId, isWeb }: TripDetailViewProps) {
  const { t } = useAppTranslation();
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus | undefined>();
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [showManualFeedback, setShowManualFeedback] = useState(false);
  const userInitiatedPlayRef = useRef(false);

  const trip = getTripById(tripId);

  // Hooks MUST be called unconditionally (rules-of-hooks)
  const geofence = useOfflineGeofence(trip?.startCoordinates ?? { latitude: 0, longitude: 0 });
  const download = useTripDownload(trip?.id ?? null, trip?.audioRemoteUrl ?? null);
  const player = useImmersionPlayer(download.localAudioUri);

  // Auto-play when download completes if the user initiated it
  useEffect(() => {
    if (download.status === 'completed' && userInitiatedPlayRef.current && download.localAudioUri) {
      userInitiatedPlayRef.current = false;
      player.play();
    }
  }, [download.status, download.localAudioUri, player]);

  const handlePlayAndDownload = () => {
    userInitiatedPlayRef.current = true;
    download.startDownload();
  };
  const feedbackTrigger = useFeedbackTrigger(trip ?? undefined, {
    didJustFinish: player.status === 'stopped',
    isNearStart: geofence.isNearStart,
  });
  const feedbackQueue = useFeedbackQueue();

  // Auto-sync feedback queue on connectivity restore
  useFeedbackSync();

  const handleFeedbackSubmit = async (message: string) => {
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
  };

  const handleFeedbackDismiss = () => {
    setFeedbackStatus(undefined);
    setFeedbackError(null);
    setShowManualFeedback(false);
    feedbackTrigger.dismiss();
  };

  if (!trip) {
    return (
      <TwView className="flex-grow items-center justify-center px-6">
        <Stack.Screen options={{ title: t('trips.notFound') }} />
        <ThemedText themeColor="text">{t('trips.notFound')}</ThemedText>
      </TwView>
    );
  }

  const tripImage =
    trip.imageKey === 'deriva-centro'
      ? require('@/assets/images/sonora/deriva-centro.png')
      : require('@/assets/images/sonora/bonus-track.png');

  const showFeedbackForm =
    feedbackTrigger.showFeedback || showManualFeedback || feedbackStatus !== undefined;

  const innerView = (
    <TwView className="flex-1">
      {/* Top Banner */}
      <TwView className="relative w-full h-48 overflow-hidden items-center justify-center bg-zinc-950">
        <TwImage
          source={tripImage}
          className="absolute inset-0 w-full h-full"
          contentFit="cover"
          alt=""
        />
        <TwView className="absolute top-4 right-4 bg-white/20 p-2 rounded-full backdrop-blur-md">
          <Icon
            ios="speaker.wave.2.fill"
            android="volume_up"
            web="volume_up"
            size={18}
            tintColor="#000000"
          />
        </TwView>
      </TwView>

      {/* Main Content Area */}
      <TwView className="relative flex-1 gap-4 p-4">
        <TwImage source={mainBg} className="absolute inset-0" contentFit="cover" alt="" />

        {/* Main Details Card */}
        <TwView className="w-full max-w-[800px] self-center bg-white/80 p-6 rounded-[24px] shadow-md backdrop-blur-md gap-4 z-10">
          {/* Trip header */}
          <TwView className="items-center gap-2 py-2">
            <ThemedText className="text-2xl font-black text-center text-zinc-800 tracking-wider">
              {trip.title}
            </ThemedText>
            <ThemedText className="text-zinc-600 font-bold text-[10px] leading-relaxed uppercase tracking-wider">
              {t('trips.duration', { minutes: trip.durationMinutes })}
            </ThemedText>
          </TwView>

          <ThemedText className="text-center text-sm font-bold text-zinc-700 leading-relaxed p-2 rounded-xl bg-white/40">
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

          {/* Unified Audio Controller: Download & Play in one flow */}
          <UnifiedAudioController
            downloadStatus={download.status}
            downloadProgress={download.progress}
            downloadError={download.errorMsg}
            playerStatus={player.status}
            positionMs={player.positionMs}
            durationMs={player.durationMs}
            playerError={player.errorMsg}
            onPlay={player.play}
            onPause={player.pause}
            onStop={player.stop}
            onRewind={() =>
              player.seekTo(Math.max(0, player.positionMs - APP_CONFIG.audio.rewindOffsetMs))
            }
            onReset={() => player.seekTo(0)}
            onDownload={handlePlayAndDownload}
            onCancelDownload={download.deleteTripLocal}
            disabled={!trip.audioRemoteUrl}
          />

          {/* Manual feedback button (when feedbackTrigger is 'manual') */}
          {trip.feedbackTrigger === 'manual' && (
            <TwView className="self-stretch">
              <TwView className="bg-emerald-500 rounded-xl overflow-hidden shadow-sm">
                <TwPressable
                  accessibilityLabel={t('feedback.form.title')}
                  testID="feedback-manual-button"
                  className="py-3 items-center active:opacity-80"
                  onPress={() => setShowManualFeedback(true)}
                >
                  <ThemedText className="text-white font-extrabold text-sm">
                    {t('feedback.form.title')}
                  </ThemedText>
                </TwPressable>
              </TwView>
            </TwView>
          )}
        </TwView>
      </TwView>
    </TwView>
  );

  return (
    <TwView className="flex-1">
      <Stack.Screen options={{ title: trip.title }} />
      {isWeb ? <TwView className="flex-1">{innerView}</TwView> : innerView}

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
