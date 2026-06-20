import { useState, useEffect, useRef, useReducer } from 'react';
import { Stack } from 'expo-router';

import FeedbackForm from '@/components/feedback-form';
import GpsPrecisionBadge from '@/components/gps-precision-badge';
import LoadingView from '@/components/loading-view';
import { ThemedText } from '@/components/themed-text';
import TrackDetailMap from '@/components/track-detail-map';
import UnifiedAudioController from '@/components/unified-audio-controller';
import { APP_CONFIG } from '@/config/app-config';
import { TRACK_IMAGES } from '@/constants/images';
import { fetchExperiences, type Experience } from '@/data/experiences';
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

interface TrackDetailViewProps {
  trackId: string;
  isWeb: boolean;
}

interface TrackDetailState {
  track: Experience | null;
  loading: boolean;
  error: boolean;
}

type TrackDetailAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; track: Experience | null }
  | { type: 'FETCH_ERROR' };

function trackDetailReducer(state: TrackDetailState, action: TrackDetailAction): TrackDetailState {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: false };
    case 'FETCH_SUCCESS':
      return { track: action.track, loading: false, error: false };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: true };
  }
}

const initialTrackState: TrackDetailState = { track: null, loading: true, error: false };

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

  const [{ track, loading, error }, dispatch] = useReducer(trackDetailReducer, initialTrackState);

  const loadTrack = async () => {
    dispatch({ type: 'FETCH_START' });
    try {
      const list = await fetchExperiences();
      const found = list.find((e: Experience) => e.slug === trackId || e.id === trackId);
      dispatch({ type: 'FETCH_SUCCESS', track: found ?? null });
    } catch (err) {
      logger.error('[DETAIL] Failed to fetch experience:', err);
      dispatch({ type: 'FETCH_ERROR' });
    }
  };

  useEffect(() => {
    fetchExperiences()
      .then((list) => {
        const found = list.find((e) => e.slug === trackId || e.id === trackId);
        dispatch({ type: 'FETCH_SUCCESS', track: found ?? null });
      })
      .catch((err) => {
        logger.error('[DETAIL] Failed to fetch experience:', err);
        dispatch({ type: 'FETCH_ERROR' });
      });
  }, [trackId]);

  // Hooks MUST be called unconditionally (rules-of-hooks)
  const startCoordinates = track ? { latitude: track.latitude, longitude: track.longitude } : null;
  const geofence = useOfflineGeofence(startCoordinates);
  const download = useTrackDownload(track?.id ?? null, track?.audioUrl ?? null);
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

  // Map Experience to simple track for useFeedbackTrigger if needed
  const mappedTrackForFeedback = track
    ? {
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
      }
    : undefined;

  const feedbackTrigger = useFeedbackTrigger(mappedTrackForFeedback, {
    didJustFinish: player.status === 'stopped',
    isNearStart: geofence.isNearStart,
  });
  const feedbackQueue = useFeedbackQueue();

  const handleFeedbackSubmit = async (message: string) => {
    setFeedbackStatus('sending');
    setFeedbackError(null);

    const trackUuid = track?.id ?? trackId;

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
        await feedbackQueue.enqueue({ trackId: trackUuid, message });
        setFeedbackStatus('queued');
      }
    } catch (err) {
      logger.error('[NETWORK_ERROR] Fetch failed:', err);
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

  if (error) {
    return (
      <TwView className="flex-grow items-center justify-center p-6 bg-background">
        <ThemedText className="text-base font-bold text-text mb-4 text-center">
          {t('experiences.errorLoading')}
        </ThemedText>
        <TwPressable
          onPress={loadTrack}
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
    return <LoadingView message={t('map.loadingMap')} />;
  }

  if (!track) {
    return (
      <TwView className="flex-grow items-center justify-center px-6">
        <Stack.Screen options={{ title: t('experiences.notFound') }} />
        <ThemedText themeColor="text">{t('experiences.notFound')}</ThemedText>
      </TwView>
    );
  }

  const trackImage = TRACK_IMAGES[track.imageKey] || TRACK_IMAGES['bonus-track'];

  const showFeedbackForm =
    feedbackTrigger.showFeedback || showManualFeedback || feedbackStatus !== undefined;

  // Enforce starting geofence coordinates only if format is 'trip'
  const isPlaybackBlocked = track.format === 'trip' && !geofence.isNearStart;

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
            disabled={!track.audioUrl || isPlaybackBlocked}
          />

          {/* Manual feedback button (when type is track/has feedback trigger) */}
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
