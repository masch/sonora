import { Icon, type GenericIconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useAudioRewind } from '@/hooks/use-audio-rewind';
import { useImmersionPlayer } from '@/hooks/use-immersion-player';
import { useInstructionsAudio } from '@/hooks/use-instructions-audio';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useTrackDownload } from '@/hooks/use-track-download';
import { useAppTranslation } from '@/hooks/use-translation';
import { TwPressable, TwView } from '@/tw';
import { formatTime } from '@/utils/time';
import { useEffect, useRef } from 'react';

export function HomeAudioPlayer() {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const playOnDownloadCompleteRef = useRef(false);
  const rewind = useAudioRewind();

  const { audioUrl, trackId } = useInstructionsAudio();
  const download = useTrackDownload(trackId, audioUrl, t('home.instructionsName'));
  const player = useImmersionPlayer(download.localAudioUri, {
    title: t('home.instructionsName'),
    id: trackId,
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

  const handleRewind = () => {
    if (download.status === 'completed') {
      rewind();
    }
  };

  const handleReset = () => {
    if (download.status === 'completed') {
      player.seekTo(0);
    }
  };

  const isDownloading = download.status === 'downloading';
  const isPlaying = player.status === 'playing';

  // Determine label/time string
  let statusText = t('home.instructionsSubtitle');
  if (isDownloading) {
    statusText = t('components.mediaControls.statusDownloading', {
      value: Math.round(download.progress),
    });
  } else if (download.status === 'completed' && player.durationMs > 0) {
    statusText = `${formatTime(player.positionMs)} / ${formatTime(player.durationMs)}`;
  }

  // Determine progress bar percentage
  let progressPct = 0;
  if (isDownloading) {
    progressPct = download.progress;
  } else if (download.status === 'completed' && player.durationMs > 0) {
    progressPct = (player.positionMs / player.durationMs) * 100;
  }

  // Determine main play/pause/download icon name
  let actionIconName: GenericIconName = 'play';
  if (isDownloading) {
    actionIconName = 'download';
  } else if (isPlaying) {
    actionIconName = 'pause';
  }

  return (
    <TwView className="rounded-[24px] p-5" style={{ backgroundColor: colors.homeInstructionsBg }}>
      <ThemedText className="text-sm font-bold mb-3" style={{ color: colors.homeCardSubtext }}>
        {t('home.instructionsTitle')}
      </ThemedText>

      <TwView className="flex-row items-start gap-4">
        {/* Play / Pause / Download Icon Button */}
        <TwPressable
          testID="home-audio-player"
          onPress={handlePlayPress}
          disabled={isDownloading}
          accessibilityLabel={
            isPlaying
              ? t('components.mediaControls.btnPause')
              : download.status === 'completed'
                ? t('components.mediaControls.btnPlay')
                : t('components.mediaControls.btnPlayDownload')
          }
          className="pt-1 active:opacity-75"
        >
          <TwView testID="home-player-play-button">
            <Icon name={actionIconName} size={28} tintColor={colors.homeCardText} />
          </TwView>
        </TwPressable>

        <TwView className="flex-1">
          <TwView className="flex-row justify-between items-start">
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
                <TwPressable
                  onPress={handleReset}
                  accessibilityLabel={t('components.mediaControls.btnReset')}
                  testID="home-player-reset-button"
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  className="active:opacity-75 p-2"
                >
                  <Icon name="reset" size={20} tintColor={colors.homeCardText} />
                </TwPressable>

                {/* Rewind 10s button */}
                <TwPressable
                  onPress={handleRewind}
                  accessibilityLabel={t('components.mediaControls.btnRewind')}
                  testID="home-player-rewind-button"
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  className="active:opacity-75 p-2"
                >
                  <Icon name="rewind" size={20} tintColor={colors.homeCardText} />
                </TwPressable>
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
