import React from 'react';
import { useAppTranslation } from '@/hooks/use-translation';
import { TwPressable, TwView } from '@/tw';
import AudioMediaControls, { MediaStatus } from '@/components/audio-media-controls';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import type { DownloadStatus } from '@/hooks/use-trip-download';

interface UnifiedAudioControllerProps {
  downloadStatus: DownloadStatus;
  downloadProgress: number;
  downloadError: string | null;
  playerStatus: MediaStatus;
  positionMs: number;
  durationMs: number;
  playerError: string | null;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRewind?: () => void;
  onReset?: () => void;
  onDownload: () => void;
  onCancelDownload?: () => void;
  disabled?: boolean;
}

export default function UnifiedAudioController({
  downloadStatus,
  downloadProgress,
  downloadError,
  playerStatus,
  positionMs,
  durationMs,
  playerError,
  onPlay,
  onPause,
  onStop,
  onRewind,
  onReset,
  onDownload,
  onCancelDownload,
  disabled = false,
}: UnifiedAudioControllerProps) {
  const { t } = useAppTranslation();

  const isDownloading = downloadStatus === 'downloading';
  const isDownloaded = downloadStatus === 'completed';
  const isError = downloadStatus === 'error' || playerStatus === 'error';
  const errorMsg = downloadError || playerError;

  // 1. Initial State: Undownloaded audio, ready to Download and Play
  if (!isDownloaded && !isDownloading) {
    return (
      <TwView
        className="card-container gap-4 self-stretch p-4 rounded-[24px]"
        testID="unified-audio-controller-idle"
      >
        {isError && errorMsg && (
          <ThemedText className="text-xs text-rose-600 font-bold text-center">
            {errorMsg}
          </ThemedText>
        )}
        <TwView className="bg-emerald-500 rounded-xl overflow-hidden shadow-sm self-center w-full max-w-[160px]">
          <TwPressable
            accessibilityLabel={t('components.mediaControls.btnPlayDownload')}
            testID="play-download-button"
            className="py-3 items-center active:bg-emerald-600 flex-row justify-center gap-2"
            onPress={onDownload}
            disabled={disabled}
          >
            <Icon
              ios="play.fill"
              android="play_arrow"
              web="play_arrow"
              size={20}
              tintColor="#ffffff"
            />
          </TwPressable>
        </TwView>
      </TwView>
    );
  }

  // 2. Downloading state: Show progress bar, percentage, and Cancel option
  if (isDownloading) {
    return (
      <TwView
        className="card-container gap-4 self-stretch p-5 rounded-[24px] items-center"
        testID="unified-audio-controller-downloading"
      >
        <ThemedText className="text-xs text-zinc-500 font-bold tracking-wider uppercase">
          {t('components.mediaControls.statusDownloading', { value: Math.round(downloadProgress) })}
        </ThemedText>

        <TwView className="w-full gap-2">
          {/* Progress bar container */}
          <TwView className="h-2.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden w-full relative">
            <TwView
              testID="download-progress-bar-fill"
              className="h-full rounded-full bg-emerald-500 animate-pulse"
              style={{ width: `${Math.min(100, Math.max(0, downloadProgress))}%` }}
            />
          </TwView>
        </TwView>

        {onCancelDownload && (
          <TwView className="bg-zinc-200 dark:bg-zinc-700 rounded-xl overflow-hidden shadow-sm max-w-[120px] w-full">
            <TwPressable
              accessibilityLabel={t('components.mediaControls.btnCancel')}
              testID="cancel-download-button"
              className="py-2 items-center active:bg-zinc-300 dark:active:bg-zinc-800"
              onPress={onCancelDownload}
            >
              <ThemedText className="text-zinc-800 dark:text-zinc-200 font-bold text-xs">
                {t('components.mediaControls.btnCancel')}
              </ThemedText>
            </TwPressable>
          </TwView>
        )}
      </TwView>
    );
  }

  // 3. Downloaded state: Audio player
  return (
    <AudioMediaControls
      status={playerStatus}
      positionMs={positionMs}
      durationMs={durationMs}
      errorMsg={errorMsg}
      onPlay={onPlay}
      onPause={onPause}
      onStop={onStop}
      onRewind={onRewind}
      onReset={onReset}
      disabled={disabled}
    />
  );
}
