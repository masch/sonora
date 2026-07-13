import type { AudioMetadata } from 'expo-audio';
import { useAudioPlayerStore, getTrackIdFromUri } from '@/store/audio-player-store';

export interface CurrentExperience {
  experienceId: string | null;
  status: string;
  isPlaying: boolean;
  isPaused: boolean;
  metadata: (AudioMetadata & { id?: string; slug?: string }) | null;
}

export function useCurrentExperience(): CurrentExperience {
  const currentUri = useAudioPlayerStore((s) => s.currentUri);
  const status = useAudioPlayerStore((s) => s.status);
  const currentMetadata = useAudioPlayerStore((s) => s.currentMetadata);

  const playingTrackId = currentUri ? getTrackIdFromUri(currentUri) : null;
  const cleanPlayingId = playingTrackId?.replace(/^(track|trip)-/, '') ?? null;

  return {
    experienceId: cleanPlayingId,
    status,
    isPlaying: status === 'playing',
    isPaused: status === 'paused',
    metadata: currentMetadata,
  };
}
