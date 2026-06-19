import { useState, useEffect, useRef } from 'react';
import { Stack } from 'expo-router';

import FeedbackForm from '@/components/feedback-form';
import GpsPrecisionBadge from '@/components/gps-precision-badge';
import { ThemedText } from '@/components/themed-text';
import TrackDetailMap from '@/components/track-detail-map';
import UnifiedAudioController from '@/components/unified-audio-controller';
import { APP_CONFIG } from '@/config/app-config';
import { getTrackById } from '@/data/tracks';
import { useFeedbackTrigger } from '@/hooks/use-feedback-trigger';
import { useFeedbackQueue } from '@/hooks/use-feedback-queue';
import { useImmersionPlayer } from '@/hooks/use-immersion-player';
import { useOfflineGeofence } from '@/hooks/use-offline-geofence';
import { useAppTranslation } from '@/hooks/use-translation';
import { useTrackDownload } from '@/hooks/use-track-download';
import { TwPressable, TwView } from '@/tw';
import { TwImage } from '@/tw/image';
import { Icon } from '@/components/icon';
import type { FeedbackStatus } from '@/types/feedback';
import { generateUUID } from '@/utils/uuid';
import { logger } from '@/utils/logger';

const API_URL = `${APP_CONFIG.apiBaseUrl}/feedback`;

interface TrackDetailViewProps {
  trackId: string;
  isWeb: boolean;
}

/**
 * Shared track detail view used by tracks/[id].tsx (dynamic route).
 * Receives a concrete trackId instead of reading from route params.
 */
export default function TrackDetailView({ trackId, isWeb }: TrackDetailViewProps) {
  const { t } = useAppTranslation();
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus | undefined>();
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [showManualFeedback, setShowManualFeedback] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const userInitiatedPlayRef = useRef(false);

  const track = getTrackById(trackId);

  // Hooks MUST be called unconditionally (rules-of-hooks)
  const geofence = useOfflineGeofence(track?.startCoordinates ?? { latitude: 0, longitude: 0 });
  const download = useTrackDownload(track?.id ?? null, track?.audioRemoteUrl ?? null);
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
  const feedbackTrigger = useFeedbackTrigger(track ?? undefined, {
    didJustFinish: player.status === 'stopped',
    isNearStart: geofence.isNearStart,
  });
  const feedbackQueue = useFeedbackQueue();

  const handleFeedbackSubmit = async (message: string) => {
    setFeedbackStatus('sending');
    setFeedbackError(null);

    // Resolve UUID inside callback to avoid capturing track object in deps
    const currentTrack = getTrackById(trackId);
    const trackUuid = currentTrack?.uuid ?? trackId;

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId: trackUuid,
          message,
          idempotencyKey: generateUUID(),
          createdAt: new Date().toISOString(),
        }),
      });

      if (response.status === 201) {
        setFeedbackStatus('sent');
      } else {
        logger.error('[API_ERROR] Server returned status:', response.status);
        // Server error — queue offline
        await feedbackQueue.enqueue({ trackId: trackUuid, message });
        setFeedbackStatus('queued');
      }
    } catch (err) {
      logger.error('[NETWORK_ERROR] Fetch failed:', err);
      // Network error — queue offline
      try {
        await feedbackQueue.enqueue({ trackId: trackUuid, message });
        setFeedbackStatus('queued');
      } catch (enqueueErr) {
        logger.error('[ENQUEUE_ERROR] SQLite fallback failed:', enqueueErr);
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

  if (!track) {
    return (
      <TwView className="flex-grow items-center justify-center px-6">
        <Stack.Screen options={{ title: t('tracks.notFound') }} />
        <ThemedText themeColor="text">{t('tracks.notFound')}</ThemedText>
      </TwView>
    );
  }

  const trackImage =
    track.imageKey === 'deriva-centro'
      ? require('@/assets/images/sonora/deriva-centro.png')
      : require('@/assets/images/sonora/bonus-track.png');

  const showFeedbackForm =
    feedbackTrigger.showFeedback || showManualFeedback || feedbackStatus !== undefined;

  const innerView = (
    <TwView className="flex-1">
      {/* Top Banner */}
      <TwView className="relative w-full h-48 overflow-hidden items-center justify-center bg-zinc-950">
        <TwImage
          source={trackImage}
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
        {/* Main Details Card */}
        <TwView className="w-full max-w-[800px] self-center card-container-solid px-3 py-6 rounded-[24px] shadow-md backdrop-blur-md gap-4 z-10">
          {/* Track header */}
          <TwView className="items-center gap-2 p-2 w-full">
            <ThemedText
              themeColor="text"
              numberOfLines={1}
              adjustsFontSizeToFit
              className="text-2xl font-black text-center px-2"
            >
              {track.title + ' '}
            </ThemedText>
            <ThemedText
              themeColor="textSecondary"
              className="font-bold text-[10px] leading-relaxed uppercase tracking-wider"
            >
              {t('tracks.duration', { minutes: Math.round(track.durationSeconds / 60) })}
            </ThemedText>
          </TwView>

          <ThemedText
            themeColor="text"
            className="text-center text-sm font-bold leading-relaxed p-2 rounded-xl bg-white/40 dark:bg-zinc-800/40"
          >
            {track.description}
          </ThemedText>

          {/* Mini map */}
          <TwView className="-mx-3 relative">
            <TrackDetailMap
              latitude={track.startCoordinates.latitude}
              longitude={track.startCoordinates.longitude}
              userLatitude={geofence.userCoordinates?.latitude}
              userLongitude={geofence.userCoordinates?.longitude}
              showLabels={showLabels}
            />
            <TwPressable
              onPress={() => setShowLabels(!showLabels)}
              className="absolute top-3 right-3 bg-white/95 dark:bg-zinc-800/95 p-2 rounded-lg shadow-md z-20 active:opacity-80"
              accessibilityLabel={showLabels ? t('map.hideLabels') : t('map.showLabels')}
              testID="toggle-map-labels"
            >
              <Icon
                ios={showLabels ? 'tag.slash.fill' : 'tag.fill'}
                android={showLabels ? 'label_off' : 'label'}
                web={showLabels ? 'label_off' : 'label'}
                size={16}
                tintColor={showLabels ? '#dc2626' : '#2563eb'}
              />
            </TwPressable>
          </TwView>

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
            durationMs={player.durationMs || (track ? track.durationSeconds * 1000 : 0)}
            playerError={player.errorMsg}
            onPlay={player.play}
            onPause={player.pause}
            onStop={player.stop}
            onRewind={() =>
              player.seekTo(Math.max(0, player.positionMs - APP_CONFIG.audio.rewindOffsetMs))
            }
            onReset={() => player.seekTo(0)}
            onDownload={handlePlayAndDownload}
            onCancelDownload={download.deleteTrackLocal}
            disabled={!track.audioRemoteUrl}
          />

          {/* Manual feedback button (when feedbackTrigger is 'manual') */}
          {track.feedbackTrigger === 'manual' && (
            <TwView className="self-stretch">
              <TwView className="bg-emerald-500 rounded-xl overflow-hidden shadow-sm">
                <TwPressable
                  accessibilityLabel={t('feedback.form.title')}
                  testID="feedback-manual-button"
                  className="py-3 items-center active:opacity-80"
                  onPress={() => setShowManualFeedback(true)}
                >
                  <ThemedText themeColor="background" className="text-white font-extrabold text-sm">
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
      <Stack.Screen options={{ title: track.title }} />
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
