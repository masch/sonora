import { TRACKS as SHARED_TRACKS, LocalTrackMetadata } from '@sonora/shared';

export type { LocalTrackMetadata, FeedbackTriggerMode } from '@sonora/shared';

export const TRACKS = SHARED_TRACKS;

export function getTrackById(id: string): LocalTrackMetadata | undefined {
  return TRACKS[id];
}

export function getAllTracks(): LocalTrackMetadata[] {
  return Object.values(TRACKS);
}
