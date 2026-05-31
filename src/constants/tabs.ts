import type { SFSymbol, AndroidSymbol } from 'expo-symbols';

export interface TabDefinition {
  /** Route name: "index", "explore", or "settings" */
  name: string;
  /** Display label (also used as i18n key for translations) */
  label: string;
  /** Ionicons vector icon name (native) */
  ioniconsName: string;
  /** SymbolView icon names (web) */
  symbolViewName: {
    ios: SFSymbol;
    android?: AndroidSymbol;
    web?: AndroidSymbol;
  };
}

export const TABS = [
  {
    name: 'index',
    label: 'Home',
    ioniconsName: 'home-outline',
    symbolViewName: { ios: 'house', android: 'home', web: 'home' },
  },
  {
    name: 'walk',
    label: 'Walk',
    ioniconsName: 'ear-outline',
    symbolViewName: { ios: 'ear', android: 'headphones', web: 'headphones' },
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
