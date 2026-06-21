import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol, AndroidSymbol, SymbolWeight } from 'expo-symbols';

// Unified project icon definitions mapping name key to platform icons
export const ICON_MAP = {
  play: { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' },
  pause: { ios: 'pause.fill', android: 'pause', web: 'pause' },
  download: { ios: 'arrow.down.circle.fill', android: 'downloading', web: 'downloading' },
  reset: { ios: 'arrow.counterclockwise', android: 'replay', web: 'replay' },
  rewind: { ios: 'gobackward.10', android: 'replay_10', web: 'replay_10' },
  map: { ios: 'map', android: 'map', web: 'map' },
  music: { ios: 'music.note.list', android: 'library_music', web: 'library_music' },
  chat: { ios: 'bubble.left', android: 'forum', web: 'forum' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
} as const;

export type GenericIconName = keyof typeof ICON_MAP;

interface IconProps {
  name?: GenericIconName;
  ios?: SFSymbol;
  android?: AndroidSymbol;
  web?: AndroidSymbol;
  size?: number;
  tintColor?: string;
  weight?: SymbolWeight;
  style?: StyleProp<ViewStyle>;
}

export function Icon({ name, ios, android, web, size = 24, tintColor, weight, style }: IconProps) {
  // If a generic name is specified, resolve platform-specific names from ICON_MAP
  const resolvedIos = name ? ICON_MAP[name].ios : ios;
  const resolvedAndroid = name ? ICON_MAP[name].android : android;
  const resolvedWeb = name ? ICON_MAP[name].web : web;

  return (
    <SymbolView
      name={{
        ios: resolvedIos as SFSymbol,
        android: resolvedAndroid as AndroidSymbol,
        web: resolvedWeb as AndroidSymbol,
      }}
      size={size}
      tintColor={tintColor}
      weight={weight}
      style={style}
    />
  );
}
