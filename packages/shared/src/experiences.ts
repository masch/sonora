export const USER_EXPERIENCE_FORMATS = ['track', 'trip'] as const;
export type UserExperienceFormat = (typeof USER_EXPERIENCE_FORMATS)[number];

export const EXPERIENCE_FORMATS = ['track', 'trip', 'general-feedback'] as const;
export type ExperienceFormat = (typeof EXPERIENCE_FORMATS)[number];

export const TRACK_IMAGE_KEYS = [
  'trips-deriva-centro-cover',
  'tracks-texto-maga-cover',
  'tracks-pajaros-chiricotes-cover',
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

export interface Experience {
  id: string;
  slug: string;
  title: string;
  description: string;
  format: ExperienceFormat;
  themeKey: string;
  audioUrl?: string | null;
  durationSeconds: number;
  latitude: number;
  longitude: number;
  recordedAt?: string | null;
  priceLabel?: string | null;
  imageKey: TrackImageKey;
  geofenceBypassable?: boolean;
  waypoints?: Waypoint[];
}
