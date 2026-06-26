import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';

import FeedbackForm from '@/components/feedback-form';
import GpsPrecisionBadge from '@/components/gps-precision-badge';
import { ThemedText } from '@/components/themed-text';
import TrackDetailMap from './track-detail-map';
import UnifiedAudioController from '@/components/unified-audio-controller';
import { APP_CONFIG } from '@/config/app-config';
import { TRACK_IMAGES, DEFAULT_TRACK_IMAGE } from '@/constants/images';
import { type Experience } from '@/data/experiences';
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
import type { TranslationKeys } from '@/i18n/types';

const API_URL = `${APP_CONFIG.apiBaseUrl}/feedback`;

interface TripDetailViewProps {
  track: Experience;
  trackId: string;
}

export default function TripDetailView({ track, trackId }: TripDetailViewProps) {
  const { t } = useAppTranslation();
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus | undefined>();
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [showManualFeedback, setShowManualFeedback] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const userInitiatedPlayRef = useRef(false);

  const geofence = useOfflineGeofence({
    latitude: track.latitude,
    longitude: track.longitude,
  });
  const download = useTrackDownload(track.id ?? trackId, track.audioUrl ?? null);
  const player = useImmersionPlayer(download.localAudioUri, { title: track.title });

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

  const mappedTrackForFeedback = {
    id: track.slug,
    uuid: track.id,
    title: track.title,
    description: track.description,
    durationSeconds: track.durationSeconds,
    startCoordinates: { latitude: track.latitude, longitude: track.longitude },
    audioRemoteUrl: track.audioUrl ?? '',
    category: track.themeKey as TranslationKeys,
    subLabel: track.description,
    imageKey: track.imageKey as keyof typeof TRACK_IMAGES,
  };

  const feedbackTrigger = useFeedbackTrigger(mappedTrackForFeedback, {
    didJustFinish: player.status === 'stopped',
    isNearStart: geofence.isNearStart,
  });
  const feedbackQueue = useFeedbackQueue();

  const handleFeedbackSubmit = async (message: string) => {
    setFeedbackStatus('sending');
    setFeedbackError(null);
    const trackUuid = track.id ?? trackId;
    const idempotencyKey = generateUUID();

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experienceId: trackUuid,
          message,
          idempotencyKey,
          createdAt: new Date().toISOString(),
        }),
      });

      if (response.status === 201) {
        setFeedbackStatus('sent');
      } else {
        logger.error('[API_ERROR] Server returned status:', response.status);
        await feedbackQueue.enqueue({ experienceId: trackUuid, message }, idempotencyKey);
        setFeedbackStatus('queued');
      }
    } catch (err) {
      logger.error('[NETWORK_ERROR] Fetch failed:', err);
      try {
        await feedbackQueue.enqueue({ experienceId: trackUuid, message }, idempotencyKey);
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

  const trackImage = TRACK_IMAGES[track.imageKey] || DEFAULT_TRACK_IMAGE;

  const showFeedbackForm =
    feedbackTrigger.showFeedback || showManualFeedback || feedbackStatus !== undefined;

  const isPlaybackBlocked = !geofence.isNearStart && !APP_CONFIG.bypassGeofence;

  const innerView = (
    <TwView className="flex-1 bg-transparent">
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
              {t('experiences.duration', { minutes: Math.round(track.durationSeconds / 60) })}
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
              latitude={track.latitude}
              longitude={track.longitude}
              userLatitude={geofence.userCoordinates?.latitude}
              userLongitude={geofence.userCoordinates?.longitude}
              showLabels={showLabels}
              waypoints={track.waypoints}
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

          {/* Block playback warning message if blocked */}
          {isPlaybackBlocked && (
            <ThemedText
              className="text-xs text-rose-600 font-bold text-center mt-2 px-4"
              testID="geofence-error-msg"
            >
              {t('experiences.errors.mustBeOnSite' as TranslationKeys)}
            </ThemedText>
          )}

          {/* Unified Audio Controller: Download & Play in one flow */}
          <UnifiedAudioController
            downloadStatus={download.status}
            downloadProgress={download.progress}
            downloadError={download.errorMsg}
            playerStatus={player.status}
            positionMs={player.positionMs}
            durationMs={player.durationMs || track.durationSeconds * 1000}
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
            disabled={!track.audioUrl || isPlaybackBlocked}
          />

          {/* Manual feedback button */}
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
        </TwView>
      </TwView>
    </TwView>
  );

  return (
    <TwView className="flex-1">
      <Stack.Screen options={{ title: track.title }} />
      {Platform.OS === 'web' ? <TwView className="flex-1">{innerView}</TwView> : innerView}

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
