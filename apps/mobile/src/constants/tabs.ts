import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import { getExperienceIcon } from '../utils/icons';
import { ROUTES } from './routes';

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
    name: ROUTES.HOME,
    label: 'Home',
    symbolViewName: { ios: 'house', android: 'home', web: 'home' },
    hidden: false,
  },
  {
    name: ROUTES.DERIVAS,
    label: 'Derivas',
    symbolViewName: getExperienceIcon('trip'),
    hidden: false,
  },
  {
    name: ROUTES.POETICS,
    label: 'Poetics',
    symbolViewName: getExperienceIcon('track'),
    hidden: false,
  },
  {
    name: ROUTES.EXPLORE,
    label: 'Explore',
    symbolViewName: { ios: 'compass.drawing', android: 'explore', web: 'explore' },
    hidden: true,
  },
  {
    name: ROUTES.SETTINGS,
    label: 'Settings',
    symbolViewName: { ios: 'gear', android: 'settings', web: 'settings' },
    hidden: true,
  },
  {
    name: ROUTES.MESSAGES,
    label: 'Messages',
    symbolViewName: getExperienceIcon('general-feedback'),
    hidden: true,
  },
] as const satisfies TabDefinition[];
