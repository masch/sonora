import type React from 'react';
import {
  type Pressable as RNPressable,
  Text as RNText,
  type TextInput as RNTextInput,
  Platform,
} from 'react-native';

import { TwTextBase, TwPressable, TwTextInputBase } from './factory';
import { useThemeColors } from '@/hooks/use-theme-colors';

export { TwView, TwScrollView, TwPressable } from './factory';

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

/**
 * Renders a text input with theme-aware default placeholderTextColor, font-sans, and web outline reset.
 *
 * @param props - TextInput properties with an optional `className` and `placeholderTextColor`.
 */
export function TwTextInput(
  props: React.ComponentProps<typeof RNTextInput> & { className?: string },
) {
  const colors = useThemeColors();
  const placeholderTextColor = props.placeholderTextColor ?? colors.textSecondary;
  const webOutline = Platform.OS === 'web' ? 'outline-none' : '';
  const className = `font-sans ${webOutline} ${props.className ?? ''}`.trim();

  return (
    <TwTextInputBase {...props} className={className} placeholderTextColor={placeholderTextColor} />
  );
}
