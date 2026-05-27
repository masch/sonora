import type { SFSymbol, AndroidSymbol } from 'expo-symbols';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { SymbolView } from 'expo-symbols';
import { useColorScheme } from 'react-native';

import { ExternalLink } from './external-link';
import { Icon } from './icon';
import { ThemedText } from './themed-text';
import { TwView, TwPressable } from '@/tw';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton icon={{ ios: 'house', android: 'home', web: 'home' }}>Home</TabButton>
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton icon={{ ios: 'compass.drawing', android: 'explore', web: 'explore' }}>Explore</TabButton>
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <TabButton icon={{ ios: 'gear', android: 'settings', web: 'settings' }}>Settings</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

type IconSymbols = { ios: SFSymbol; android: AndroidSymbol; web: AndroidSymbol };

type TabButtonProps = TabTriggerSlotProps & {
  icon: IconSymbols;
};

export function TabButton({ children, isFocused, icon, ...props }: TabButtonProps) {
  return (
    <TwPressable {...props} className="active:opacity-70">
      <TwView
        className={`flex-row items-center gap-1.5 ${isFocused ? 'bg-backgroundSelected' : 'bg-backgroundElement'} py-1 px-4 rounded-2xl`}>
        <Icon
          ios={icon.ios}
          android={icon.android}
          web={icon.web}
          size={14}
          tintColor={isFocused ? 'rgb(107 114 128)' : 'rgb(156 163 175)'}
        />
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </TwView>
    </TwPressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <TwView className="absolute w-full p-4 justify-center items-center flex-row">
      <TwView
        className="bg-backgroundElement py-2 px-8 rounded-[32px] flex-row items-center max-w-[800px] w-full gap-2"
        {...props}>
        <ThemedText type="smallBold">Expo Starter</ThemedText>

        <TwView className="flex-1 flex-row justify-center gap-1">
          {props.children}
        </TwView>

        <ExternalLink href="https://docs.expo.dev" asChild>
          <TwPressable className="flex-row justify-center items-center gap-1">
            <ThemedText type="link">Docs</ThemedText>
            <SymbolView
              tintColor={colors.text}
              name={{ ios: 'arrow.up.right.square', web: 'link' }}
              size={12}
            />
          </TwPressable>
        </ExternalLink>
      </TwView>
    </TwView>
  );
}
