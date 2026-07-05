import type { ReactNode } from 'react';
import { type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TwScrollView, TwView } from '@/tw';

interface ScreenWrapperProps {
  children: ReactNode;
  className?: string;
}

interface ScrollScreenWrapperProps extends ScreenWrapperProps {
  contentContainerClassName?: ScrollViewProps['contentContainerClassName'];
}

export function ScreenWrapper({ children, className }: ScreenWrapperProps) {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right', 'bottom']}>
      <TwView className={`flex-1 bg-background ${className || ''}`}>{children}</TwView>
    </SafeAreaView>
  );
}

export function ScrollScreenWrapper({
  children,
  className,
  contentContainerClassName,
}: ScrollScreenWrapperProps) {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right', 'bottom']}>
      <TwView className="flex-1 bg-background">
        <TwScrollView
          className={`flex-1 bg-background ${className || ''}`}
          contentContainerClassName={contentContainerClassName}
        >
          {children}
        </TwScrollView>
      </TwView>
    </SafeAreaView>
  );
}
