import { type TrackImageKey } from '@/data/experiences';
import { type ImageSourcePropType } from 'react-native';

// ── Track-specific images ───────────────────────────────

export const TRACK_IMAGES: Record<TrackImageKey, ImageSourcePropType> = {
  'deriva-centro': require('@/assets/images/sonora/deriva-centro.png'),
  'track-texto-maga': require('@/assets/images/sonora/track-texto-maga.png'),
  'track-pajaros-chiricotes': require('@/assets/images/sonora/track-pajaros-chiricotes.png'),
};

export const DEFAULT_TRACK_IMAGE: ImageSourcePropType = TRACK_IMAGES['deriva-centro'];

// ── App UI images ───────────────────────────────────────

export const SONORA_LOGO = require('@/assets/images/sonora/logo.png');
export const SONORA_BANNER_BG = require('@/assets/images/sonora/banner-fondo-logo-1.png');
export const SONORA_MAIN_BG = require('@/assets/images/sonora/fondo-recorridos-sec-1.png');
export const SONORA_HOME_BG = require('@/assets/images/sonora/home-background.jpg');
export const SONORA_TRIP_BG = require('@/assets/images/sonora/trips-background.jpg');
export const SONORA_TRACKS_BG = require('@/assets/images/sonora/tracks-background.jpg');
export const SONORA_INSTRUCTIONS_BG = require('@/assets/images/sonora/cover-instrucciones-1.png');
export const SONORA_MESSAGES_BG = require('@/assets/images/sonora/messages-background.jpg');

export const LOGO_GLOW = require('@/assets/images/logo-glow.png');
export const EXPO_LOGO = require('@/assets/images/expo-logo.png');
export const EXPO_BADGE = require('@/assets/images/expo-badge.png');
export const EXPO_BADGE_WHITE = require('@/assets/images/expo-badge-white.png');
