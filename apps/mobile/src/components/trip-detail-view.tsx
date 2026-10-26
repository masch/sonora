import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/icon';
import { Button } from '@/components/ui/button';
import UnifiedAudioController from '@/components/unified-audio-controller';
import PreparingAudioHint from '@/components/preparing-audio-hint';
import { PaymentPrompt } from '@/components/payment-prompt';
import FeedbackForm from '@/components/feedback-form';
import GpsPrecisionBadge from '@/components/gps-precision-badge';
import ExperienceMapSwitch, { MAP_CARD_GUTTER_CLASS } from '@/components/map/experience-map-switch';
import { MapDownloadButton } from '@/components/map/map-download-button';
import GeofenceBlockedBanner from '@/components/geofence-blocked-banner';
import { GeofenceBlockedModal } from '@/components/geofence-blocked-modal';
import { ExperienceCredits } from '@/components/experience-credits';
import { LeadCaptureButton } from '@/components/lead-capture-button';
import type { TripExperience } from '@/data/experiences';
import { useImmersionPlayer } from '@/hooks/use-immersion-player';
import { useMapViewConfig } from '@/hooks/use-map-view-config';
import { useOfflineGeofence } from '@/hooks/use-offline-geofence';
import { useTrackDownload } from '@/hooks/use-track-download';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useAppTranslation, type TranslationKeys } from '@/hooks/use-translation';
import { useFeedbackTrigger } from '@/hooks/use-feedback-trigger';
import { useFeedbackSubmit } from '@/hooks/use-feedback-submit';
import { useAudioRewind } from '@/hooks/use-audio-rewind';
import { usePurchase } from '@/hooks/use-purchase';
import { useRefreshExperienceOnPurchase } from '@/hooks/use-refresh-experience-on-purchase';
import { useGeofencePlaybackGuard } from '@/hooks/use-geofence-playback-guard';
import { PaymentClient } from '@/services/payment-client';
import { getUserEmail } from '@/storage/app-storage';
import { TwView } from '@/tw';
import { TwImage } from '@/tw/image';
import { DEFAULT_TRACK_IMAGE, TRACK_IMAGES } from '@/constants/images';

interface TripDetailViewProps {
  track: TripExperience;
  showGPSDetails: boolean;
  /** Fired when the purchase resolves to 'purchased' and the track has no
   *  audioUrl yet (e.g. the list was fetched before the payment). The parent
   *  should re-fetch the experience so the signed audioUrl becomes available. */
  onPurchased?: () => void;
  /** True while the parent re-fetches the experience after a purchase. */
  refreshingExperience?: boolean;
}

interface TripCardHeaderProps {
  title: string;
  durationSeconds: number;
  description?: string;
  titleColor: string;
  subtextColor: string;
}

function TripCardHeader({
  title,
  durationSeconds,
  description,
  titleColor,
  subtextColor,
}: TripCardHeaderProps) {
  const { t } = useAppTranslation();

  return (
    <>
      <TwView className="items-center gap-2 p-2 w-full">
        <ThemedText
          numberOfLines={1}
          adjustsFontSizeToFit
          className="text-2xl font-black text-center px-2"
          style={{ color: titleColor }}
        >
          {title}
        </ThemedText>
        <ThemedText
          className="font-bold text-[10px] leading-relaxed uppercase tracking-wider"
          style={{ color: subtextColor }}
        >
          {t('experiences.duration', { minutes: Math.round(durationSeconds / 60) })}
        </ThemedText>
      </TwView>

      {description && (
        <ThemedText
          className="text-center text-sm font-bold leading-relaxed p-2 rounded-xl bg-white/40 dark:bg-zinc-800/40"
          style={{ color: titleColor }}
        >
          {description}
        </ThemedText>
      )}
    </>
  );
}

