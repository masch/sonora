import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import { getExperienceIcon } from '../utils/icons';

export interface TabDefinition {
  /** Route name: "index", "explore", or "settings" */
  name: string;
  /** Display label (also used as i18n key for translations) */
  label: string;
  /** SymbolView icon names (web) */
  symbolViewName: {
    ios: SFSymbol;
    android?: AndroidSymbol;
    web?: AndroidSymbol;
  };
  /** When true, tab is hidden from the visible tab bar */
  hidden?: boolean;
}

export const TABS = [
  {
    name: 'index',
    label: 'Home',
    symbolViewName: { ios: 'house', android: 'home', web: 'home' },
    hidden: false,
  },
  {
    name: 'trips',
    label: 'Trips',
    symbolViewName: getExperienceIcon('trip'),
    hidden: false,
  },
  {
    name: 'tracks',
    label: 'Tracks',
    symbolViewName: getExperienceIcon('track'),
    hidden: false,
  },
  {
    name: 'explore',
    label: 'Explore',
    symbolViewName: { ios: 'compass.drawing', android: 'explore', web: 'explore' },
    hidden: true,
  },
  {
    name: 'settings',
    label: 'Settings',
    symbolViewName: { ios: 'gear', android: 'settings', web: 'settings' },
    hidden: true,
  },
  {
    name: 'messages',
    label: 'Messages',
    symbolViewName: getExperienceIcon('general-feedback'),
    hidden: true,
  },
] as const satisfies TabDefinition[];
