import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
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
  // On web, skip downloadFirst — the HTML5 Audio element can stream from
  // cross-origin URLs directly even without CORS fetch access.
  const player = useAudioPlayer(localAudioUri, {
    updateInterval: 500,
    downloadFirst: Platform.OS !== 'web',
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

  const [prevUri, setPrevUri] = useState<string | null>(localAudioUri);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Reset load state when URI changes
  if (localAudioUri !== prevUri) {
    setPrevUri(localAudioUri);
    setHasLoaded(false);
  }

  // Configure audio session once on mount
  useEffect(() => {
    setupImmersionAudioSession().catch((err: unknown) => {
      logger.warn('Failed to set audio mode', err);
    });
  }, []);

  // Sync hasLoaded when player completes its initial load
  if (isLoaded && !hasLoaded) {
    setHasLoaded(true);
  }

  // Map expo-audio status to our PlayerStatus
  const status: PlayerStatus = (() => {
    if (!localAudioUri) return 'idle';
    if (!hasLoaded) {
      if (isBuffering || !isLoaded) return 'loading';
    }
    if (playing) return 'playing';
    if (didJustFinish) return 'stopped';
    if (isLoaded && timeControlStatus === 'paused') return 'paused';
    return 'stopped';
  })();

  const play = () => {
    if (!localAudioUri) return;
    try {
      player.play();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error playing audio';
      logger.error('ImmersionPlayer play error:', msg);
    }
  };

  const pause = () => {
    try {
      player.pause();
    } catch (err: unknown) {
      logger.warn('Failed to pause audio', err);
    }
  };

  const stop = () => {
    try {
      player.pause();
      player.seekTo(0);
    } catch (err: unknown) {
      logger.warn('Failed to stop audio', err);
    }
  };

  const seekTo = (positionMs: number) => {
    try {
      player.seekTo(positionMs / 1000);
    } catch (err: unknown) {
      logger.warn('Failed to seek audio', err);
    }
  };

  return {
    status,
    positionMs: (currentTime ?? 0) * 1000,
    durationMs: (duration ?? 0) * 1000,
    errorMsg: null,
    play,
    pause,
    stop,
    seekTo,
  };
}
