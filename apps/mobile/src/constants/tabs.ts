import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import type { TranslationKeys } from '@/i18n/types';
import { getExperienceIcon } from '../utils/icons';
import { ROUTES } from './routes';
import { APP_CONFIG } from '../config/app-config';

export interface TabDefinition {
  /** Route name: "index", "explore", or "settings" */
  name: string;
  /** Translation key for display label */
  labelKey: TranslationKeys;
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
    labelKey: 'tabs.index',
    symbolViewName: { ios: 'house', android: 'home', web: 'home' },
    hidden: false,
  },
  {
    name: ROUTES.DERIVAS,
    labelKey: 'tabs.experiences',
    symbolViewName: getExperienceIcon('trip'),
    hidden: false,
  },
  {
    name: ROUTES.POETICS,
    labelKey: 'tabs.poetics',
    symbolViewName: getExperienceIcon('track'),
    hidden: false,
  },
  {
    name: ROUTES.EXPLORE,
    labelKey: 'tabs.explore',
    symbolViewName: { ios: 'compass.drawing', android: 'explore', web: 'explore' },
    hidden: !APP_CONFIG.isDevMode,
  },
  {
    name: ROUTES.SETTINGS,
    labelKey: 'tabs.settings',
    symbolViewName: { ios: 'gear', android: 'settings', web: 'settings' },
    hidden: true,
  },
  {
    name: ROUTES.MESSAGES,
    labelKey: 'tabs.messages',
    symbolViewName: getExperienceIcon('general-feedback'),
    hidden: true,
  },
] as const satisfies TabDefinition[];
