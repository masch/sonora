import { type TrackImageKey } from '@/data/experiences';
import { type ImageSourcePropType } from 'react-native';

// ── Track-specific images ───────────────────────────────

export const TRACK_IMAGES: Record<TrackImageKey, ImageSourcePropType> = {
  'trips-deriva-centro-cover': require('@/assets/images/sonora/trips-deriva-centro-cover.jpg'),
  'tracks-texto-maga-cover': require('@/assets/images/sonora/tracks-texto-maga-cover.jpg'),
  'tracks-pajaros-chiricotes-cover': require('@/assets/images/sonora/tracks-pajaros-chiricotes-cover.jpg'),
  'trip-instructions-cover': require('@/assets/images/sonora/trips-instructions-cover.png'),
};

export const DEFAULT_TRACK_IMAGE: ImageSourcePropType = TRACK_IMAGES['trips-deriva-centro-cover'];

// ── App UI images ───────────────────────────────────────

export const SONORA_LOGO = require('@/assets/images/sonora/logo.png');
export const SONORA_BANNER_BG = require('@/assets/images/sonora/banner-fondo-logo-1.png');
export const SONORA_MAIN_BG = require('@/assets/images/sonora/fondo-recorridos-sec-1.png');
export const SONORA_HOME_BG = require('@/assets/images/sonora/home-background.jpg');
export const SONORA_TRIP_BG = require('@/assets/images/sonora/trips-background.jpg');
export const SONORA_TRACKS_BG = require('@/assets/images/sonora/tracks-background.jpg');
export const SONORA_MESSAGES_BG = require('@/assets/images/sonora/messages-background.jpg');

export const LOGO_GLOW = require('@/assets/images/logo-glow.png');
export const EXPO_LOGO = require('@/assets/images/expo-logo.png');
export const EXPO_BADGE = require('@/assets/images/expo-badge.png');
export const EXPO_BADGE_WHITE = require('@/assets/images/expo-badge-white.png');
