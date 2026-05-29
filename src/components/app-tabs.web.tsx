import type { SFSymbol, AndroidSymbol } from 'expo-symbols';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Icon } from './icon';
import { useAppTranslation } from '@/hooks/use-translation';
import { ThemedText } from './themed-text';
import { TwView, TwPressable } from '@/tw';

import { TABS } from '@/constants/tabs';

export default function AppTabs() {
  const { t } = useAppTranslation();
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.name === 'index' ? '/' : `/${tab.name}`} asChild>
              <TabButton icon={tab.symbolViewName}>{t(`tabs.${tab.name}`)}</TabButton>
            </TabTrigger>
          ))}
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

type IconSymbols = { ios: SFSymbol; android: AndroidSymbol; web: AndroidSymbol };

type TabButtonProps = TabTriggerSlotProps & {
  icon: IconSymbols;
  href?: string;
  target?: string;
  rel?: string;
};

export function TabButton({ children, isFocused, icon, onPress, style, href, target, rel }: TabButtonProps) {
  return (
    <TwPressable
      onPress={onPress}
      style={style}
      {...({ href, target, rel } as Record<string, unknown>)}
      className="active:opacity-70">
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

export function CustomTabList({ children, style }: TabListProps) {
  return (
    <TwView className="absolute w-full p-4 justify-center items-center flex-row">
      <TwView
        style={style}
        className="bg-backgroundElement py-2 px-8 rounded-[32px] flex-row items-center justify-center gap-2 self-start">
        {children}
      </TwView>
    </TwView>
  );
}
