import type { SFSymbol, AndroidSymbol } from 'expo-symbols';

export type TabDefinition = {
  /** Route name: "index", "explore", or "settings" */
  name: string;
  /** Human-readable label (e.g., "Home") */
  label: string;
  /** Ionicons vector icon name (native) */
  ioniconsName: string;
  /** SymbolView icon names (web) */
  symbolViewName: {
    ios: SFSymbol;
    android?: AndroidSymbol;
    web?: AndroidSymbol;
  };
};

export const TABS = [
  {
    name: 'index',
    label: 'Home',
    ioniconsName: 'home-outline',
    symbolViewName: { ios: 'house', android: 'home', web: 'home' },
  },
  {
    name: 'explore',
    label: 'Explore',
    ioniconsName: 'compass-outline',
    symbolViewName: { ios: 'compass.drawing', android: 'explore', web: 'explore' },
  },
  {
    name: 'settings',
    label: 'Settings',
    ioniconsName: 'settings-outline',
    symbolViewName: { ios: 'gear', android: 'settings', web: 'settings' },
  },
] as const satisfies TabDefinition[];
