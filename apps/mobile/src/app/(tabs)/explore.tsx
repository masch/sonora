import { useAppTranslation } from '@/hooks/use-translation';
import * as Device from 'expo-device';
import { Trans } from 'react-i18next';
import { Platform } from 'react-native';

import { AnimatedIcon } from '@/components/animated-icon';
import AudioMediaControls from '@/components/audio-media-controls';
import DownloadProgressCard from '@/components/download-progress-card';
import GpsPrecisionBadge from '@/components/gps-precision-badge';
import { HintRow } from '@/components/hint-row';
import LoadingView from '@/components/loading-view';
import { ScrollScreenWrapper, TAB_BAR_INSET } from '@/components/screen-wrapper';
import { ThemedText } from '@/components/themed-text';
import { WebBadge } from '@/components/web-badge';
import { Icon } from '@/components/icon';
import { useImmersionPlayer } from '@/hooks/use-immersion-player';
import { useOfflineGeofence } from '@/hooks/use-offline-geofence';
import { useTrackDownload } from '@/hooks/use-track-download';
import {
  fetchExperiences,
  type Experience,
  type PlayableExperience,
  isPlayableExperience,
} from '@/data/experiences';
import { TwView, TwPressable } from '@/tw';
import { TwImage } from '@/tw/image';
import { useState, useEffect } from 'react';
import { logger } from '@/utils/logger';

import { SONORA_LOGO, SONORA_BANNER_BG, SONORA_MAIN_BG } from '@/constants/images';

// Web: fixed padding below the horizontal tab bar via Tailwind spacing
const CONTENT_PADDING = 'pb-6';

// Technical constants (paths & commands) excluded from translation lists
const HINT_FILE_PATH = 'src/app/explore.tsx';
const RESET_PROJECT_COMMAND = 'npm run reset-project';

/** Sub-component that only mounts when an active experience is selected.
 *  All experience-dependent hooks live here — no conditional params, no fallback values. */
function ActiveExperienceSection({ experience }: { experience: PlayableExperience }) {
  const { t } = useAppTranslation();
  const geofence = useOfflineGeofence({
    latitude: experience.latitude,
    longitude: experience.longitude,
  });
  const download = useTrackDownload(experience.slug, experience.audioUrl, experience.title);
  const player = useImmersionPlayer(download.localAudioUri, { title: experience.title });

  return (
    <>
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
        onDelete={download.deleteTrackLocal}
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
        <TwView className="card-container gap-2 self-stretch p-4 rounded-xl items-center">
          <ThemedText className="text-sm text-zinc-600 dark:text-zinc-400">
            {t('index.waitingForDownload')}
          </ThemedText>
        </TwView>
      ) : null}
    </>
  );
}

export default function ExploreScreen() {
  const { t } = useAppTranslation();

  const [activeExperience, setActiveExperience] = useState<Experience | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadExperience = async () => {
    setLoading(true);
    setError(false);
    try {
      const exps = await fetchExperiences();
      if (exps.length > 0) {
        setActiveExperience(exps[0]);
      }
      setError(false);
    } catch (e) {
      logger.error(e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch — no setState in the effect body itself, only in async callbacks
  useEffect(() => {
    fetchExperiences()
      .then((exps) => {
        if (exps.length > 0) setActiveExperience(exps[0]);
        setError(false);
      })
      .catch((e) => {
        logger.error(e);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <ScrollScreenWrapper disableBottomPadding>
        <LoadingView message={t('index.loading')} />
      </ScrollScreenWrapper>
    );
  }

  if (error) {
    return (
      <ScrollScreenWrapper disableBottomPadding contentContainerClassName="grow">
        <TwView className="flex-grow items-center justify-center p-6">
          <ThemedText className="text-base font-bold text-text mb-4 text-center">
            {t('index.errorLoading')}
          </ThemedText>
          <TwPressable
            onPress={loadExperience}
            className="px-6 py-2.5 bg-text rounded-xl active:opacity-75"
            testID="explore-retry-button"
            accessibilityLabel={t('index.retry')}
          >
            <ThemedText themeColor="background" className="font-semibold">
              {t('index.retry')}
            </ThemedText>
          </TwPressable>
        </TwView>
      </ScrollScreenWrapper>
    );
  }

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

  return (
    <ScrollScreenWrapper disableBottomPadding contentContainerClassName={CONTENT_PADDING}>
      <TwView className="flex-1">
        {/* Top Banner */}
        <TwView className="relative w-full h-48 overflow-hidden items-center justify-center bg-zinc-950">
          <TwImage
            source={SONORA_BANNER_BG}
            className="absolute inset-0 w-full h-full"
            contentFit="cover"
            alt=""
          />
          <TwView className="size-40 items-center justify-center z-10">
            <TwImage source={SONORA_LOGO} className="w-full h-full" contentFit="contain" alt="" />
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
          <TwImage source={SONORA_MAIN_BG} className="absolute inset-0" contentFit="cover" alt="" />

          {/* Main Card */}
          <TwView className="w-full max-w-[800px] self-center card-container-solid p-6 rounded-[24px] shadow-md backdrop-blur-md gap-4 z-10">
            <TwView className="items-center justify-center gap-4 py-4">
              <AnimatedIcon />
              <ThemedText className="text-2xl font-black text-center text-zinc-800 dark:text-zinc-100 tracking-wider">
                {t('index.title')}
              </ThemedText>
              <ThemedText className="text-zinc-600 dark:text-zinc-400 font-bold text-[10px] leading-relaxed uppercase tracking-wider">
                {t('index.getStarted')}
              </ThemedText>
            </TwView>

            {!activeExperience && (
              <TwView className="items-center py-4">
                <ThemedText className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
                  {t('index.empty')}
                </ThemedText>
              </TwView>
            )}

            {activeExperience && isPlayableExperience(activeExperience) && (
              <ActiveExperienceSection experience={activeExperience} />
            )}

            {/* Development Hints */}
            <TwView className="card-container gap-4 self-stretch p-4 rounded-xl">
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
