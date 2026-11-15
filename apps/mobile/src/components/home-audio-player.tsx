import { Icon, type GenericIconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { type ExperienceFormat } from '@/data/experiences';
import { useAudioRewind } from '@/hooks/use-audio-rewind';
import { useImmersionPlayer } from '@/hooks/use-immersion-player';
import { useInstructionsAudio } from '@/hooks/use-instructions-audio';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useTrackDownload } from '@/hooks/use-track-download';
import { useAppTranslation } from '@/hooks/use-translation';
import { TwPressable, TwView } from '@/tw';
import { Button, IconButton } from '@/components/ui/button';
import { useRemoteConfigStore } from '@/store/remote-config-store';
import { formatTime } from '@/utils/time';
import { useEffect, useRef } from 'react';

export interface HomeAudioPlayerProps {
  /** Which experience format's instructions to play; there is no default on purpose. */
  format: ExperienceFormat;
}

/** Label below the title: elapsed time when playing, download progress, or the subtitle. */
function resolveStatusText({
  download,
  player,
  subtitle,
  downloading,
}: {
  download: { status: string; progress: number };
  player: { durationMs: number; positionMs: number };
  subtitle: string;
  downloading: string;
}): string {
  if (download.status === 'downloading') return downloading;
  if (download.status === 'completed' && player.durationMs > 0) {
    return `${formatTime(player.positionMs)} / ${formatTime(player.durationMs)}`;
  }
  return subtitle;
}

/** Progress bar fill: download progress while downloading, playback position once ready. */
function resolveProgressPct({
  download,
  player,
}: {
  download: { status: string; progress: number };
  player: { durationMs: number; positionMs: number };
}): number {
  if (download.status === 'downloading') return download.progress;
  if (download.status === 'completed' && player.durationMs > 0) {
    return (player.positionMs / player.durationMs) * 100;
  }
  return 0;
}

/** Main action icon: download while fetching, pause while playing, play otherwise. */
function resolveActionIcon({
  isDownloading,
  isPlaying,
}: {
  isDownloading: boolean;
  isPlaying: boolean;
}): GenericIconName {
  if (isDownloading) return 'download';
  if (isPlaying) return 'pause';
  return 'play';
}

function InstructionsLoadingCard({
  colors,
  title,
}: {
  colors: ReturnType<typeof useThemeColors>;
  title: string;
}) {
  const { t } = useAppTranslation();

  return (
    <TwView
      className="rounded-[24px] p-5 opacity-70"
      style={{ backgroundColor: colors.homeInstructionsBg }}
      testID="home-audio-player-loading"
    >
      <TwView className="flex-row items-start gap-4">
        <TwView className="pt-1">
          <Icon name="play" size={28} tintColor={colors.homeCardText} />
        </TwView>
        <TwView className="flex-1">
          <ThemedText
            className="text-lg font-extrabold leading-tight"
            style={{ color: colors.homeCardText }}
          >
            {title}
          </ThemedText>
          <ThemedText
            className="text-sm font-semibold mt-0.5"
            style={{ color: colors.homeCardSubtext }}
          >
            {t('components.mediaControls.statusLoading')}
          </ThemedText>
        </TwView>
      </TwView>
    </TwView>
  );
}