export default function TripDetailView({
  track,
  showGPSDetails,
  onPurchased,
  refreshingExperience,
}: TripDetailViewProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const feedback = useFeedbackSubmit();
  const [showManualFeedback, setShowManualFeedback] = useState(false);
  const userInitiatedPlayRef = useRef(false);

  const geofence = useOfflineGeofence(
    {
      latitude: track.latitude,
      longitude: track.longitude,
    },
    { format: 'trip', geoMode: track.geoMode, radiusMeters: track.radiusMeters },
  );

  const download = useTrackDownload(track.id, track.audioUrl, track.title);
  // The experience's own coordinates decide the region, so the map draws the archive
  // of the place the walker is going to, not the one the server preloads.
  const { renderer: mapRenderer, source: mapSource } = useMapViewConfig({
    latitude: track.latitude,
    longitude: track.longitude,
  });
  const player = useImmersionPlayer(download.localAudioUri, {
    title: track.title,
    id: track.id,
    slug: track.slug,
  });

  const isBypassable = track.geofenceBypassable === true;
  const rewind = useAudioRewind();
  const [purchaseState, purchaseActions] = usePurchase(track.id, track.free, track.price);

  useRefreshExperienceOnPurchase(purchaseState.status, !!track.audioUrl, onPurchased);

  const {
    isPlaybackBlocked,
    showGeofenceBlockedAlert,
    setShowGeofenceBlockedAlert,
    confirmComponent,
    guardAction,
  } = useGeofencePlaybackGuard({
    isNearStart: geofence.isNearStart,
    isBypassable,
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
    void getUserEmail()
      .then((email) => {
        PaymentClient.logAccess(track.id, 'free', email ?? undefined, Platform.OS);
      })
      .catch(() => {});
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

  const handlePlay = () => guardAction(() => player.play());
  const handleDownload = () => guardAction(handlePlayAndDownload);

  const trackImage = TRACK_IMAGES[track.imageKey] || DEFAULT_TRACK_IMAGE;
  const showFeedbackForm =
    feedbackTrigger.showFeedback || showManualFeedback || feedback.feedbackStatus !== undefined;
  const cardBg = colors.homeExploreRoutesBg + 'CC';

  return (
    <TwView className="flex-1">
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
              tintColor={colors.text}
            />
          </TwView>
        </TwView>

        {/* Main Content Area */}
        <TwView className="relative flex-1 gap-4 p-4">
          {/* Main Details Card */}
          <TwView
            style={{ backgroundColor: cardBg, borderColor: colors.border }}
            className={`w-full border ${MAP_CARD_GUTTER_CLASS} py-6 rounded-[24px] shadow-md backdrop-blur-md gap-4 z-10`}
          >
            <TripCardHeader
              title={track.title}
              durationSeconds={track.durationSeconds}
              description={track.description}
              titleColor={colors.homeCardText}
              subtextColor={colors.homeCardSubtext}
            />

            {/* Mini map, and the decision to take it with you: the region the
                trip's own coordinates resolve to, prepared before leaving. */}
            <ExperienceMapSwitch
              renderer={mapRenderer}
              source={mapSource}
              experience={track}
              userCoordinates={geofence.userCoordinates ?? undefined}
            />
            <MapDownloadButton point={{ latitude: track.latitude, longitude: track.longitude }} />

            {/* GPS precision */}
            {showGPSDetails && (
              <GpsPrecisionBadge
                gpsStatus={geofence.gpsStatus}
                gpsAccuracy={geofence.gpsAccuracy}
                distanceMeters={geofence.distanceMeters}
                isNearStart={geofence.isNearStart}
                requiredRadiusMeters={geofence.requiredRadiusMeters}
              />
            )}

            {/* Block playback banner if blocked */}
            {isPlaybackBlocked && (
              <GeofenceBlockedBanner
                distanceMeters={geofence.distanceMeters}
                requiredRadiusMeters={geofence.requiredRadiusMeters}
              />
            )}

            {/* Unified Audio Controller: Download & Play in one flow */}
            {purchaseState.status === 'paid' ? (
              <PaymentPrompt
                price={purchaseState.price || 0}
                currency={track.currency}
                onPay={purchaseActions.pay}
                onRestore={async (email) => purchaseActions.restore(email)}
                loading={purchaseState.paying}
                error={purchaseState.error}
              />
            ) : (
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
            )}

            {refreshingExperience && <PreparingAudioHint />}

            {/* Action buttons (Feedback & Contact) */}
            <TwView className="self-stretch gap-2">
              <Button
                label={t('feedback.form.title')}
                variant="primary"
                testID="feedback-manual-button"
                accessibilityLabel={t('feedback.form.title')}
                onPress={() => setShowManualFeedback(true)}
              />

              <LeadCaptureButton source="trip_detail" experienceId={track.id} />
            </TwView>

            {/* Credits */}
            <ExperienceCredits credits={track.credits} />
          </TwView>
        </TwView>
      </TwView>

      <FeedbackForm
        visible={showFeedbackForm}
        onSubmit={handleFeedbackSubmit}
        onDismiss={handleFeedbackDismiss}
        status={feedback.feedbackStatus}
        errorMsg={feedback.feedbackError}
      />

      {confirmComponent}

      <GeofenceBlockedModal
        visible={showGeofenceBlockedAlert}
        onDismiss={() => setShowGeofenceBlockedAlert(false)}
        requiredRadiusMeters={geofence.requiredRadiusMeters}
        distanceMeters={geofence.distanceMeters}
      />
    </TwView>
  );
}
