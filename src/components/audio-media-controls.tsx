import { useAppTranslation } from '@/hooks/use-translation';
import { TwPressable, TwText, TwView } from '@/tw';

export type MediaStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error';

interface AudioMediaControlsProps {
  status: MediaStatus;
  positionMs: number;
  durationMs: number;
  errorMsg: string | null;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  disabled?: boolean;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function AudioMediaControls({
  status,
  positionMs,
  durationMs,
  errorMsg,
  onPlay,
  onPause,
  onStop,
  disabled = false,
}: AudioMediaControlsProps) {
  const { t } = useAppTranslation();

  const isPlaying = status === 'playing';
  const isLoading = status === 'loading';
  const isError = status === 'error';
  const hasDuration = durationMs > 0;
  const showTime = isPlaying || status === 'paused';

  return (
    <TwView
      className="bg-white/50 border border-zinc-200/30 gap-4 self-stretch p-4 rounded-[24px]"
      testID="audio-media-controls"
    >
      {/* Status indicator */}
      {isLoading && (
        <TwText className="text-sm text-zinc-600 text-center font-bold">
          {t('components.mediaControls.statusLoading')}
        </TwText>
      )}

      {/* Playback time */}
      {showTime && (
        <TwText className="text-center text-lg font-code text-zinc-700 font-extrabold">
          {formatTime(positionMs)}
          {hasDuration && (
            <TwText className="text-zinc-500">{` / ${formatTime(durationMs)}`}</TwText>
          )}
        </TwText>
      )}

      {/* Error message */}
      {isError && errorMsg && (
        <TwText className="text-xs text-rose-600 font-bold">{errorMsg}</TwText>
      )}

      {/* Control buttons */}
      <TwView className="flex-row gap-4 justify-center">
        {/* Play/Pause button */}
        <TwView className="flex-1 max-w-[160px]">
          <TwView
            className={`rounded-xl overflow-hidden shadow-sm ${
              isPlaying
                ? 'bg-amber-600'
                : disabled
                  ? 'bg-zinc-300 dark:bg-zinc-700'
                  : 'bg-emerald-500'
            }`}
          >
            <TwPressable
              accessibilityLabel={
                isPlaying
                  ? t('components.mediaControls.btnPause')
                  : t('components.mediaControls.btnPlay')
              }
              testID={isPlaying ? 'audio-pause-button' : 'audio-play-button'}
              className="py-3 items-center active:bg-emerald-600"
              onPress={isPlaying ? onPause : onPlay}
              disabled={disabled && !isPlaying}
            >
              <TwText className="text-white font-extrabold text-sm">
                {isPlaying
                  ? t('components.mediaControls.btnPause')
                  : t('components.mediaControls.btnPlay')}
              </TwText>
            </TwPressable>
          </TwView>
        </TwView>

        {/* Stop button */}
        <TwView className="flex-1 max-w-[160px]">
          <TwView className="bg-zinc-200 dark:bg-zinc-700 rounded-xl overflow-hidden shadow-sm">
            <TwPressable
              accessibilityLabel={t('components.mediaControls.btnStop')}
              testID="audio-stop-button"
              className="py-3 items-center active:bg-zinc-300 dark:active:bg-zinc-800"
              onPress={onStop}
            >
              <TwText className="text-zinc-800 dark:text-zinc-200 font-extrabold text-sm">
                {t('components.mediaControls.btnStop')}
              </TwText>
            </TwPressable>
          </TwView>
        </TwView>
      </TwView>
    </TwView>
  );
}
