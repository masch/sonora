import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import FeedbackForm from '@/components/feedback-form';
import UnifiedAudioController from '@/components/unified-audio-controller';
import { useRemoteConfigStore } from '@/store/remote-config-store';
import { TRACK_IMAGES, DEFAULT_TRACK_IMAGE } from '@/constants/images';
import { type TrackExperience } from '@/data/experiences';
import { useFeedbackTrigger } from '@/hooks/use-feedback-trigger';
import { useFeedbackSubmit } from '@/hooks/use-feedback-submit';
import { useImmersionPlayer } from '@/hooks/use-immersion-player';
import { useAppTranslation } from '@/hooks/use-translation';
import { useTrackDownload } from '@/hooks/use-track-download';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { TwPressable, TwView } from '@/tw';
import { TwImage } from '@/tw/image';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { PaymentPrompt } from '@/components/payment-prompt';
import { usePurchase } from '@/hooks/use-purchase';
import { PaymentClient } from '@/services/payment-client';
import { getUserEmail } from '@/storage/app-storage';
import type { TranslationKeys } from '@/i18n/types';

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

interface TrackDetailViewProps {
  track: TrackExperience;
}

export default function TrackDetailView({ track }: TrackDetailViewProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const feedback = useFeedbackSubmit();
  const [showManualFeedback, setShowManualFeedback] = useState(false);
  const userInitiatedPlayRef = useRef(false);
  const rewindOffsetMs = useRemoteConfigStore((s) => s.config.audio.rewindOffsetMs);
  const [purchaseState, purchaseActions] = usePurchase(track.id, track.free, track.price);

  const download = useTrackDownload(track.id, track.audioUrl, track.title);
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
    // Fire-and-forget access log
    getUserEmail().then((email) => {
      PaymentClient.logAccess(track.id, 'free', email ?? undefined, Platform.OS);
    });
  };

  const mappedTrackForFeedback = {
    id: track.slug,
    uuid: track.id,
    title: track.title,
    description: track.description,
    durationSeconds: track.durationSeconds,
    startCoordinates: { latitude: track.latitude, longitude: track.longitude },
    audioRemoteUrl: track.audioUrl,
    category: track.themeKey as TranslationKeys,
    subLabel: track.description,
    imageKey: track.imageKey as keyof typeof TRACK_IMAGES,
  };

  const feedbackTrigger = useFeedbackTrigger(mappedTrackForFeedback, {
    didJustFinish: player.status === 'stopped',
    isNearStart: true, // experiences are always playable, bypass geofence near checking
  });

  const handleFeedbackSubmit = (message: string) => feedback.submitFeedback(track.id, message);

  const handleFeedbackDismiss = () => {
    feedback.dismissFeedback();
    setShowManualFeedback(false);
    feedbackTrigger.dismiss();
  };

  const trackImage = TRACK_IMAGES[track.imageKey] || DEFAULT_TRACK_IMAGE;

  const showFeedbackForm =
    feedbackTrigger.showFeedback || showManualFeedback || feedback.feedbackStatus !== undefined;

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

          {/* Payment prompt or Audio controls — depending on purchase state */}
          {purchaseState.status === 'paid' ? (
            <TwView className="mt-4">
              <PaymentPrompt
                price={purchaseState.price || 0}
                currency={track.currency}
                onPay={purchaseActions.pay}
                onRestore={async (email) => {
                  return purchaseActions.restore(email);
                }}
                loading={purchaseState.paying}
                error={purchaseState.error}
              />
            </TwView>
          ) : (
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
                onRewind={() => player.seekTo(Math.max(0, player.positionMs - rewindOffsetMs))}
                onReset={() => player.seekTo(0)}
                onDownload={handlePlayAndDownload}
                onCancelDownload={download.deleteTrackLocal}
                disabled={!track.audioUrl || purchaseState.status === 'loading'}
              />
            </TwView>
          )}

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
        status={feedback.feedbackStatus}
        errorMsg={feedback.feedbackError}
      />
    </TwView>
  );
}
