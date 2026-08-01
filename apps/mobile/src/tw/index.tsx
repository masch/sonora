import type React from 'react';
import { Text as RNText } from 'react-native';

import { TwTextBase } from './factory';

export { TwView, TwScrollView, TwPressable, TwTextInput } from './factory';

export function TwText(props: React.ComponentProps<typeof RNText> & { className?: string }) {
  const { className = '', style, ...rest } = props;

  return <TwTextBase className={`font-sans ${className}`} style={style} {...rest} />;
}
export { TwImage } from './image';
