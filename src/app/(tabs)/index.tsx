import { useAppTranslation } from '@/hooks/use-translation';
import * as Device from 'expo-device';
import { Trans } from 'react-i18next';
import { Platform } from 'react-native';

import { AnimatedIcon } from '@/components/animated-icon';
import AudioMediaControls from '@/components/audio-media-controls';
import DownloadProgressCard from '@/components/download-progress-card';
import GpsPrecisionBadge from '@/components/gps-precision-badge';
import { HintRow } from '@/components/hint-row';
import { ScreenWrapper, ScrollScreenWrapper } from '@/components/screen-wrapper';
import { ThemedText } from '@/components/themed-text';
import { WebBadge } from '@/components/web-badge';
import { useImmersionPlayer } from '@/hooks/use-immersion-player';
import { useOfflineGeofence } from '@/hooks/use-offline-geofence';
import { useTripDownload } from '@/hooks/use-trip-download';
import { TwText, TwView } from '@/tw';

// Web: fixed padding below the horizontal tab bar via Tailwind spacing
const CONTENT_PADDING = 'pt-16 pb-6';

// Technical constants (paths & commands) excluded from translation lists
const HINT_FILE_PATH = 'src/app/index.tsx';
const RESET_PROJECT_COMMAND = 'npm run reset-project';

export default function HomeScreen() {
  const { t } = useAppTranslation();

  const getDevMenuHint = () => {
    if (Platform.OS === 'web') {
      return <ThemedText type="small">{t('index.hints.devtoolsWeb')}</ThemedText>;
    }
    if (Device.isDevice) {
      return (
        <ThemedText type="small">
          <Trans
            i18nKey="index.hints.devtoolsDevice"
            components={[<ThemedText key="code" type="code" />]}
          />
        </ThemedText>
      );
    }
    return (
      <ThemedText type="small">
        <Trans
          i18nKey={
            Platform.OS === 'android' ? 'index.hints.devtoolsAndroid' : 'index.hints.devtoolsIos'
          }
          components={[<ThemedText key="code" type="code" />]}
        />
      </ThemedText>
    );
  };

  const geofence = useOfflineGeofence({
    latitude: -32.21218267316605,
    longitude: -64.73809012343702,
  });

  const download = useTripDownload(
    'umepay-bosque',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  );

  const player = useImmersionPlayer(download.localAudioUri);

  const innerView = (
    <TwView className="self-center w-full max-w-[800px] px-6 items-center gap-4">
      <TwView className="items-center justify-center px-6 gap-6 py-16">
        <AnimatedIcon />
        <TwText className="text-3xl font-bold text-center">{t('index.title')}</TwText>
      </TwView>

      <ThemedText type="code" className="uppercase">
        {t('index.getStarted')}
      </ThemedText>

      <GpsPrecisionBadge
        gpsStatus={geofence.gpsStatus}
        gpsAccuracy={geofence.gpsAccuracy}
        distanceMeters={geofence.distanceMeters}
        isNearStart={geofence.isNearStart}
        requiredRadiusMeters={geofence.requiredRadiusMeters}
      />

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

      <TwView className="bg-backgroundElement gap-6 self-stretch p-4 rounded-[24px]">
        <HintRow
          title={t('index.hints.editing')}
          hint={<ThemedText type="code">{HINT_FILE_PATH}</ThemedText>}
        />
        <HintRow title={t('index.hints.devtools')} hint={getDevMenuHint()} />
        <HintRow
          title={t('index.hints.freshStart')}
          hint={<ThemedText type="code">{RESET_PROJECT_COMMAND}</ThemedText>}
        />
      </TwView>

      {Platform.OS === 'web' && <WebBadge />}
    </TwView>
  );

  if (Platform.OS === 'web') {
    return (
      <ScreenWrapper>
        <TwView className={`${CONTENT_PADDING} flex-1`}>{innerView}</TwView>
      </ScreenWrapper>
    );
  }

  return (
    <ScrollScreenWrapper contentContainerClassName={CONTENT_PADDING}>
      {innerView}
    </ScrollScreenWrapper>
  );
}
