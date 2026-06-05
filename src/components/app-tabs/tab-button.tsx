import type { TabTriggerSlotProps } from 'expo-router/ui';
import type { SFSymbol, AndroidSymbol } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/icon';
import { TwView, TwPressable } from '@/tw';

interface IconSymbols {
  ios: SFSymbol;
  android: AndroidSymbol;
  web: AndroidSymbol;
}

interface TabButtonProps extends TabTriggerSlotProps {
  icon: IconSymbols;
  label?: string;
  href?: string;
  target?: string;
  rel?: string;
}

export function TabButton({
  label,
  isFocused,
  icon,
  onPress,
  style,
  href,
  target,
  rel,
}: TabButtonProps) {
  return (
    <TwPressable
      onPress={onPress}
      style={style}
      href={href}
      target={target}
      rel={rel}
      accessibilityLabel={label}
      testID={href === '/' ? 'tab-index' : `tab-${href?.replace('/', '')}`}
      className="active:opacity-70"
    >
      <TwView
        className={`flex-row items-center gap-1.5 ${isFocused ? 'bg-backgroundSelected' : 'bg-backgroundElement'} py-1 px-4 rounded-2xl`}
      >
        <Icon
          ios={icon.ios}
          android={icon.android}
          web={icon.web}
          size={14}
          tintColor={isFocused ? 'rgb(107 114 128)' : 'rgb(156 163 175)'}
        />
        {label && (
          <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
            {label}
          </ThemedText>
        )}
      </TwView>
    </TwPressable>
  );
}
