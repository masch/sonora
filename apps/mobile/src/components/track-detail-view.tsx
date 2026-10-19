import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import UnifiedAudioController from '@/components/unified-audio-controller';
import PreparingAudioHint from '@/components/preparing-audio-hint';
import { PaymentPrompt } from '@/components/payment-prompt';
import FeedbackForm from '@/components/feedback-form';
import TrackDetailMap from '@/components/track-detail-map';
import ExperienceMap from '@/components/map/experience-map';
import { resolveMapRenderer, type MapRenderer } from '@/components/map/resolve-renderer';
import GeofenceBlockedBanner from '@/components/geofence-blocked-banner';
import { GeofenceBlockedModal } from '@/components/geofence-blocked-modal';
import { ExperienceCredits } from '@/components/experience-credits';
import { LeadCaptureButton } from '@/components/lead-capture-button';
import type { PlayableExperience } from '@/data/experiences';
import { useImmersionPlayer } from '@/hooks/use-immersion-player';
import { useOfflineGeofence } from '@/hooks/use-offline-geofence';
import { useTrackDownload } from '@/hooks/use-track-download';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useAppTranslation, type TranslationKeys } from '@/hooks/use-translation';
import { useRemoteConfigStore } from '@/store/remote-config-store';
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

interface TrackMapProps {
  renderer: MapRenderer;
  archiveUrl: string;
  styleUrl?: string;
  track: PlayableExperience;
  userCoordinates?: { latitude: number; longitude: number };
}

/**
 * The map for a track, whichever implementation is enabled. Extracted so the
 * choice stays out of the screen's own control flow.
 */
function TrackMap({ renderer, archiveUrl, styleUrl, track, userCoordinates }: TrackMapProps) {
  if (renderer === 'maplibre') {
    return (
      <ExperienceMap
        source={{ archiveUrl, styleUrl }}
        overlays={track.mapDocuments ?? []}
        center={[track.longitude, track.latitude]}
        userCoordinates={userCoordinates}
      />
    );
  }

  return (
    <TrackDetailMap
      latitude={track.latitude}
      longitude={track.longitude}
      userLatitude={userCoordinates?.latitude}
      userLongitude={userCoordinates?.longitude}
    />
  );
}

interface TrackDetailViewProps {
  track: PlayableExperience;
  /** Called after a successful purchase or restore to signal the parent screen
   *  should re-fetch the experience so the signed audioUrl becomes available. */
  onPurchased?: () => void;
  /** True while the parent re-fetches the experience after a purchase. */
  refreshingExperience?: boolean;
}

interface TrackCardHeaderProps {
  title: string;
  themeKey?: string;
  description?: string;
  titleColor: string;
  subtextColor: string;
}

function TrackCardHeader({
  title,
  themeKey,
  description,
  titleColor,
  subtextColor,
}: TrackCardHeaderProps) {
  const { t } = useAppTranslation();

  return (
    <>
      <TwView className="gap-1">
        <ThemedText
          className="text-2xl font-bold leading-tight"
          style={{ color: titleColor }}
          testID="experience-title"
        >
          {title}
        </ThemedText>
        {themeKey && (
          <ThemedText
            className="text-sm font-semibold capitalize"
            style={{ color: subtextColor }}
            testID="experience-category"
          >
            {t(`experiences.categories.${themeKey}` as TranslationKeys)}
          </ThemedText>
        )}
      </TwView>

      {description && (
        <ThemedText
          className="text-sm leading-relaxed"
          style={{ color: titleColor }}
          testID="experience-description"
        >
          {description}
        </ThemedText>
      )}
    </>
  );
}

export default function TrackDetailView({
  track,
  onPurchased,
  refreshingExperience,
}: TrackDetailViewProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  // The new map is chosen per environment and takes its origins from the remote
  // config. Expo only inlines literal access, not a computed constant.
  const mapRenderer = resolveMapRenderer(process.env.EXPO_PUBLIC_MAP_RENDERER);
  const mapConfig = useRemoteConfigStore((state) => state.config.map);
  const feedback = useFeedbackSubmit();
  const [showManualFeedback, setShowManualFeedback] = useState(false);
  const userInitiatedPlayRef = useRef(false);
  const rewind = useAudioRewind();
  const [purchaseState, purchaseActions] = usePurchase(track.id, track.free, track.price);

  const geofence = useOfflineGeofence(
    { latitude: track.latitude, longitude: track.longitude },
    { format: 'track', geoMode: track.geoMode, radiusMeters: track.radiusMeters },
  );

  useRefreshExperienceOnPurchase(purchaseState.status, !!track.audioUrl, onPurchased);

  const download = useTrackDownload(track.id, track.audioUrl, track.title);
  const player = useImmersionPlayer(download.localAudioUri, {
    title: track.title,
    id: track.id,
    slug: track.slug,
  });

  const isBypassable = track.geofenceBypassable === true;
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
  const cardBg = colors.homeExploreTracksBg + 'CC';

  return (
    <TwView className="flex-1">
      <TwView className="flex-1 bg-transparent">
        {/* Cover Image */}
        <TwView className="relative w-full h-80 overflow-hidden bg-zinc-200">
          <TwImage source={trackImage} className="w-full h-full" contentFit="cover" alt="" />
        </TwView>

        {/* Main Content Area */}
        <TwView className="relative flex-1 gap-4 p-4">
          {/* Main Details Card */}
          <TwView
            style={{ backgroundColor: cardBg, borderColor: colors.border }}
            className="w-full border px-4 py-6 rounded-[24px] shadow-md backdrop-blur-md gap-6 z-10"
          >
            <TrackCardHeader
              title={track.title}
              themeKey={track.themeKey}
              description={track.description}
              titleColor={colors.homeCardText}
              subtextColor={colors.homeCardSubtext}
            />

            {/* Map for track origin point */}
            {track.latitude != null && track.longitude != null && (
              <TwView
                className="mt-3 -mx-3 relative rounded-xl overflow-hidden"
                testID="track-detail-map"
              >
                <TrackMap
                  renderer={mapRenderer}
                  archiveUrl={mapConfig?.archiveUrl ?? ''}
                  styleUrl={mapConfig?.styleUrl || undefined}
                  track={track}
                  userCoordinates={geofence.userCoordinates ?? undefined}
                />
              </TwView>
            )}

            {/* Block playback banner if the track geo gate says not playable */}
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
                  onRestore={async (email) => purchaseActions.restore(email)}
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

            {/* Action buttons (Feedback & Contact) */}
            <TwView className="self-stretch mt-2 gap-2">
              <Button
                label={t('feedback.form.title')}
                variant="primary"
                testID="feedback-manual-button"
                accessibilityLabel={t('feedback.form.title')}
                onPress={() => setShowManualFeedback(true)}
              />

              <LeadCaptureButton source="track_detail" experienceId={track.id} />
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
