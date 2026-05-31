import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { TABS } from '@/constants/tabs';
import { useAppTranslation } from '@/hooks/use-translation';
import { useThemeColors } from '@/hooks/use-theme-colors';

// react-doctor-disable-next-line deslop/unused-export — false positive: default export used by Expo Router via @/ alias
export default function AppTabs() {
  const colors = useThemeColors();
  const { t } = useAppTranslation();

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}
    >
      {TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{t(`tabs.${tab.name}`)}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={tab.symbolViewName.ios} md={tab.symbolViewName.android} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
