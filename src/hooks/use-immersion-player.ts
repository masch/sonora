import { useCallback, useEffect } from 'react';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { logger } from '@/utils/logger';

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error';

export interface ImmersionPlayerState {
  status: PlayerStatus;
  positionMs: number;
  durationMs: number;
  errorMsg: string | null;
}

/**
 * Configures the audio session for immersion mode:
 * - Background playback enabled (shouldPlayInBackground)
 * - Exclusive focus — other apps must pause (interruptionMode: 'doNotMix')
 * - Plays in silent mode on iOS
 */
async function setupImmersionAudioSession(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'doNotMix',
  });
}

export function useImmersionPlayer(localAudioUri: string | null) {
  const player = useAudioPlayer(localAudioUri, {
    updateInterval: 500,
    downloadFirst: true,
  });
  const {
    playing,
    currentTime,
    duration,
    isBuffering,
    isLoaded,
    didJustFinish,
    timeControlStatus,
  } = useAudioPlayerStatus(player);

  // Configure audio session once on mount
  useEffect(() => {
    setupImmersionAudioSession().catch((err: unknown) => {
      logger.warn('Failed to set audio mode', err);
    });
  }, []);

  // Map expo-audio status to our PlayerStatus
  const mappedStatus = (): PlayerStatus => {
    if (!localAudioUri) return 'idle';
    if (isBuffering) return 'loading';
    if (playing) return 'playing';
    if (didJustFinish) return 'stopped';
    if (isLoaded && timeControlStatus === 'paused') return 'paused';
    if (!isLoaded) return 'loading';
    return 'stopped';
  };
  const play = useCallback(() => {
    if (!localAudioUri) return;
    try {
      player.play();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error playing audio';
      logger.error('ImmersionPlayer play error:', msg);
    }
  }, [localAudioUri, player]);

  const pause = useCallback(() => {
    try {
      player.pause();
    } catch (err: unknown) {
      logger.warn('Failed to pause audio', err);
    }
  }, [player]);

  const stop = useCallback(() => {
    try {
      player.pause();
      player.seekTo(0);
    } catch (err: unknown) {
      logger.warn('Failed to stop audio', err);
    }
  }, [player]);

  const seekTo = useCallback(
    (positionMs: number) => {
      try {
        player.seekTo(positionMs / 1000);
      } catch (err: unknown) {
        logger.warn('Failed to seek audio', err);
      }
    },
    [player],
  );

  return {
    status: mappedStatus(),
    positionMs: (currentTime ?? 0) * 1000,
    durationMs: (duration ?? 0) * 1000,
    errorMsg: null,
    play,
    pause,
    stop,
    seekTo,
  };
}
