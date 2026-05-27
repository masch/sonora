import type React from 'react';
import { useCssElement } from 'react-native-css';
import Animated from 'react-native-reanimated';

export type TwAnimatedViewProps = React.ComponentProps<typeof Animated.View> & { className?: string };

export function TwAnimatedView(props: TwAnimatedViewProps) {
  return useCssElement(Animated.View, props, { className: 'style' });
}
TwAnimatedView.displayName = 'TwAnimatedView';
