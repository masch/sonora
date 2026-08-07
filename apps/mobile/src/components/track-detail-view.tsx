import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import FeedbackForm from '@/components/feedback-form';
import GeofenceBlockedBanner from '@/components/geofence-blocked-banner';
import UnifiedAudioController from '@/components/unified-audio-controller';
import { useAudioRewind } from '@/hooks/use-audio-rewind';
import { TRACK_IMAGES, DEFAULT_TRACK_IMAGE } from '@/constants/images';
import { type TrackExperience } from '@/data/experiences';
import { useFeedbackTrigger } from '@/hooks/use-feedback-trigger';
import { useFeedbackSubmit } from '@/hooks/use-feedback-submit';
import { useImmersionPlayer } from '@/hooks/use-immersion-player';
import { useOfflineGeofence } from '@/hooks/use-offline-geofence';
import { usePurchase } from '@/hooks/use-purchase';
import { useRefreshExperienceOnPurchase } from '@/hooks/use-refresh-experience-on-purchase';
import { useConfirm } from '@/hooks/use-confirm';
import { useAppTranslation } from '@/hooks/use-translation';
import { useTrackDownload } from '@/hooks/use-track-download';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { TwPressable, TwView } from '@/tw';
import { TwImage } from '@/tw/image';
import { ThemedText } from '@/components/themed-text';
import PreparingAudioHint from '@/components/preparing-audio-hint';
import { PaymentPrompt } from '@/components/payment-prompt';
import { BottomModal } from '@/components/ui/bottom-modal';
import TrackDetailMap from '@/components/track-detail-map';
import { PaymentClient } from '@/services/payment-client';
import { getUserEmail } from '@/storage/app-storage';
import { useRemoteConfigStore } from '@/store/remote-config-store';
import { formatDistance } from '@/utils/format-distance';
import type { TranslationKeys } from '@/i18n/types';

interface TrackDetailViewProps {
  track: TrackExperience;
  /** Fired when the purchase resolves to 'purchased' and the track has no
   *  audioUrl yet (e.g. the list was fetched before the payment). The parent
   *  should re-fetch the experience so the signed audioUrl becomes available. */
  onPurchased?: () => void;
  /** True while the parent re-fetches the experience after a purchase. */
  refreshingExperience?: boolean;
}

