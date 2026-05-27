import type { ReactNode } from 'react';
import type { ScrollViewProps } from 'react-native';

import { TwView, TwScrollView } from '@/tw';

type ScreenWrapperProps = {
  children: ReactNode;
  className?: string;
};

type ScrollScreenWrapperProps = ScreenWrapperProps &
  Pick<ScrollViewProps, 'contentInset' | 'contentContainerStyle' | 'contentContainerClassName'>;

/**
 * Non-scrollable screen wrapper.
 *
 * Renders a `TwView` with `flex-1 bg-background` pre-applied.
 * Add layout-specific classes via `className`.
 */
export function ScreenWrapper({ children, className }: ScreenWrapperProps) {
  return (
    <TwView
      className={`flex-1 bg-background${className ? ` ${className}` : ''}`}>
      {children}
    </TwView>
  );
}

/**
 * Scrollable screen wrapper.
 *
 * Renders a `TwScrollView` with `flex-1 bg-background` pre-applied.
 * Accepts `contentInset`, `contentContainerStyle`, `contentContainerClassName`
 * for scroll-specific configuration.
 */
export function ScrollScreenWrapper({
  children,
  className,
  contentInset,
  contentContainerStyle,
  contentContainerClassName,
}: ScrollScreenWrapperProps) {
  return (
    <TwScrollView
      className={`flex-1 bg-background${className ? ` ${className}` : ''}`}
      contentInset={contentInset}
      contentContainerStyle={contentContainerStyle}
      contentContainerClassName={contentContainerClassName}>
      {children}
    </TwScrollView>
  );
}
