import { APP_CONFIG } from '@/config/app-config';
import type { Theme, Experience } from '@sonora/shared';

export { EXPERIENCE_FORMATS, TRACK_IMAGE_KEYS } from '@sonora/shared';
export type { Theme, Experience, Waypoint, ExperienceFormat, TrackImageKey } from '@sonora/shared';

export type FeedbackTriggerMode = 'audio_end' | 'geofence' | 'manual';

export interface LocalTrackMetadata {
  id: string;
  uuid: string;
  title: string;
  description: string;
  durationSeconds: number;
  startCoordinates: { latitude: number; longitude: number };
  audioRemoteUrl: string;
  feedbackTrigger?: FeedbackTriggerMode;
  category: string;
  subLabel: string;
  imageKey: string;
}

export async function fetchThemes(): Promise<Theme[]> {
  const response = await fetch(`${APP_CONFIG.apiBaseUrl}/themes`);
  if (!response.ok) {
    throw new Error('Failed to fetch themes');
  }
  return response.json();
}

export async function fetchExperiences(): Promise<Experience[]> {
  const response = await fetch(`${APP_CONFIG.apiBaseUrl}/experiences`);
  if (!response.ok) {
    throw new Error('Failed to fetch experiences');
  }
  return response.json();
}
