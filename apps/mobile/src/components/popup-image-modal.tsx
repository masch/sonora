import { TwImage, TwPressable } from '@/tw';
import type { ImageProps as ExpoImageProps } from 'expo-image';
import { useState } from 'react';
import { ModalPrimitive } from './ui/modal-primitive';

/**
 * Clickable responsive image preview that expands into a full-screen modal viewer.
 * Automatically adapts its height to match the image's native aspect ratio with rounded corners.
 */

// Infiere la prop source exacta que acepta TwImage
export interface PopupImageModalProps {
  source: ExpoImageProps['source'];
  alt?: string;
  testID?: string;
  className?: string;
}

export function PopupImageModal({
  source,
  alt,
  testID = 'explore-routes-image-trigger',
  className = 'w-full overflow-hidden rounded-[24px] bg-transparent active:opacity-85',
}: PopupImageModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number | undefined>(undefined);

  return (
    <>
      <TwPressable
        onPress={() => setIsVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={alt}
        testID={testID}
        className={className}
        style={aspectRatio ? { aspectRatio } : undefined}
      >
        <TwImage
          source={source}
          className="w-full h-full rounded-[24px]"
          contentFit="cover"
          pointerEvents="none"
          onLoad={(e) => {
            const { width, height } = e.source;
            if (width && height) {
              setAspectRatio(width / height);
            }
          }}
          alt={alt}
        />
      </TwPressable>

      <ModalPrimitive
        visible={isVisible}
        transparent={false}
        animationType="fade"
        onDismiss={() => setIsVisible(false)}
      >
        <TwPressable
          className="flex-1 w-full h-full bg-black items-center justify-center"
          onPress={() => setIsVisible(false)}
        >
          <TwImage source={source} className="w-full h-full" contentFit="contain" alt={alt} />
        </TwPressable>
      </ModalPrimitive>
    </>
  );
}
