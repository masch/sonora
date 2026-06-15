import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { TABS } from '@/constants/tabs';
import { useThemeColors } from '@/hooks/use-theme-colors';

// react-doctor-disable-next-line deslop/unused-export — false positive: default export used by Expo Router via @/ alias
export default function AppTabs() {
  const colors = useThemeColors();

  const visible = TABS.filter((tab) => !tab.hidden);
  const triggers = visible.map((tab) => (
    <NativeTabs.Trigger key={tab.name} name={tab.name}>
      <NativeTabs.Trigger.Label hidden>{tab.label}</NativeTabs.Trigger.Label>
      <NativeTabs.Trigger.Icon sf={tab.symbolViewName.ios} md={tab.symbolViewName.android} />
    </NativeTabs.Trigger>
  ));

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelVisibilityMode="unlabeled"
    >
      {triggers}
    </NativeTabs>
  );
}
