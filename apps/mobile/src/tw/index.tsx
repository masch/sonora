import type React from 'react';
import { type Pressable as RNPressable, Text as RNText } from 'react-native';

import { TwTextBase, TwPressable } from './factory';

export { TwView, TwScrollView, TwPressable, TwTextInput } from './factory';

/**
 * Renders text with the default sans-serif font styling.
 *
 * @param props - Text properties with an optional `className` for additional styling.
 */
export function TwText(props: React.ComponentProps<typeof RNText> & { className?: string }) {
  const { className = '', style, ...rest } = props;

  return <TwTextBase className={`font-sans ${className}`} style={style} {...rest} />;
}
export { TwImage } from './image';

/**
 * Renders a pressable element with button accessibility semantics by default.
 *
 * @param props - Pressable properties and optional link attributes.
 */
export function TwButton(
  props: React.ComponentProps<typeof RNPressable> & {
    href?: string;
    target?: string;
    rel?: string;
  },
) {
  return <TwPressable accessibilityRole="button" {...props} />;
}
