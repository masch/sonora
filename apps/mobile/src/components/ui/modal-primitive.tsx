import { type ReactNode } from 'react';
import { Modal } from 'react-native';

interface ModalPrimitiveProps {
  visible: boolean;
  transparent?: boolean;
  animationType?: 'none' | 'slide' | 'fade';
  dismissable?: boolean;
  onDismiss?: () => void;
  children: ReactNode;
}

/**
 * Base wrapper around React Native's `<Modal>` that
 * sets sensible defaults and makes dismissability explicit.
 */
export function ModalPrimitive({
  visible,
  transparent = true,
  animationType = 'slide',
  dismissable = true,
  onDismiss,
  children,
}: ModalPrimitiveProps) {
  return (
    <Modal
      visible={visible}
      transparent={transparent}
      animationType={animationType}
      onRequestClose={dismissable ? onDismiss : () => {}}
      statusBarTranslucent
    >
      {children}
    </Modal>
  );
}
