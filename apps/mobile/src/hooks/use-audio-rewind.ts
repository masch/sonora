import { useAudioPlayerStore } from '@/store/audio-player-store';
import { useRemoteConfigStore } from '@/store/remote-config-store';

/**
 * Custom hook that encapsulates getting the rewind offset configuration
 * and the rewind function from the centralized audio player store.
 *
 * Returns a function that triggers rewind by the configured offset amount.
 */
export function useAudioRewind() {
  const rewind = useAudioPlayerStore((s) => s.rewind);
  const rewindOffsetMs = useRemoteConfigStore((s) => s.config.audio.rewindOffsetMs);

  return () => {
    rewind(rewindOffsetMs);
  };
}
