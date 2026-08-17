import { ApiClient } from '@/services/api-client';
import { type Experience, type Theme, USER_EXPERIENCE_FORMATS } from '@sonora/shared';

export {
  EXPERIENCE_FORMATS,
  INSTRUCTIONS_AUDIO_KEY,
  INSTRUCTIONS_FALLBACK_TRACK_ID,
  INSTRUCTIONS_IMAGE_KEY,
  INSTRUCTIONS_EXPERIENCES_SLUG as INSTRUCTIONS_SLUG,
  isPlayableExperience,
  TRACK_IMAGE_KEYS,
  USER_EXPERIENCE_FORMATS,
} from '@sonora/shared';
export type {
  Experience,
  ExperienceFormat,
  PlayableExperience,
  Theme,
  TrackExperience,
  TrackImageKey,
  TripExperience,
  UserExperienceFormat,
  Waypoint,
} from '@sonora/shared';

export type FeedbackTriggerMode = 'audio_end' | 'geofence' | 'manual';

export interface LocalTrackMetadata {
  id: string;
  uuid: string;
  title: string;
  description: string;
  durationSeconds: number;
  startCoordinates: { latitude: number; longitude: number };
  audioRemoteUrl: string | null;
  feedbackTrigger?: FeedbackTriggerMode;
  category: string;
  subLabel: string;
  imageKey: string;
}

const THEMES_CACHE_KEY = 'themes_list_cache';
const EXPERIENCES_CACHE_KEY = 'experiences_list_cache';

export async function fetchThemes(signal?: AbortSignal): Promise<Theme[]> {
  return ApiClient.get<Theme[]>('/themes', {
    signal,
    cacheKey: THEMES_CACHE_KEY,
  });
}

export async function fetchExperiences(signal?: AbortSignal): Promise<Experience[]> {
  return ApiClient.get<Experience[]>('/experiences', {
    signal,
    cacheKey: EXPERIENCES_CACHE_KEY,
    transform: (data: Experience[]) =>
      data.filter((exp) => (USER_EXPERIENCE_FORMATS as readonly string[]).includes(exp.format)),
  });
}
