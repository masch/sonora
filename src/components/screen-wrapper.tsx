import type { ReactNode } from 'react';
import type { ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TwView, TwScrollView } from '@/tw';
import { BottomTabInset, TabBottomPadding } from '@/constants/theme';

const TAB_BAR_INSET = BottomTabInset + TabBottomPadding;

type ScreenWrapperProps = {
  children: ReactNode;
  className?: string;
};

type ScrollScreenWrapperProps = ScreenWrapperProps &
  Pick<ScrollViewProps, 'contentContainerStyle' | 'contentContainerClassName'>;

/**
 * Non-scrollable screen wrapper.
 *
 * Includes SafeAreaView + bottom tab bar inset automatically.
 * Renders a `TwView` inside with `flex-1 bg-background` pre-applied.
 */
export function ScreenWrapper({ children, className }: ScreenWrapperProps) {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <TwView
        className={`flex-1 bg-background${className ? ` ${className}` : ''}`}
        style={{ paddingBottom: TAB_BAR_INSET }}>
        {children}
      </TwView>
    </SafeAreaView>
  );
}

/**
 * Scrollable screen wrapper.
 *
 * Includes SafeAreaView + bottom tab bar inset automatically.
 * Renders a `TwScrollView` with `flex-1 bg-background` pre-applied.
 */
export function ScrollScreenWrapper({
  children,
  className,
  contentContainerStyle,
  contentContainerClassName,
}: ScrollScreenWrapperProps) {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <TwScrollView
        className={`flex-1 bg-background${className ? ` ${className}` : ''}`}
        contentInset={{ bottom: TAB_BAR_INSET }}
        contentContainerStyle={contentContainerStyle}
        contentContainerClassName={contentContainerClassName}>
        {children}
      </TwScrollView>
    </SafeAreaView>
  );
}
