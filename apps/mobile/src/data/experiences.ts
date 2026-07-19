import { type Theme, type Experience, USER_EXPERIENCE_FORMATS } from '@sonora/shared';
import { ApiClient } from '@/services/api-client';

export {
  EXPERIENCE_FORMATS,
  TRACK_IMAGE_KEYS,
  INSTRUCTIONS_SLUG,
  INSTRUCTIONS_AUDIO_KEY,
  INSTRUCTIONS_IMAGE_KEY,
  INSTRUCTIONS_FALLBACK_TRACK_ID,
} from '@sonora/shared';
export { USER_EXPERIENCE_FORMATS, isPlayableExperience } from '@sonora/shared';
export type {
  Theme,
  Experience,
  TrackExperience,
  TripExperience,
  GeneralFeedbackExperience,
  PlayableExperience,
  Waypoint,
  ExperienceFormat,
  TrackImageKey,
  UserExperienceFormat,
} from '@sonora/shared';

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

const THEMES_CACHE_KEY = 'themes_list_cache';
const EXPERIENCES_CACHE_KEY = 'experiences_list_cache';

export async function fetchThemes(signal?: AbortSignal): Promise<Theme[]> {
  return ApiClient.get<Theme[]>('/themes', {
    signal,
    cacheKey: THEMES_CACHE_KEY,
    customErrorMessage: 'Failed to fetch themes',
  });
}

export async function fetchExperiences(signal?: AbortSignal): Promise<Experience[]> {
  return ApiClient.get<Experience[]>('/experiences', {
    signal,
    cacheKey: EXPERIENCES_CACHE_KEY,
    customErrorMessage: 'Failed to fetch experiences',
    transform: (data: Experience[]) =>
      data.filter((exp) => (USER_EXPERIENCE_FORMATS as readonly string[]).includes(exp.format)),
  });
}
