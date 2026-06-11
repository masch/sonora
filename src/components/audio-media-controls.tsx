import { useAppTranslation } from '@/hooks/use-translation';
import { TwPressable, TwText, TwView } from '@/tw';
import { Icon } from '@/components/icon';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { formatTime } from '@/utils/time';

export type MediaStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error';

interface AudioMediaControlsProps {
  status: MediaStatus;
  positionMs: number;
  durationMs: number;
  errorMsg: string | null;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRewind?: () => void;
  onReset?: () => void;
  disabled?: boolean;
}

export default function AudioMediaControls({
  status,
  positionMs,
  durationMs,
  errorMsg,
  onPlay,
  onPause,
  onStop,
  onRewind,
  onReset,
  disabled = false,
}: AudioMediaControlsProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();

  const isPlaying = status === 'playing';
  const isLoading = status === 'loading';
  const isError = status === 'error';
  const hasDuration = durationMs > 0;
  const showTime = durationMs > 0 || isPlaying || status === 'paused';

  return (
    <TwView
      className="card-container gap-4 self-stretch p-4 rounded-[24px]"
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
        <TwText className="text-center text-lg font-code text-zinc-700 dark:text-zinc-300 font-extrabold">
          {formatTime(positionMs)}
          {hasDuration && (
            <TwText className="text-zinc-500 dark:text-zinc-400">{` / ${formatTime(durationMs)}`}</TwText>
          )}
        </TwText>
      )}

      {/* Error message */}
      {isError && errorMsg && (
        <TwText className="text-xs text-rose-600 font-bold">{errorMsg}</TwText>
      )}

      {/* Control buttons */}
      <TwView className="flex-row gap-4 justify-center">
        {/* Reset button */}
        {onReset && (
          <TwView className="flex-1 max-w-[160px]">
            <TwView
              className={`bg-zinc-200 dark:bg-zinc-700 rounded-xl overflow-hidden shadow-sm ${
                disabled || positionMs === 0 ? 'opacity-50' : ''
              }`}
            >
              <TwPressable
                accessibilityLabel={t('components.mediaControls.btnReset')}
                testID="audio-reset-button"
                className="py-3 items-center justify-center h-[44px] active:bg-zinc-300 dark:active:bg-zinc-800"
                onPress={onReset}
                disabled={disabled || positionMs === 0}
              >
                <Icon
                  ios="arrow.counterclockwise"
                  android="replay"
                  web="replay"
                  size={20}
                  tintColor={disabled || positionMs === 0 ? '#a1a1aa' : colors.text}
                />
              </TwPressable>
            </TwView>
          </TwView>
        )}

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
              className="py-3 items-center justify-center h-[44px] active:bg-emerald-600"
              onPress={isPlaying ? onPause : onPlay}
              disabled={disabled && !isPlaying}
            >
              {isPlaying ? (
                <Icon ios="pause.fill" android="pause" web="pause" size={20} tintColor="#ffffff" />
              ) : (
                <Icon
                  ios="play.fill"
                  android="play_arrow"
                  web="play_arrow"
                  size={20}
                  tintColor="#ffffff"
                />
              )}
            </TwPressable>
          </TwView>
        </TwView>

        {/* Rewind button */}
        {onRewind && (
          <TwView className="flex-1 max-w-[160px]">
            <TwView
              className={`bg-zinc-200 dark:bg-zinc-700 rounded-xl overflow-hidden shadow-sm ${
                disabled || positionMs === 0 ? 'opacity-50' : ''
              }`}
            >
              <TwPressable
                accessibilityLabel={t('components.mediaControls.btnRewind')}
                testID="audio-rewind-button"
                className="py-3 items-center justify-center h-[44px] active:bg-zinc-300 dark:active:bg-zinc-800"
                onPress={onRewind}
                disabled={disabled || positionMs === 0}
              >
                <Icon
                  ios="gobackward.10"
                  android="replay_10"
                  web="replay_10"
                  size={20}
                  tintColor={disabled || positionMs === 0 ? '#a1a1aa' : colors.text}
                />
              </TwPressable>
            </TwView>
          </TwView>
        )}
      </TwView>
    </TwView>
  );
}
