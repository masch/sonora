import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import {
  createAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
  requestNotificationPermissionsAsync,
} from 'expo-audio';

import { useAudioPlayerStore } from '@/store/audio-player-store';
import type { PlayerStatus } from '@/store/audio-player-store';
import { logger } from '@/utils/logger';

function mapPlayerStatus(status: ReturnType<typeof useAudioPlayerStatus>): {
  status: PlayerStatus;
  positionMs: number;
  durationMs: number;
  errorMsg: string | null;
} {
  let playerStatus: PlayerStatus;

  if (status.error) {
    playerStatus = 'error';
  } else if (status.playing) {
    playerStatus = 'playing';
  } else if (status.didJustFinish) {
    playerStatus = 'stopped';
  } else if (status.isLoaded && status.timeControlStatus === 'paused') {
    playerStatus = 'paused';
  } else if (status.isBuffering || !status.isLoaded) {
    playerStatus = 'loading';
  } else {
    playerStatus = 'idle';
  }

  return {
    status: playerStatus,
    positionMs: (status.currentTime ?? 0) * 1000,
    durationMs: (status.duration ?? 0) * 1000,
    errorMsg: status.error ?? null,
  };
}

/**
 * Mounts at the app root (`_layout.tsx`) and manages the single AudioPlayer
 * lifecycle. Creates the player imperatively on mount, syncs reactive status
 * to the zustand store via `useAudioPlayerStatus()`, and releases the player
 * on unmount (hot reload safe).
 *
 * Configures the global audio session (background playback, silent mode,
 * interruption mode) once at startup, and requests notification permissions
 * on Android (required for lock screen / notification controls).
 */
export function AudioPlayerBridge() {
  // Create the player once — lazy initializer runs only on first render
  const [player] = useState(() => createAudioPlayer(null));
  const _setPlayer = useAudioPlayerStore((s) => s._setPlayer);
  const _syncStatus = useAudioPlayerStore((s) => s._syncStatus);

  // Register the player in the store on mount, release on unmount
  useEffect(() => {
    _setPlayer(player as never);

    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch((err: unknown) => {
      logger.warn('Failed to set audio mode', err);
    });

    // Android requires notification permission for lock screen controls
    if (Platform.OS === 'android') {
      requestNotificationPermissionsAsync().then(({ granted }) => {
        if (!granted) {
          logger.warn('Notification permission denied — lock screen controls unavailable');
        }
      });
    }

    return () => {
      _setPlayer(null as never);
      player.remove();
    };
  }, [player, _setPlayer]);

  // Subscribe to reactive player status
  const status = useAudioPlayerStatus(player);

  // Sync status to store on every change
  useEffect(() => {
    const mapped = mapPlayerStatus(status);
    _syncStatus(mapped);
  }, [status, _syncStatus]);

  // This component renders nothing — it's purely a lifecycle manager
  return null;
}
