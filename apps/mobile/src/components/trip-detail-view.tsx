import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { BottomModal } from '@/components/ui/bottom-modal';
import FeedbackForm from '@/components/feedback-form';
import GeofenceBlockedBanner from '@/components/geofence-blocked-banner';
import GpsPrecisionBadge from '@/components/gps-precision-badge';
import { ThemedText } from '@/components/themed-text';
import TrackDetailMap from './track-detail-map';
import UnifiedAudioController from '@/components/unified-audio-controller';
import { useRemoteConfigStore } from '@/store/remote-config-store';
import { TRACK_IMAGES, DEFAULT_TRACK_IMAGE } from '@/constants/images';
import { type TripExperience } from '@/data/experiences';
import { useFeedbackTrigger } from '@/hooks/use-feedback-trigger';
import { useFeedbackSubmit } from '@/hooks/use-feedback-submit';
import { useImmersionPlayer } from '@/hooks/use-immersion-player';
import { useOfflineGeofence } from '@/hooks/use-offline-geofence';
import { useAppTranslation } from '@/hooks/use-translation';
import { useConfirm } from '@/hooks/use-confirm';
import { useTrackDownload } from '@/hooks/use-track-download';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { TwPressable, TwView } from '@/tw';
import { TwImage } from '@/tw/image';
import { Icon } from '@/components/icon';
import { PaymentPrompt } from '@/components/payment-prompt';
import { usePurchase } from '@/hooks/use-purchase';
import { PaymentClient } from '@/services/payment-client';
import { getUserEmail } from '@/storage/app-storage';
import type { TranslationKeys } from '@/i18n/types';
import { formatDistance } from '@/utils/format-distance';

interface TripDetailViewProps {
  track: TripExperience;
}

export default function TripDetailView({ track }: TripDetailViewProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const feedback = useFeedbackSubmit();
  const [showManualFeedback, setShowManualFeedback] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showGeofenceBlockedAlert, setShowGeofenceBlockedAlert] = useState(false);
  const userInitiatedPlayRef = useRef(false);

  const geofence = useOfflineGeofence({
    latitude: track.latitude,
    longitude: track.longitude,
  });
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
    isNearStart: geofence.isNearStart,
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

  const isBypassable = track.geofenceBypassable === true;
  const bypassGeofence = useRemoteConfigStore((s) => s.config.geofence.bypassGeofence);
  const rewindOffsetMs = useRemoteConfigStore((s) => s.config.audio.rewindOffsetMs);
  const [purchaseState, purchaseActions] = usePurchase(track.id, track.free, track.price);
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

  const cardBg = colors.homeExploreRoutesBg + 'CC';

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
        <TwView
          style={{ backgroundColor: cardBg, borderColor: colors.border }}
          className="w-full max-w-[800px] self-center border px-3 py-6 rounded-[24px] shadow-md backdrop-blur-md gap-4 z-10"
        >
          {/* Track header */}
          <TwView className="items-center gap-2 p-2 w-full">
            <ThemedText
              numberOfLines={1}
              adjustsFontSizeToFit
              className="text-2xl font-black text-center px-2"
              style={{ color: colors.homeCardText }}
            >
              {track.title + ' '}
            </ThemedText>
            <ThemedText
              className="font-bold text-[10px] leading-relaxed uppercase tracking-wider"
              style={{ color: colors.homeCardSubtext }}
            >
              {t('experiences.duration', { minutes: Math.round(track.durationSeconds / 60) })}
            </ThemedText>
          </TwView>

          <ThemedText
            className="text-center text-sm font-bold leading-relaxed p-2 rounded-xl bg-white/40 dark:bg-zinc-800/40"
            style={{ color: colors.homeCardText }}
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
              onRestore={async (email) => {
                return purchaseActions.restore(email);
              }}
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
              onRewind={() => player.seekTo(Math.max(0, player.positionMs - rewindOffsetMs))}
              onReset={() => player.seekTo(0)}
              onDownload={handleDownload}
              onCancelDownload={download.deleteTrackLocal}
              disabled={!track.audioUrl || purchaseState.status === 'loading'}
            />
          )}

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
