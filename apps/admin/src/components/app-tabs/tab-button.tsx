import type { TabTriggerSlotProps } from 'expo-router/ui';
import type { SFSymbol, AndroidSymbol } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/icon';
import { TwView, TwPressable } from '@/tw';
import { useThemeColors } from '@/hooks/use-theme-colors';

interface IconSymbols {
  ios: SFSymbol;
  android: AndroidSymbol;
  web: AndroidSymbol;
}

interface TabButtonProps extends TabTriggerSlotProps {
  icon: IconSymbols;
  label?: string;
  hideLabel?: boolean;
  href?: string;
  target?: string;
  rel?: string;
}

export function TabButton({
  label,
  hideLabel,
  isFocused,
  icon,
  onPress,
  style,
  href,
  target,
  rel,
}: TabButtonProps) {
  const colors = useThemeColors();

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
        style={{
          backgroundColor: isFocused ? colors.tabBarSelectedBg : 'transparent',
        }}
        className="flex-row items-center gap-1.5 py-1 px-4 rounded-2xl"
      >
        <Icon
          ios={icon.ios}
          android={icon.android}
          web={icon.web}
          size={14}
          tintColor={isFocused ? colors.tabBarIconActive : colors.tabBarIconInactive}
        />
        {label && !hideLabel && (
          <ThemedText
            type="small"
            style={{ color: isFocused ? colors.tabBarIconActive : colors.tabBarIconInactive }}
          >
            {label}
          </ThemedText>
        )}
      </TwView>
    </TwPressable>
  );
}