export default function TrackDetailView({
  track,
  onPurchased,
  refreshingExperience,
}: TrackDetailViewProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const feedback = useFeedbackSubmit();
  const [showManualFeedback, setShowManualFeedback] = useState(false);
  const [showGeofenceBlockedAlert, setShowGeofenceBlockedAlert] = useState(false);
  const userInitiatedPlayRef = useRef(false);
  const rewind = useAudioRewind();
  const [purchaseState, purchaseActions] = usePurchase(track.id, track.free, track.price);

  // GEOF.8 — gates playback/feedback only when the track's own geo data asks
  // (entityRadius/formatDefaultRadius). A track with geo_mode 'unrestricted' stays
  // un-gated (always playable); the global bypassGeofence still outranks every mode.
  const geofence = useOfflineGeofence(
    { latitude: track.latitude, longitude: track.longitude },
    { format: 'track', geoMode: track.geoMode, radiusMeters: track.radiusMeters },
  );

  // When the purchase resolves but the fetched experience predates the
  // payment (no signed audioUrl), ask the parent to re-fetch the list so
  // the play/download button unlocks without a reload.
  useRefreshExperienceOnPurchase(purchaseState.status, !!track.audioUrl, onPurchased);

  const download = useTrackDownload(track.id, track.audioUrl, track.title);
  const player = useImmersionPlayer(download.localAudioUri, {
    title: track.title,
    id: track.id,
    slug: track.slug,
  });

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
    isNearStart: geofence.isNearStart,
  });

  const handleFeedbackSubmit = (message: string) => feedback.submitFeedback(track.id, message);

  const handleFeedbackDismiss = () => {
    feedback.dismissFeedback();
    setShowManualFeedback(false);
    feedbackTrigger.dismiss();
  };

  const isBypassable = track.geofenceBypassable === true;
  const bypassGeofence = useRemoteConfigStore((s) => s.config.geofence.bypassGeofence);
  const isPlaybackBlocked = !geofence.isNearStart && !isBypassable && !bypassGeofence;
  const showBypassWarning = !geofence.isNearStart && isBypassable && !bypassGeofence;
  const { confirm, component: confirmComponent } = useConfirm();
  const openBlockedAlert = () => setShowGeofenceBlockedAlert(true);

  const handlePlay = async () => {
    if (showBypassWarning) {
      const ok = await confirm({
        title: t('experiences.warnings.locationAlertTitle' as TranslationKeys),
        message: t('experiences.warnings.locationAlertMessage' as TranslationKeys),
        confirmLabel: t('experiences.warnings.continue' as TranslationKeys),
        cancelLabel: t('experiences.warnings.cancel' as TranslationKeys),
      });
      if (!ok) return;
    } else if (isPlaybackBlocked) {
      openBlockedAlert();
      return;
    }
    player.play();
  };

  const handleDownload = async () => {
    if (showBypassWarning) {
      const ok = await confirm({
        title: t('experiences.warnings.locationAlertTitle' as TranslationKeys),
        message: t('experiences.warnings.locationAlertMessage' as TranslationKeys),
        confirmLabel: t('experiences.warnings.continue' as TranslationKeys),
        cancelLabel: t('experiences.warnings.cancel' as TranslationKeys),
      });
      if (!ok) return;
    } else if (isPlaybackBlocked) {
      openBlockedAlert();
      return;
    }
    handlePlayAndDownload();
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

          {/* Map for track origin point */}
          {track.latitude != null && track.longitude != null && (
            <TwView
              className="mt-3 -mx-3 relative rounded-xl overflow-hidden"
              testID="track-detail-map"
            >
              <TrackDetailMap latitude={track.latitude} longitude={track.longitude} />
            </TwView>
          )}

          {/* Block playback banner if the track geo gate says cars playable */}
          {isPlaybackBlocked && (
            <GeofenceBlockedBanner
              distanceMeters={geofence.distanceMeters}
              requiredRadiusMeters={geofence.requiredRadiusMeters}
            />
          )}

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
                onPlay={handlePlay}
                onPause={player.pause}
                onStop={player.stop}
                onRewind={rewind}
                onReset={() => player.seekTo(0)}
                onDownload={handleDownload}
                onCancelDownload={download.deleteTrackLocal}
                disabled={!track.audioUrl || purchaseState.status === 'loading'}
              />
            </TwView>
          )}

          {refreshingExperience && <PreparingAudioHint />}

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

      {confirmComponent}

      <BottomModal
        visible={showGeofenceBlockedAlert}
        onDismiss={() => setShowGeofenceBlockedAlert(false)}
      >
        <TwView className="px-6 pb-2">
          <ThemedText type="subtitle" className="mb-2">
            {t('experiences.geofenceBlocked.blockedAlertTitle' as TranslationKeys)}
          </ThemedText>
          <ThemedText className="mb-6">
            {t('experiences.geofenceBlocked.blockedAlertMessage' as TranslationKeys, {
              radius: geofence.requiredRadiusMeters,
              distance: formatDistance(
                geofence.distanceMeters,
                t,
                t('experiences.geofenceBlocked.notAvailable'),
              ),
            })}
          </ThemedText>
          <TwPressable
            testID="geofence-blocked-alert-ok"
            accessibilityLabel={t('experiences.geofenceBlocked.blockedAlertOk' as TranslationKeys)}
            className="bg-blue-500 rounded-xl py-3 items-center"
            onPress={() => setShowGeofenceBlockedAlert(false)}
          >
            <ThemedText className="text-white font-semibold">
              {t('experiences.geofenceBlocked.blockedAlertOk' as TranslationKeys)}
            </ThemedText>
          </TwPressable>
        </TwView>
      </BottomModal>
    </TwView>
  );
}
