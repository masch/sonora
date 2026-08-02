import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol, AndroidSymbol, SymbolWeight } from 'expo-symbols';
import { ICON_MAP, type GenericIconName } from './icon-utils';

export type { GenericIconName } from './icon-utils';

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
