import type { ReactNode } from 'react';
import { Platform, type ScrollViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { TwScrollView } from '@/tw';
import { BottomTabInset, TabBottomPadding } from '@/constants/theme';

export const TAB_BAR_INSET = BottomTabInset + TabBottomPadding;

interface ScreenWrapperProps {
  children: ReactNode;
  className?: string;
  withTabBar?: boolean;
}

interface ScrollScreenWrapperProps extends ScreenWrapperProps {
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
  contentContainerClassName?: ScrollViewProps['contentContainerClassName'];
  disableBottomPadding?: boolean;
}

/**
 * Scrollable screen wrapper.
 *
 * Includes SafeAreaView + bottom tab bar inset automatically if withTabBar is true.
 * Renders a `TwScrollView` with `flex-1 bg-background` pre-applied.
 */
export function ScrollScreenWrapper({
  children,
  className,
  contentContainerStyle,
  contentContainerClassName,
  withTabBar = true,
  disableBottomPadding = false,
}: ScrollScreenWrapperProps) {
  const edges: Edge[] = withTabBar ? ['top', 'left', 'right'] : ['top', 'left', 'right', 'bottom'];
  return (
    <SafeAreaView style={{ flex: 1 }} edges={edges}>
      <TwScrollView
        className={`flex-1 bg-background${className ? ` ${className}` : ''}`}
        contentInset={
          withTabBar && !disableBottomPadding && Platform.OS === 'ios'
            ? { bottom: TAB_BAR_INSET }
            : undefined
        }
        contentContainerStyle={[
          withTabBar &&
            !disableBottomPadding &&
            Platform.OS === 'ios' && { paddingBottom: TAB_BAR_INSET },
          contentContainerStyle,
        ]}
        contentContainerClassName={contentContainerClassName}
      >
        {children}
      </TwScrollView>
    </SafeAreaView>
  );
}
