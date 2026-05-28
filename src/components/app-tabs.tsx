import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { RuntimeColors } from '@/constants/theme';
import { TABS } from '@/constants/tabs';

const iconProps = { renderingMode: 'template' as const };

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = RuntimeColors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      {TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name={tab.ioniconsName} />}
            {...iconProps}
          />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
