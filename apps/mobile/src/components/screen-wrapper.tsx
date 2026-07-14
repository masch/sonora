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
  backgroundImage,
}: ScrollScreenWrapperProps) {
  const status = useAudioPlayerStore((s) => s.status);
  const currentUri = useAudioPlayerStore((s) => s.currentUri);

  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';
  const playerVisible = (isPlaying || isPaused) && currentUri !== null;

  // Extra padding to avoid overlapping the global audio player
  const extraPadding = playerVisible ? (Platform.OS === 'android' ? 76 : 64) : 0;
  const totalInset = TAB_BAR_INSET + extraPadding;

  const edges: Edge[] = withTabBar ? ['top', 'left', 'right'] : ['top', 'left', 'right', 'bottom'];

  // If we have a background image, default wrapper and content background to transparent
  const finalBgClass = backgroundImage ? 'bg-transparent' : 'bg-background';
  const finalClassName = `flex-1 ${finalBgClass}${className ? ` ${className}` : ''}`;
  const finalContentClassName = backgroundImage
    ? `bg-transparent${contentContainerClassName ? ` ${contentContainerClassName}` : ''}`
    : contentContainerClassName;

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
          contentInset={
            withTabBar && !disableBottomPadding && Platform.OS === 'ios'
              ? { bottom: totalInset }
              : undefined
          }
          contentContainerStyle={[
            withTabBar && !disableBottomPadding && { paddingBottom: totalInset },
            contentContainerStyle,
          ]}
          contentContainerClassName={finalContentClassName}
        >
          {children}
        </TwScrollView>
      </SafeAreaView>
    </TwView>
  );
}
