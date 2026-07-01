import { useState, useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';

import FeedbackForm from '@/components/feedback-form';
import GeofenceBlockedBanner from '@/components/geofence-blocked-banner';
import GpsPrecisionBadge from '@/components/gps-precision-badge';
import { ThemedText } from '@/components/themed-text';
import TrackDetailMap from './track-detail-map';
import UnifiedAudioController from '@/components/unified-audio-controller';
import { APP_CONFIG } from '@/config/app-config';
import { TRACK_IMAGES, DEFAULT_TRACK_IMAGE } from '@/constants/images';
import { type TripExperience } from '@/data/experiences';
import { useFeedbackTrigger } from '@/hooks/use-feedback-trigger';
import { useFeedbackSubmit } from '@/hooks/use-feedback-submit';
import { useImmersionPlayer } from '@/hooks/use-immersion-player';
import { useOfflineGeofence } from '@/hooks/use-offline-geofence';
import { useAppTranslation } from '@/hooks/use-translation';
import { useTrackDownload } from '@/hooks/use-track-download';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { TwPressable, TwView } from '@/tw';
import { TwImage } from '@/tw/image';
import { Icon } from '@/components/icon';
import type { TranslationKeys } from '@/i18n/types';

function formatDistance(d: number | null, fallbackText: string): string {
  if (d === null) return fallbackText;
  if (d >= 1000) return `${(d / 1000).toFixed(1)} km`;
  return `${Math.round(d)} m`;
}

interface TripDetailViewProps {
  track: TripExperience;
}

export default function TripDetailView({ track }: TripDetailViewProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const feedback = useFeedbackSubmit();
  const [showManualFeedback, setShowManualFeedback] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
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
  const isPlaybackBlocked = !geofence.isNearStart && !isBypassable && !APP_CONFIG.bypassGeofence;
  const showBypassWarning = !geofence.isNearStart && isBypassable && !APP_CONFIG.bypassGeofence;

  const showGeofenceBlockedAlert = () => {
    Alert.alert(
      t('experiences.geofenceBlocked.blockedAlertTitle' as TranslationKeys),
      t('experiences.geofenceBlocked.blockedAlertMessage' as TranslationKeys, {
        radius: geofence.requiredRadiusMeters,
        distance: formatDistance(
          geofence.distanceMeters,
          t('experiences.geofenceBlocked.notAvailable'),
        ),
      }),
      [{ text: t('experiences.geofenceBlocked.blockedAlertOk' as TranslationKeys) }],
    );
  };

  const triggerBypassAlert = (onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      const accepted = window.confirm(
        `${t('experiences.warnings.locationAlertTitle' as TranslationKeys)}\n\n${t(
          'experiences.warnings.locationAlertMessage' as TranslationKeys,
        )}`,
      );
      if (accepted) onConfirm();
    } else {
      Alert.alert(
        t('experiences.warnings.locationAlertTitle' as TranslationKeys),
        t('experiences.warnings.locationAlertMessage' as TranslationKeys),
        [
          { text: t('experiences.warnings.cancel' as TranslationKeys), style: 'cancel' },
          { text: t('experiences.warnings.continue' as TranslationKeys), onPress: onConfirm },
        ],
      );
    }
  };

  const handlePlay = () => {
    if (showBypassWarning) {
      triggerBypassAlert(() => player.play());
    } else if (isPlaybackBlocked) {
      showGeofenceBlockedAlert();
    } else {
      player.play();
    }
  };

  const handleDownload = () => {
    if (showBypassWarning) {
      triggerBypassAlert(() => handlePlayAndDownload());
    } else if (isPlaybackBlocked) {
      showGeofenceBlockedAlert();
    } else {
      handlePlayAndDownload();
    }
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
            onRewind={() =>
              player.seekTo(Math.max(0, player.positionMs - APP_CONFIG.audio.rewindOffsetMs))
            }
            onReset={() => player.seekTo(0)}
            onDownload={handleDownload}
            onCancelDownload={download.deleteTrackLocal}
            disabled={!track.audioUrl}
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
