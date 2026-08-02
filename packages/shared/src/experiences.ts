export const USER_EXPERIENCE_FORMATS = ['track', 'trip'] as const;
export type UserExperienceFormat = (typeof USER_EXPERIENCE_FORMATS)[number];

export const EXPERIENCE_FORMATS = ['track', 'trip', 'general-feedback'] as const;
export type ExperienceFormat = (typeof EXPERIENCE_FORMATS)[number];

export const DEVICE_ID_KEY = 'device_id';

export const INSTRUCTIONS_SLUG = 'instructions' as const;
export const INSTRUCTIONS_AUDIO_KEY = 'experiences/instrucciones.mp3' as const;
export const INSTRUCTIONS_IMAGE_KEY = 'trip-instructions-cover' as const;
export const INSTRUCTIONS_FALLBACK_TRACK_ID = 'instructions' as const;

export const TRACK_IMAGE_KEYS = [
  'trips-deriva-centro-cover',
  'tracks-texto-maga-cover',
  'tracks-pajaros-chiricotes-cover',
  INSTRUCTIONS_IMAGE_KEY,
] as const;
export type TrackImageKey = (typeof TRACK_IMAGE_KEYS)[number];

export interface Theme {
  key: string;
  labelKey: string;
  order: number;
  applicableFormat?: ExperienceFormat | null;
}

export interface Waypoint {
  id: string;
  experienceId: string;
  order: number;
  latitude: number;
  longitude: number;
  audioUrl?: string | null;
  radiusMeters: number;
}

export interface BaseExperience {
  id: string;
  slug: string;
  title: string;
  description: string;
  themeKey: string;
  durationSeconds: number;
  latitude: number;
  longitude: number;
  recordedAt?: string | null;
  free: boolean;
  price?: number | null;
  currency?: string;
  imageKey: TrackImageKey;
  geofenceBypassable?: boolean;
}

export interface TrackExperience extends BaseExperience {
  format: 'track';
  /** Signed audio link — omitted by the API until the user has access. */
  audioUrl: string | null;
}

export interface TripExperience extends BaseExperience {
  format: 'trip';
  /** Signed audio link — omitted by the API until the user has access. */
  audioUrl: string | null;
  waypoints: Waypoint[];
}

export interface GeneralFeedbackExperience extends BaseExperience {
  format: 'general-feedback';
}

export type Experience = TrackExperience | TripExperience | GeneralFeedbackExperience;

export type PlayableExperience = TrackExperience | TripExperience;

export function isPlayableExperience(experience: Experience): experience is PlayableExperience {
  return (USER_EXPERIENCE_FORMATS as readonly string[]).includes(experience.format);
}
