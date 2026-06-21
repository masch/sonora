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
    text: '#2b2826',
    background: '#f4ede2',
    backgroundElement: '#ebe4d8',
    backgroundSelected: '#dfd7c8',
    textSecondary: '#76706b',
    border: 'rgba(43, 40, 38, 0.15)',
  },
  dark: {
    text: '#f4ede2',
    background: '#1a1817',
    backgroundElement: '#2b2826',
    backgroundSelected: '#3d3936',
    textSecondary: '#a59e99',
    border: 'rgba(244, 237, 226, 0.15)',
  },
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const TabBottomPadding = 16;
