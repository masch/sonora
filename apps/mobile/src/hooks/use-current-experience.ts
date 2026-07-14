import {
  useAudioPlayerStore,
  getTrackIdFromUri,
  cleanExperienceId,
  type PlayerStatus,
  type ExperienceAudioMetadata,
} from '@/store/audio-player-store';

export interface CurrentExperience {
  experienceId: string | null;
  status: PlayerStatus;
  isPlaying: boolean;
  isPaused: boolean;
  metadata: ExperienceAudioMetadata | null;
}

export function useCurrentExperience(): CurrentExperience {
  const currentUri = useAudioPlayerStore((s) => s.currentUri);
  const status = useAudioPlayerStore((s) => s.status);
  const currentMetadata = useAudioPlayerStore((s) => s.currentMetadata);

  const playingTrackId = currentUri ? getTrackIdFromUri(currentUri) : null;
  const cleanPlayingId = cleanExperienceId(playingTrackId);

  return {
    experienceId: cleanPlayingId,
    status,
    isPlaying: status === 'playing',
    isPaused: status === 'paused',
    metadata: currentMetadata,
  };
}
