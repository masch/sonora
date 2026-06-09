import { useAppTranslation } from '@/hooks/use-translation';
import * as Device from 'expo-device';
import { Trans } from 'react-i18next';
import { Platform } from 'react-native';

import { AnimatedIcon } from '@/components/animated-icon';
import AudioMediaControls from '@/components/audio-media-controls';
import DownloadProgressCard from '@/components/download-progress-card';
import GpsPrecisionBadge from '@/components/gps-precision-badge';
import { HintRow } from '@/components/hint-row';
import { ScrollScreenWrapper, TAB_BAR_INSET } from '@/components/screen-wrapper';
import { ThemedText } from '@/components/themed-text';
import { WebBadge } from '@/components/web-badge';
import { Icon } from '@/components/icon';
import { useImmersionPlayer } from '@/hooks/use-immersion-player';
import { useOfflineGeofence } from '@/hooks/use-offline-geofence';
import { useTripDownload } from '@/hooks/use-trip-download';
import { TwView } from '@/tw';
import { TwImage } from '@/tw/image';

const bannerBg = require('@/assets/images/sonora/banner-fondo-logo-1.png');
const logoImg = require('@/assets/images/sonora/logo.png');
const mainBg = require('@/assets/images/sonora/fondo-recorridos-sec-1.png');

// Web: fixed padding below the horizontal tab bar via Tailwind spacing
const CONTENT_PADDING = 'pb-6';

// Technical constants (paths & commands) excluded from translation lists
const HINT_FILE_PATH = 'src/app/explore.tsx';
const RESET_PROJECT_COMMAND = 'npm run reset-project';

export default function ExploreScreen() {
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

  return (
    <ScrollScreenWrapper disableBottomPadding contentContainerClassName={CONTENT_PADDING}>
      <TwView className="flex-1">
        {/* Top Banner */}
        <TwView className="relative w-full h-48 overflow-hidden items-center justify-center bg-zinc-950">
          <TwImage
            source={bannerBg}
            className="absolute inset-0 w-full h-full"
            contentFit="cover"
            alt=""
          />
          <TwView className="w-40 h-40 items-center justify-center z-10">
            <TwImage source={logoImg} className="w-full h-full" contentFit="contain" alt="" />
          </TwView>
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
        <TwView
          className="relative flex-1 gap-4 p-4"
          style={Platform.OS === 'ios' ? { paddingBottom: TAB_BAR_INSET } : undefined}
        >
          <TwImage source={mainBg} className="absolute inset-0" contentFit="cover" alt="" />

          {/* Main Card */}
          <TwView className="w-full max-w-[800px] self-center bg-white/80 p-6 rounded-[24px] shadow-md backdrop-blur-md gap-4 z-10">
            <TwView className="items-center justify-center gap-4 py-4">
              <AnimatedIcon />
              <ThemedText className="text-2xl font-black text-center text-zinc-800 tracking-wider">
                {t('index.title')}
              </ThemedText>
              <ThemedText className="text-zinc-600 font-bold text-[10px] leading-relaxed uppercase tracking-wider">
                {t('index.getStarted')}
              </ThemedText>
            </TwView>

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
              <TwView className="bg-white/50 border border-zinc-200/30 gap-2 self-stretch p-4 rounded-xl items-center">
                <ThemedText className="text-sm text-zinc-600">
                  {t('index.waitingForDownload')}
                </ThemedText>
              </TwView>
            ) : null}

            {/* Development Hints */}
            <TwView className="bg-white/50 border border-zinc-200/30 gap-4 self-stretch p-4 rounded-xl">
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
        </TwView>
      </TwView>
    </ScrollScreenWrapper>
  );
}
