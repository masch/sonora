import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import AudioMediaControls from '@/components/audio-media-controls';
import DownloadProgressCard from '@/components/download-progress-card';
import GpsPrecisionBadge from '@/components/gps-precision-badge';
import { ScreenWrapper, ScrollScreenWrapper } from '@/components/screen-wrapper';
import { ThemedText } from '@/components/themed-text';
import { getTripById } from '@/data/trips';
import { useImmersionPlayer } from '@/hooks/use-immersion-player';
import { useOfflineGeofence } from '@/hooks/use-offline-geofence';
import { useAppTranslation } from '@/hooks/use-translation';
import { useTripDownload } from '@/hooks/use-trip-download';
import { TwText, TwView } from '@/tw';

interface TripDetailViewProps {
  tripId: string;
}

// Web: fixed padding below the horizontal tab bar via Tailwind spacing
const CONTENT_PADDING = 'pt-16 pb-6';

/**
 * Shared trip detail view used by both trips/[id].tsx (dynamic route) and
 * walk.tsx (dedicated tab). Receives a concrete tripId instead of reading
 * from route params, so it works in both contexts.
 */
export default function TripDetailView({ tripId }: TripDetailViewProps) {
  const { t } = useAppTranslation();

  const trip = getTripById(tripId);

  // Hooks MUST be called unconditionally (rules-of-hooks)
  const geofence = useOfflineGeofence(trip?.startCoordinates ?? { latitude: 0, longitude: 0 });
  const download = useTripDownload(trip?.id ?? null, trip?.audioRemoteUrl ?? null);
  const player = useImmersionPlayer(download.localAudioUri);

  if (!trip) {
    return (
      <ScreenWrapper>
        <TwView className="flex-1 items-center justify-center px-6">
          <Stack.Screen options={{ title: t('trips.notFound') }} />
          <ThemedText themeColor="text">{t('trips.notFound')}</ThemedText>
        </TwView>
      </ScreenWrapper>
    );
  }

  const innerView = (
    <TwView className="self-center w-full max-w-[800px] px-6 items-center gap-6">
      {/* Trip header */}
      <TwView className="items-center gap-2 pt-6">
        <ThemedText type="default" className="text-2xl font-bold text-center">
          {trip.title}
        </ThemedText>
        <ThemedText type="small" className="text-center">
          {t('trips.duration', { minutes: trip.durationMinutes })}
        </ThemedText>
      </TwView>

      <ThemedText type="default" className="text-center">
        {trip.description}
      </ThemedText>

      {/* GPS precision */}
      <GpsPrecisionBadge
        gpsStatus={geofence.gpsStatus}
        gpsAccuracy={geofence.gpsAccuracy}
        distanceMeters={geofence.distanceMeters}
        isNearStart={geofence.isNearStart}
        requiredRadiusMeters={geofence.requiredRadiusMeters}
      />

      {/* Download card */}
      <DownloadProgressCard
        status={download.status}
        progress={download.progress}
        errorMsg={download.errorMsg}
        onDownload={download.startDownload}
        onDelete={download.deleteTripLocal}
      />

      {/* Audio player — only shown when download completed */}
      {download.status === 'completed' ? (
        <AudioMediaControls
          status={player.status}
          positionMs={player.positionMs}
          durationMs={player.durationMs}
          errorMsg={player.errorMsg}
          onPlay={player.play}
          onPause={player.pause}
          onStop={player.stop}
          disabled={!download.localAudioUri}
        />
      ) : download.status === 'downloading' ? (
        <TwView className="bg-backgroundElement gap-2 self-stretch p-4 rounded-[24px] items-center">
          <TwText className="text-sm text-zinc-400">{t('index.waitingForDownload')}</TwText>
        </TwView>
      ) : null}
    </TwView>
  );

  return (
    <TwView className="flex-1">
      <Stack.Screen options={{ title: trip.title }} />
      {Platform.OS === 'web' ? (
        <ScreenWrapper>
          <TwView className={`${CONTENT_PADDING} flex-1`}>{innerView}</TwView>
        </ScreenWrapper>
      ) : (
        <ScrollScreenWrapper contentContainerClassName={CONTENT_PADDING}>
          {innerView}
        </ScrollScreenWrapper>
      )}
    </TwView>
  );
}
