import { APP_CONFIG } from '@/config/app-config';
import { type Theme, type Experience, USER_EXPERIENCE_FORMATS } from '@sonora/shared';
import * as storage from '@/storage/feedback-storage';
import { logger } from '@/utils/logger';

export { EXPERIENCE_FORMATS, TRACK_IMAGE_KEYS } from '@sonora/shared';
export { USER_EXPERIENCE_FORMATS };
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
    const filtered = data.filter((exp) =>
      (USER_EXPERIENCE_FORMATS as readonly string[]).includes(exp.format),
    );

    // Asynchronously save to local cache
    storage.setItem(EXPERIENCES_CACHE_KEY, JSON.stringify(filtered)).catch((err) => {
      logger.warn(`Failed to write experiences cache: ${err instanceof Error ? err.message : String(err)}`);
    });

    return filtered;
  } catch (error) {
    logger.info('[Offline Mode] Fetch failed, loading cached experiences...');
    try {
      const cached = await storage.getItem(EXPERIENCES_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (cacheError) {
      logger.error(`Failed to read experiences cache: ${cacheError instanceof Error ? cacheError.message : String(cacheError)}`);
    }
    throw error;
  }
}
