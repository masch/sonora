import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import FeedbackForm from '@/components/feedback-form';
import UnifiedAudioController from '@/components/unified-audio-controller';
import { APP_CONFIG } from '@/config/app-config';
import { TRACK_IMAGES, DEFAULT_TRACK_IMAGE } from '@/constants/images';
import { type Experience } from '@/data/experiences';
import { useFeedbackTrigger } from '@/hooks/use-feedback-trigger';
import { useFeedbackQueue } from '@/hooks/use-feedback-queue';
import { useImmersionPlayer } from '@/hooks/use-immersion-player';
import { useAppTranslation } from '@/hooks/use-translation';
import { useTrackDownload } from '@/hooks/use-track-download';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { TwPressable, TwView } from '@/tw';
import { TwImage } from '@/tw/image';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import type { FeedbackStatus } from '@/types/feedback';
import { generateUUID } from '@/utils/uuid';
import { logger } from '@/utils/logger';
import type { TranslationKeys } from '@/i18n/types';

const API_URL = `${APP_CONFIG.apiBaseUrl}/feedback`;

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

interface TrackDetailViewProps {
  track: Experience;
  trackId: string;
}

export default function TrackDetailView({ track, trackId }: TrackDetailViewProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus | undefined>();
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [showManualFeedback, setShowManualFeedback] = useState(false);
  const userInitiatedPlayRef = useRef(false);

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
    isNearStart: true, // experiences are always playable, bypass geofence near checking
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

  const cardBg = colors.homeExploreTracksBg + 'CC';

  const innerView = (
    <TwView className="flex-1 bg-transparent">
      {/* Cover Image */}
      <TwView className="relative w-full h-80 overflow-hidden bg-zinc-250">
        <TwImage source={trackImage} className="w-full h-full" contentFit="cover" alt="" />
      </TwView>

      {/* Main Content Area */}
      <TwView className="relative flex-1 gap-4 p-4">
        {/* Main Details Card */}
        <TwView
          style={{ backgroundColor: cardBg, borderColor: colors.border }}
          className="w-full max-w-[800px] self-center border px-4 py-6 rounded-[24px] shadow-md backdrop-blur-md gap-6 z-10"
        >
          {/* Header Title & Category */}
          <TwView className="gap-1">
            <ThemedText
              className="text-2xl font-bold leading-tight"
              style={{ color: colors.homeCardText }}
              testID="experience-title"
            >
              {track.title}
            </ThemedText>
            <ThemedText
              className="text-sm font-semibold capitalize"
              style={{ color: colors.homeCardSubtext }}
              testID="experience-category"
            >
              {t(`experiences.categories.${track.themeKey}` as TranslationKeys)}
            </ThemedText>
          </TwView>

          {/* Description */}
          <ThemedText
            className="text-sm leading-relaxed"
            style={{ color: colors.homeCardText }}
            testID="experience-description"
          >
            {track.description}
          </ThemedText>

          {/* Metadata Details Rows */}
          <TwView className="gap-3 pt-2">
            {/* Duration Row */}
            <TwView className="flex-row items-center gap-3">
              <Icon
                ios="clock"
                android="schedule"
                web="schedule"
                size={18}
                tintColor={colors.homeCardSubtext}
              />
              <ThemedText className="text-sm font-medium" style={{ color: colors.homeCardSubtext }}>
                {formatDuration(track.durationSeconds)}
              </ThemedText>
            </TwView>

            {/* Registry Row */}
            <TwView className="flex-row items-center gap-3">
              <Icon
                ios="person"
                android="person"
                web="person"
                size={18}
                tintColor={colors.homeCardSubtext}
              />
              <ThemedText className="text-sm font-medium" style={{ color: colors.homeCardSubtext }}>
                {t('experiences.detail.registry' as TranslationKeys)}
              </ThemedText>
            </TwView>

            {/* Location Row */}
            <TwView className="flex-row items-center gap-3">
              <Icon
                ios="mappin.and.ellipse"
                android="location_on"
                web="location_on"
                size={18}
                tintColor={colors.homeCardSubtext}
              />
              <ThemedText className="text-sm font-medium" style={{ color: colors.homeCardSubtext }}>
                {t('experiences.detail.location' as TranslationKeys)}
              </ThemedText>
            </TwView>
          </TwView>

          {/* Big play button inline custom overlay */}
          <TwView className="mt-4">
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
              disabled={!track.audioUrl}
            />
          </TwView>

          {/* Manual feedback button */}
          <TwView className="self-stretch mt-2">
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
