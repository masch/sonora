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
    // Custom Home Card design colors
    homeInstructionsBg: '#FDF6D2',
    homeExploreRoutesBg: '#7BE5C4',
    homeExploreTracksBg: '#A1C4FD',
    homeLocalMessagesBg: '#E8D7FF',
    homeCardText: '#18181b',
    homeCardSubtext: '#52525b',
    // Tab Bar design colors from user palette image
    tabBarBg: 'rgba(255, 235, 240, 0.85)',
    tabBarSelectedBg: 'rgba(244, 192, 196, 0.9)',
    tabBarIconActive: '#240001',
    tabBarIconInactive: '#4c263a',
  },
  dark: {
    text: '#f4ede2',
    background: '#1a1817',
    backgroundElement: '#2b2826',
    backgroundSelected: '#3d3936',
    textSecondary: '#a59e99',
    border: 'rgba(244, 237, 226, 0.15)',
    // Custom Home Card design colors
    homeInstructionsBg: '#FDF6D2',
    homeExploreRoutesBg: '#7BE5C4',
    homeExploreTracksBg: '#A1C4FD',
    homeLocalMessagesBg: '#E8D7FF',
    homeCardText: '#18181b',
    homeCardSubtext: '#52525b',
    // Tab Bar design colors (dark version)
    tabBarBg: 'rgba(36, 15, 22, 0.85)',
    tabBarSelectedBg: 'rgba(74, 40, 52, 0.9)',
    tabBarIconActive: '#FFEBF0',
    tabBarIconInactive: '#8F6576',
  },
} as const;

export const SPLASH_COLORS = {
  production: '#208AEF',
  staging: '#F59E0B',
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80, default: 54 }) ?? 54;
export const TabBottomPadding = 16;
