import type { AudioMetadata } from 'expo-audio';

import { useAudioPlayerStore } from '@/store/audio-player-store';
import type { PlayerStatus } from '@/store/audio-player-store';

export type { PlayerStatus };

export interface ImmersionPlayerState {
  status: PlayerStatus;
  positionMs: number;
  durationMs: number;
  errorMsg: string | null;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seekTo: (positionMs: number) => void;
  setMediaMetadata: (metadata: AudioMetadata) => void;
}

/**
 * Thin wrapper over the centralized `useAudioPlayerStore`.
 *
 * Backward-compatible with the original `useImmersionPlayer` interface.
 * Existing consumers (`HomeAudioPlayer`, `ExploreScreen`, `TrackDetailView`)
 * require zero prop/import changes.
 *
 * When `localAudioUri` is null, the returned status is forced to `'idle'`
 * (no source available). When set, delegates all state reads and actions
 * to the centralized store.
 *
 * When `mediaMetadata` is provided, it is set as the lock screen / NowPlaying
 * metadata for the current track.
 */
export function useImmersionPlayer(
  localAudioUri: string | null,
  mediaMetadata: AudioMetadata,
): ImmersionPlayerState {
  const storeStatus = useAudioPlayerStore((s) => s.status);
  const positionMs = useAudioPlayerStore((s) => s.positionMs);
  const durationMs = useAudioPlayerStore((s) => s.durationMs);
  const errorMsg = useAudioPlayerStore((s) => s.errorMsg);
  const storePlay = useAudioPlayerStore((s) => s.play);
  const pause = useAudioPlayerStore((s) => s.pause);
  const stop = useAudioPlayerStore((s) => s.stop);
  const seekTo = useAudioPlayerStore((s) => s.seekTo);
  const setNowPlayingMetadata = useAudioPlayerStore((s) => s.setNowPlayingMetadata);

  const status: PlayerStatus = localAudioUri ? storeStatus : 'idle';

  // Sync metadata to the store directly (no effect needed — zustand updates batch with render)
  if (mediaMetadata && Object.keys(mediaMetadata).length > 0) {
    setNowPlayingMetadata(mediaMetadata);
  }

  return {
    status,
    positionMs,
    durationMs,
    errorMsg,
    play: () => {
      if (localAudioUri) {
        storePlay(localAudioUri);
      }
    },
    pause,
    stop,
    seekTo,
    setMediaMetadata: setNowPlayingMetadata,
  };
}
