import { APP_CONFIG } from '@/config/app-config';
import type { Theme, Experience } from '@sonora/shared';
import * as storage from '@/storage/feedback-storage';

export { EXPERIENCE_FORMATS, TRACK_IMAGE_KEYS, USER_EXPERIENCE_FORMATS } from '@sonora/shared';
export type {
  Theme,
  Experience,
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

export async function fetchThemes(signal?: AbortSignal): Promise<Theme[]> {
  const response = await fetch(`${APP_CONFIG.apiBaseUrl}/themes`, { signal });
  if (!response.ok) {
    throw new Error('Failed to fetch themes');
  }
  return response.json();
}

const EXPERIENCES_CACHE_KEY = 'experiences_list_cache';

export async function fetchExperiences(signal?: AbortSignal): Promise<Experience[]> {
  try {
    const response = await fetch(`${APP_CONFIG.apiBaseUrl}/experiences`, { signal });
    if (!response.ok) {
      throw new Error('Failed to fetch experiences');
    }
    const data: Experience[] = await response.json();
    const filtered = data.filter((exp) => exp.format === 'trip' || exp.format === 'track');

    // Asynchronously save to local cache
    storage.setItem(EXPERIENCES_CACHE_KEY, JSON.stringify(filtered)).catch((err) => {
      console.warn('Failed to write experiences cache:', err);
    });

    return filtered;
  } catch (error) {
    console.log('[Offline Mode] Fetch failed, loading cached experiences...');
    try {
      const cached = await storage.getItem(EXPERIENCES_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (cacheError) {
      console.error('Failed to read experiences cache:', cacheError);
    }
    throw error;
  }
}
