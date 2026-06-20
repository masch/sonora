import { type ImageSourcePropType } from 'react-native';
import { type TrackImageKey } from '@/data/experiences';

export const TRACK_IMAGES: Record<TrackImageKey, ImageSourcePropType> = {
  'deriva-centro': require('@/assets/images/sonora/deriva-centro.png'),
  'bonus-track': require('@/assets/images/sonora/bonus-track.png'),
  'tacuarita-azul': require('@/assets/images/sonora/deriva-centro.png'),
  'el-arroyo': require('@/assets/images/sonora/fondo-recorridos-sec-1.png'),
  'la-piedra-antigua': require('@/assets/images/sonora/banner-fondo-logo-1.png'),
  'viento-chanares': require('@/assets/images/sonora/deriva-centro.png'),
  'voces-monte': require('@/assets/images/sonora/bonus-track.png'),
};
