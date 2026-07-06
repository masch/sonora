import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

export interface TabDefinition {
  name: string;
  labelKey: string;
  symbolViewName: {
    ios: SFSymbol;
    android?: AndroidSymbol;
    web?: AndroidSymbol;
  };
  hidden?: boolean;
}

export const TABS = [
  {
    name: 'index',
    labelKey: 'tabs.translations',
    symbolViewName: { ios: 'character.bubble', android: 'translate', web: 'translate' },
    hidden: false,
  },
  {
    name: 'upload-audios',
    labelKey: 'tabs.uploadAudios',
    symbolViewName: { ios: 'arrow.up.doc', android: 'upload', web: 'upload' },
    hidden: false,
  },
] as const satisfies TabDefinition[];