export function HomeAudioPlayer({ format }: HomeAudioPlayerProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const { instructions, loading: configLoading, error: configError } = useInstructionsAudio(format);
  const refetchConfig = useRemoteConfigStore((state) => state.refetch);
  const resolved = configLoading ? null : instructions;
  const audioUrl = resolved?.audioUrl ?? null;
  const trackId = resolved?.slug ?? null;

  const playOnDownloadCompleteRef = useRef(false);
  const rewind = useAudioRewind();

  const download = useTrackDownload(trackId, audioUrl, t('home.instructionsName'));
  const player = useImmersionPlayer(download.localAudioUri, {
    title: t('home.instructionsName'),
    id: trackId ?? undefined,
  });

  // Auto-play when download completes if requested by user
  useEffect(() => {
    if (
      download.status === 'completed' &&
      playOnDownloadCompleteRef.current &&
      download.localAudioUri
    ) {
      playOnDownloadCompleteRef.current = false;
      player.play();
    }
  }, [download.status, download.localAudioUri, player]);

  const handlePlayPress = () => {
    if (download.status !== 'completed') {
      playOnDownloadCompleteRef.current = true;
      download.startDownload();
    } else {
      if (player.status === 'playing') {
        player.pause();
      } else {
        player.play();
      }
    }
  };

  // Rewind and reset act on the shared player, so they only run when this
  // card's audio is the one playing — an idle card must not seek another
  // format's player.
  const handleRewind = () => {
    if (download.status === 'completed' && player.isCurrentTrack) {
      rewind();
    }
  };

  const handleReset = () => {
    if (download.status === 'completed' && player.isCurrentTrack) {
      player.seekTo(0);
    }
  };

  const isDownloading = download.status === 'downloading';
  const isPlaying = player.status === 'playing';

  const statusText = resolveStatusText({
    download,
    player,
    subtitle: t('home.instructionsSubtitle'),
    downloading: t('components.mediaControls.statusDownloading', {
      value: Math.round(download.progress),
    }),
  });
  const progressPct = resolveProgressPct({ download, player });
  const actionIconName = resolveActionIcon({ isDownloading, isPlaying });

  // Loading card after every hook, so hook order stays stable across the
  // loading -> ready transition.
  if (configLoading) {
    return <InstructionsLoadingCard colors={colors} title={t('home.instructionsName')} />;
  }

  // The config request failed without a cache: a distinct state with a retry,
  // so a failed fetch is not mistaken for an unconfigured format.
  if (configError) {
    return (
      <TwView
        className="rounded-[24px] p-5"
        style={{ backgroundColor: colors.homeInstructionsBg }}
        testID="home-audio-player-error"
      >
        <ThemedText className="text-sm font-semibold" style={{ color: colors.homeCardText }}>
          {t('components.mediaControls.configError')}
        </ThemedText>
        <Button
          variant="outline"
          size="sm"
          onPress={() => refetchConfig()}
          label={t('components.mediaControls.configRetry')}
          testID="home-audio-player-error-retry"
          accessibilityLabel={t('components.mediaControls.configRetry')}
          className="mt-3 self-start"
        />
      </TwView>
    );
  }

  // The config answered without instructions for this format: nothing to offer.
  if (!resolved) {
    return null;
  }

  return (
    <TwView className="rounded-[24px] p-5" style={{ backgroundColor: colors.homeInstructionsBg }}>
      <TwView className="flex-row items-start gap-4">
        {/* Play / Pause / Download Icon Button */}
        <IconButton
          testID="home-audio-player"
          iconName={actionIconName}
          onPress={handlePlayPress}
          disabled={isDownloading}
          accessibilityLabel={
            isPlaying
              ? t('components.mediaControls.btnPause')
              : download.status === 'completed'
                ? t('components.mediaControls.btnPlay')
                : t('components.mediaControls.btnPlayDownload')
          }
          variant="ghost"
          size="lg"
          tintColor={colors.homeCardText}
          iconSize={30}
          className="self-center"
        />

        <TwView className="flex-1">
          <TwView className="flex-row justify-between items-start">
            {/* Compound title+subtitle surface (card row, rich text): `Button`
                fixes its own typography and cannot express the card title. */}
            <TwPressable
              testID="home-player-title-button"
              onPress={handlePlayPress}
              disabled={isDownloading}
              className="flex-1 mr-2 active:opacity-75"
              accessibilityLabel={t('home.instructionsName')}
            >
              <ThemedText
                className="text-lg font-extrabold leading-tight"
                style={{ color: colors.homeCardText }}
              >
                {t('home.instructionsName')}
              </ThemedText>
              <ThemedText
                className="text-sm font-semibold mt-0.5"
                style={{ color: colors.homeCardSubtext }}
              >
                {statusText}
              </ThemedText>
            </TwPressable>

            {/* Compact Mini Controls (Only shown when downloaded) */}
            {download.status === 'completed' && (
              <TwView className="flex-row items-center gap-1 pt-1">
                {/* Reset button */}
                <IconButton
                  onPress={handleReset}
                  accessibilityLabel={t('components.mediaControls.btnReset')}
                  testID="home-player-reset-button"
                  iconName="reset"
                  variant="ghost"
                  size="sm"
                  tintColor={colors.homeCardText}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                />

                {/* Rewind 10s button */}
                <IconButton
                  onPress={handleRewind}
                  accessibilityLabel={t('components.mediaControls.btnRewind')}
                  testID="home-player-rewind-button"
                  iconName="rewind"
                  variant="ghost"
                  size="sm"
                  tintColor={colors.homeCardText}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                />
              </TwView>
            )}
          </TwView>

          {/* Progress Bar */}
          <TwView className="h-1 bg-zinc-300/60 rounded-full mt-4 w-full overflow-hidden">
            <TwView
              testID="home-player-progress-bar-fill"
              className="h-full"
              style={{
                backgroundColor: colors.homeCardText,
                width: `${Math.min(100, Math.max(0, progressPct))}%`,
              }}
            />
          </TwView>

          {/* Error Message */}
          {(download.errorMsg || player.errorMsg) && (
            <ThemedText className="text-xs text-rose-600 font-bold mt-2">
              {download.errorMsg || player.errorMsg}
            </ThemedText>
          )}
        </TwView>
      </TwView>
    </TwView>
  );
}
