import { useState, useEffect, useRef, useCallback } from 'react';
import { Audio, type AVPlaybackStatus } from 'expo-av';
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
 * - Background playback enabled (staysActiveInBackground)
 * - Exclusive focus on Android (shouldDuckAndroid: false → other apps must pause)
 * - iOS: plays in silent mode
 */
async function setupImmersionAudioSession(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    staysActiveInBackground: true,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
  });
}

export function useImmersionPlayer(localAudioUri: string | null) {
  const [state, setState] = useState<ImmersionPlayerState>({
    status: 'idle',
    positionMs: 0,
    durationMs: 0,
    errorMsg: null,
  });

  const soundRef = useRef<Audio.Sound | null>(null);
  // Track whether last status update was triggered by external route change (headphone unplug)
  const wasPlayingRef = useRef(false);

  // Cleanup sound on unmount or URI change
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch((err: unknown) => {
          logger.warn('Failed to unload sound on cleanup', err);
        });
        soundRef.current = null;
      }
    };
  }, [localAudioUri]);

  // Reset to idle if URI is cleared
  useEffect(() => {
    if (!localAudioUri) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({
        status: 'idle',
        positionMs: 0,
        durationMs: 0,
        errorMsg: null,
      });
    }
  }, [localAudioUri]);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) {
        logger.error('Playback error:', status.error);
        setState((prev) => ({ ...prev, status: 'error', errorMsg: status.error ?? null }));
      }
      return;
    }

    const positionMs = status.positionMillis ?? 0;
    const durationMs = status.durationMillis ?? 0;

    // Detect headphone unplug: was playing → now paused externally (not by us)
    if (wasPlayingRef.current && !status.isPlaying && !status.didJustFinish) {
      logger.warn('Playback paused externally — likely headphone disconnect');
      wasPlayingRef.current = false;
      setState({ status: 'paused', positionMs, durationMs, errorMsg: null });
      return;
    }

    wasPlayingRef.current = status.isPlaying;

    if (status.didJustFinish) {
      setState({ status: 'stopped', positionMs: 0, durationMs, errorMsg: null });
      return;
    }

    setState((prev) => ({
      ...prev,
      status: status.isPlaying ? 'playing' : prev.status === 'loading' ? 'paused' : prev.status,
      positionMs,
      durationMs,
    }));
  }, []);

  const play = useCallback(async () => {
    if (!localAudioUri) return;

    try {
      setState((prev) => ({ ...prev, status: 'loading', errorMsg: null }));

      await setupImmersionAudioSession();

      // If already loaded, resume
      if (soundRef.current) {
        await soundRef.current.playAsync();
        wasPlayingRef.current = true;
        setState((prev) => ({ ...prev, status: 'playing' }));
        return;
      }

      // Load and play fresh
      const { sound } = await Audio.Sound.createAsync(
        { uri: localAudioUri },
        { shouldPlay: true, progressUpdateIntervalMillis: 500 },
        onPlaybackStatusUpdate,
      );

      soundRef.current = sound;
      wasPlayingRef.current = true;
      setState((prev) => ({ ...prev, status: 'playing' }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading audio';
      logger.error('ImmersionPlayer play error:', msg);
      setState({ status: 'error', positionMs: 0, durationMs: 0, errorMsg: msg });
    }
  }, [localAudioUri, onPlaybackStatusUpdate]);

  const pause = useCallback(async () => {
    if (!soundRef.current) return;
    try {
      wasPlayingRef.current = false;
      await soundRef.current.pauseAsync();
      setState((prev) => ({ ...prev, status: 'paused' }));
    } catch (err: unknown) {
      logger.warn('Failed to pause audio', err);
    }
  }, []);

  const stop = useCallback(async () => {
    if (!soundRef.current) return;
    try {
      wasPlayingRef.current = false;
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      setState({ status: 'stopped', positionMs: 0, durationMs: 0, errorMsg: null });
    } catch (err: unknown) {
      logger.warn('Failed to stop audio', err);
    }
  }, []);

  const seekTo = useCallback(async (positionMs: number) => {
    if (!soundRef.current) return;
    try {
      await soundRef.current.setPositionAsync(positionMs);
    } catch (err: unknown) {
      logger.warn('Failed to seek audio', err);
    }
  }, []);

  return {
    ...state,
    play,
    pause,
    stop,
    seekTo,
  };
}
