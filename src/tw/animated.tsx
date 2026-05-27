import type React from 'react';
import { useCssElement } from 'react-native-css';
import Animated from 'react-native-reanimated';

export type TwAnimatedViewProps = React.ComponentProps<typeof Animated.View> & { className?: string };

export function TwAnimatedView(props: TwAnimatedViewProps) {
  // useCssElement with Animated.View produces a union type too complex for TS
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useCssElement(Animated.View, props as any, { className: 'style' });
}
TwAnimatedView.displayName = 'TwAnimatedView';
