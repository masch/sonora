import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { TABS } from '@/constants/tabs';
import { useAppTranslation } from '@/hooks/use-translation';
import { useThemeColors } from '@/hooks/use-theme-colors';

const iconProps = { renderingMode: 'template' as const };

export default function AppTabs() {
  const colors = useThemeColors();
  const { t } = useAppTranslation();

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      {TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{t(`tabs.${tab.name}`)}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name={tab.ioniconsName} />}
            {...iconProps}
          />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
