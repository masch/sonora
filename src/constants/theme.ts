/**
 * Runtime color bridge for native-only props that require color strings
 * (e.g., SymbolView tintColor, NativeTabs backgroundColor/indicatorColor).
 *
 * Design tokens live in src/global.css @theme — this is a minimal JS mirror
 * for the three consumers that cannot read CSS variables at runtime.
 *
 * Must stay in sync with `@variant dark` in global.css.
 */

import { Platform } from 'react-native';

export const RuntimeColors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const TabBottomPadding = 16;
export const MaxContentWidth = 800;

