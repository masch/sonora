import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { TABS } from '@/constants/tabs';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useAppTranslation } from '@/hooks/use-translation';

// react-doctor-disable-next-line deslop/unused-export — false positive: default export used by Expo Router via @/ alias
export default function AppTabs() {
  const { t } = useAppTranslation();
  const colors = useThemeColors();

  const visible = TABS.filter((tab) => !tab.hidden);
  const triggers = visible.map((tab) => (
    <NativeTabs.Trigger key={tab.name} name={tab.name}>
      <NativeTabs.Trigger.Label hidden>{t(tab.labelKey)}</NativeTabs.Trigger.Label>
      <NativeTabs.Trigger.Icon sf={tab.symbolViewName.ios} md={tab.symbolViewName.android} />
    </NativeTabs.Trigger>
  ));

  return (
    <NativeTabs
      backgroundColor={colors.tabBarBg}
      indicatorColor={colors.tabBarSelectedBg}
      iconColor={{
        default: colors.tabBarIconInactive,
        selected: colors.tabBarIconActive,
      }}
      labelVisibilityMode="unlabeled"
    >
      {triggers}
    </NativeTabs>
  );
}
