import type { ReactNode } from 'react';
import { Platform, type ScrollViewProps, type ImageSourcePropType } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { TwScrollView, TwView } from '@/tw';
import { TwImage } from '@/tw/image';
import { BottomTabInset, TabBottomPadding } from '@/constants/theme';
import { useAudioPlayerStore } from '@/store/audio-player-store';

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
  backgroundImage?: ImageSourcePropType;
  fullWidth?: boolean;
}

function getGlobalPlayerPadding(status: string, currentUri: string | null): number {
  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';
  if ((isPlaying || isPaused) && currentUri !== null) {
    return Platform.OS === 'android' ? 76 : 64;
  }
  return 0;
}

function getScrollContentWidthClass(fullWidth: boolean): string {
  if (fullWidth || Platform.OS !== 'web') {
    return 'w-full grow';
  }
  return 'w-full max-w-[800px] self-center grow';
}

function getScrollWrapperStyles(
  className?: string,
  contentContainerClassName?: string,
  backgroundImage?: ImageSourcePropType,
) {
  const finalBgClass = backgroundImage ? 'bg-transparent' : 'bg-background';
  const finalClassName = `flex-1 ${finalBgClass}${className ? ` ${className}` : ''}`;
  const finalContentClassName = backgroundImage
    ? `bg-transparent${contentContainerClassName ? ` ${contentContainerClassName}` : ''}`
    : contentContainerClassName;
  return { finalClassName, finalContentClassName };
}

function useScrollInsets(withTabBar: boolean, disableBottomPadding: boolean) {
  const status = useAudioPlayerStore((s) => s.status);
  const currentUri = useAudioPlayerStore((s) => s.currentUri);

  const extraPadding = getGlobalPlayerPadding(status, currentUri);
  const totalInset = TAB_BAR_INSET + extraPadding;
  const shouldApplyPadding = withTabBar && !disableBottomPadding;

  const contentInset =
    shouldApplyPadding && Platform.OS === 'ios' ? { bottom: totalInset } : undefined;
  const paddingStyle = shouldApplyPadding ? { paddingBottom: totalInset } : undefined;

  return { contentInset, paddingStyle };
}

/**
 * Scrollable screen wrapper.
 *
 * Includes SafeAreaView + bottom tab bar inset automatically if withTabBar is true.
 * Renders a `TwScrollView` with `flex-1 bg-background` pre-applied.
 * Automatically constrains and centers content on desktop web up to max-w-[800px].
 */
export function ScrollScreenWrapper({
  children,
  className,
  contentContainerStyle,
  contentContainerClassName,
  withTabBar = true,
  disableBottomPadding = false,
  backgroundImage,
  fullWidth = false,
}: ScrollScreenWrapperProps) {
  const { contentInset, paddingStyle } = useScrollInsets(withTabBar, disableBottomPadding);
  const edges: Edge[] = withTabBar ? ['top', 'left', 'right'] : ['top', 'left', 'right', 'bottom'];
  const { finalClassName, finalContentClassName } = getScrollWrapperStyles(
    className,
    contentContainerClassName,
    backgroundImage,
  );
  const contentWidthClass = getScrollContentWidthClass(fullWidth);

  return (
    <TwView className="flex-1 bg-background">
      {backgroundImage && (
        <TwImage
          source={backgroundImage}
          className="absolute inset-0 w-full h-full"
          contentFit="cover"
          alt=""
        />
      )}
      <SafeAreaView style={{ flex: 1 }} edges={edges}>
        <TwScrollView
          className={finalClassName}
          contentInset={contentInset}
          contentContainerStyle={[paddingStyle, contentContainerStyle]}
          contentContainerClassName={finalContentClassName}
        >
          <TwView className={contentWidthClass}>{children}</TwView>
        </TwScrollView>
      </SafeAreaView>
    </TwView>
  );
}
