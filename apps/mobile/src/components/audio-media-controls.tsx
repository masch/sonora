import { useAppTranslation } from '@/hooks/use-translation';
import { TwText, TwView } from '@/tw';
import { IconButton } from '@/components/ui/icon-button';
import { formatTime } from '@/utils/time';

export type MediaStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error';

interface AudioMediaControlsProps {
  status: MediaStatus;
  positionMs: number;
  durationMs: number;
  errorMsg: string | null;
  onPlay: () => void;
  onPause: () => void;
  onStop?: () => void;
  onRewind?: () => void;
  onReset?: () => void;
  disabled?: boolean;
}

interface ResetButtonProps {
  onReset: () => void;
  disabled: boolean;
  positionMs: number;
}

function ResetButton({ onReset, disabled, positionMs }: ResetButtonProps) {
  const { t } = useAppTranslation();
  const isDisabled = disabled || positionMs === 0;

  return (
    <TwView className="flex-1 max-w-[160px]">
      <IconButton
        accessibilityLabel={t('components.mediaControls.btnReset')}
        testID="audio-reset-button"
        onPress={onReset}
        disabled={isDisabled}
        variant="secondary"
        size="md"
        className="w-full h-[44px]"
        icon={{
          ios: 'arrow.counterclockwise',
          android: 'replay',
          web: 'replay',
        }}
      />
    </TwView>
  );
}

interface PlayPauseButtonProps {
  isPlaying: boolean;
  disabled: boolean;
  onPlay: () => void;
  onPause: () => void;
}

function PlayPauseButton({ isPlaying, disabled, onPlay, onPause }: PlayPauseButtonProps) {
  const { t } = useAppTranslation();
  const isDisabled = disabled && !isPlaying;

  return (
    <TwView className="flex-1 max-w-[160px]">
      <IconButton
        accessibilityLabel={
          isPlaying ? t('components.mediaControls.btnPause') : t('components.mediaControls.btnPlay')
        }
        testID={isPlaying ? 'audio-pause-button' : 'audio-play-button'}
        onPress={isPlaying ? onPause : onPlay}
        disabled={isDisabled}
        variant={isPlaying ? 'warning' : 'primary'}
        size="md"
        className="w-full h-[44px]"
        icon={
          isPlaying
            ? { ios: 'pause.fill', android: 'pause', web: 'pause' }
            : { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }
        }
      />
    </TwView>
  );
}

interface RewindButtonProps {
  onRewind: () => void;
  disabled: boolean;
  positionMs: number;
}

function RewindButton({ onRewind, disabled, positionMs }: RewindButtonProps) {
  const { t } = useAppTranslation();
  const isDisabled = disabled || positionMs === 0;

  return (
    <TwView className="flex-1 max-w-[160px]">
      <IconButton
        accessibilityLabel={t('components.mediaControls.btnRewind')}
        testID="audio-rewind-button"
        onPress={onRewind}
        disabled={isDisabled}
        variant="secondary"
        size="md"
        className="w-full h-[44px]"
        icon={{
          ios: 'gobackward.10',
          android: 'replay_10',
          web: 'replay_10',
        }}
      />
    </TwView>
  );
}

interface PlaybackTimeProps {
  positionMs: number;
  durationMs: number;
}

function PlaybackTime({ positionMs, durationMs }: PlaybackTimeProps) {
  const { t } = useAppTranslation();
  const hasDuration = durationMs > 0;
  return (
    <TwText className="text-center text-lg font-code text-zinc-700 dark:text-zinc-300 font-extrabold">
      {formatTime(positionMs)}
      {hasDuration && (
        <TwText className="text-zinc-500 dark:text-zinc-400">
          {`${t('components.mediaControls.timeSeparator')}${formatTime(durationMs)}`}
        </TwText>
      )}
    </TwText>
  );
}

export default function AudioMediaControls({
  status,
  positionMs,
  durationMs,
  errorMsg,
  onPlay,
  onPause,
  onRewind,
  onReset,
  disabled = false,
}: AudioMediaControlsProps) {
  const { t } = useAppTranslation();

  const isPlaying = status === 'playing';
  const isLoading = status === 'loading';
  const isError = status === 'error';
  const showTime = durationMs > 0 || isPlaying || status === 'paused';

  return (
    <TwView
      className="card-container gap-4 self-stretch p-4 rounded-[24px]"
      testID="audio-media-controls"
    >
      {isLoading && (
        <TwText className="text-sm text-zinc-600 text-center font-bold">
          {t('components.mediaControls.statusLoading')}
        </TwText>
      )}

      {showTime && <PlaybackTime positionMs={positionMs} durationMs={durationMs} />}

      {isError && errorMsg && (
        <TwText className="text-xs text-rose-600 font-bold">{errorMsg}</TwText>
      )}

      <TwView className="flex-row gap-4 justify-center">
        {onReset && <ResetButton onReset={onReset} disabled={disabled} positionMs={positionMs} />}

        <PlayPauseButton
          isPlaying={isPlaying}
          disabled={disabled}
          onPlay={onPlay}
          onPause={onPause}
        />

        {onRewind && (
          <RewindButton onRewind={onRewind} disabled={disabled} positionMs={positionMs} />
        )}
      </TwView>
    </TwView>
  );
}
