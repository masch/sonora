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
  const cleanPlayingId =
    currentMetadata?.id || currentMetadata?.slug || cleanExperienceId(playingTrackId);

  return {
    experienceId: cleanPlayingId,
    status,
    isPlaying: status === 'playing',
    isPaused: status === 'paused',
    metadata: currentMetadata,
  };
}

export function isSameExperience(
  current: CurrentExperience,
  targetIdOrSlug?: string | null,
): boolean {
  if (!targetIdOrSlug) return false;
  const cleanTarget = cleanExperienceId(targetIdOrSlug);
  if (!cleanTarget) return false;

  return (
    current.experienceId === cleanTarget ||
    current.metadata?.id === cleanTarget ||
    current.metadata?.slug === cleanTarget
  );
}
