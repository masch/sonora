import type React from 'react';
import { useCssElement } from 'react-native-css';
import {
  View as RNView,
  Text as RNText,
  ScrollView as RNScrollView,
  Pressable as RNPressable,
  TextInput as RNTextInput,
} from 'react-native';

function cssComponent<P>(
  Component: React.ComponentType<Record<string, unknown>>,
  mapping: Record<string, string>,
  name: string,
) {
  // useCssElement internally uses complex types; as any is required for this wrapper
  const Fn = (props: P): React.ReactElement => useCssElement(Component, props as any, mapping as any) as any;
  Fn.displayName = name;
  return Fn as (props: P) => React.ReactElement;
}

export const TwView = cssComponent<React.ComponentProps<typeof RNView>>(RNView, { className: 'style' }, 'TwView');
export const TwText = cssComponent<React.ComponentProps<typeof RNText>>(RNText, { className: 'style' }, 'TwText');
export const TwScrollView = cssComponent<
  React.ComponentProps<typeof RNScrollView> & { contentContainerClassName?: string }
>(RNScrollView, { className: 'style', contentContainerClassName: 'contentContainerStyle' }, 'TwScrollView');
export const TwPressable = cssComponent<React.ComponentProps<typeof RNPressable>>(RNPressable, { className: 'style' }, 'TwPressable');
export const TwTextInput = cssComponent<React.ComponentProps<typeof RNTextInput>>(RNTextInput, { className: 'style' }, 'TwTextInput');
