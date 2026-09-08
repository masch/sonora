import type React from 'react';
import { type Pressable as RNPressable, Text as RNText } from 'react-native';

import { TwTextBase, TwPressable } from './factory';

export { TwView, TwScrollView, TwPressable, TwTextInput } from './factory';

export function TwText(props: React.ComponentProps<typeof RNText> & { className?: string }) {
  const { className = '', style, ...rest } = props;

  return <TwTextBase className={`font-sans ${className}`} style={style} {...rest} />;
}
export { TwImage } from './image';

/**
 * Semantic button wrapper. Identical to TwPressable but defaults
 * `accessibilityRole` to "button" so screen readers always identify
 * interactive button elements correctly without per-call boilerplate.
 *
 * Use this for any element that acts as a button.
 * Keep TwPressable for non-button interactive elements (links, list rows, etc.).
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
