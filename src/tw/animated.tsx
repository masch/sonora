import type React from 'react';
import { useCssElement } from 'react-native-css';
import Animated from 'react-native-reanimated';
import type { ViewProps } from 'react-native';

export function TwAnimatedView(props: ViewProps & { className?: string }): React.ReactElement {
  // @ts-expect-error: useCssElement with Animated.View produces complex union type
  return useCssElement(Animated.View, props, { className: 'style' });
}
TwAnimatedView.displayName = 'TwAnimatedView';
