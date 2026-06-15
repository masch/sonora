import type React from 'react';
import type { ComponentType } from 'react';
import { useCssElement } from 'react-native-css';
import Animated from 'react-native-reanimated';

export type TwAnimatedViewProps = React.ComponentProps<typeof Animated.View> & {
  className?: string;
};

export function TwAnimatedView(props: TwAnimatedViewProps) {
  // useCssElement with Animated.View produces a union type too complex for TS (TS2590).
  // Narrowing the component type prevents TS from resolving the deeply nested union,
  // while ComponentType<{ style: unknown }> matches the internal default mapping type.
  const View = Animated.View as unknown as ComponentType<{ style: unknown }>;
  return useCssElement(View, props, { className: 'style' });
}
TwAnimatedView.displayName = 'TwAnimatedView';
