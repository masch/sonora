import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

export interface ExperienceIconConfig {
  ios: SFSymbol;
  android: AndroidSymbol;
  web: AndroidSymbol;
}

export function getExperienceIcon(
  format: 'track' | 'trip' | 'general-feedback',
): ExperienceIconConfig {
  switch (format) {
    case 'trip':
      return {
        ios: 'map' as SFSymbol,
        android: 'map' as AndroidSymbol,
        web: 'map' as AndroidSymbol,
      };
    case 'track':
      return {
        ios: 'music.note.list' as SFSymbol,
        android: 'library_music' as AndroidSymbol,
        web: 'library_music' as AndroidSymbol,
      };
    case 'general-feedback':
    default:
      return {
        ios: 'bubble.left' as SFSymbol,
        android: 'forum' as AndroidSymbol,
        web: 'forum' as AndroidSymbol,
      };
  }
}
