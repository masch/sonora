import type React from 'react';
import { useCssElement } from 'react-native-css';
import { Image as ExpoImage, type ImageProps as ExpoImageProps } from 'expo-image';

export function TwImage(props: ExpoImageProps & { className?: string }): React.ReactElement {
  return useCssElement(ExpoImage, props, { className: 'style' } as never) as never;
}
TwImage.displayName = 'TwImage';

