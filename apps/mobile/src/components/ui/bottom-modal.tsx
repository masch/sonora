import { ReactNode, useEffect, useRef } from 'react';
import { KeyboardAvoidingView, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTranslation } from '@/hooks/use-translation';
import { TwPressable, TwView } from '@/tw';

interface BottomModalProps {
  visible: boolean;
  onDismiss: () => void;
  children: ReactNode;
  autoDismissTrigger?: boolean;
  autoDismissDelay?: number;
  accessibilityLabel?: string;
}

/**
 * Reusable modal component that slides from the bottom,
 * overlays the screen, and handles safe area insets at the bottom.
 * Supports tap-to-dismiss on backdrop, keyboard avoidance, and auto-dismiss.
 */
export function BottomModal({
  visible,
  onDismiss,
  children,
  autoDismissTrigger,
  autoDismissDelay,
  accessibilityLabel,
}: BottomModalProps) {
  const insets = useSafeAreaInsets();
  const { t } = useAppTranslation();
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (visible && autoDismissTrigger) {
      const timer = setTimeout(() => {
        onDismissRef.current();
      }, autoDismissDelay ?? 2000);
      return () => clearTimeout(timer);
    }
  }, [visible, autoDismissTrigger, autoDismissDelay]);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onDismiss}
      statusBarTranslucent={true}
    >
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <TwView className="flex-1 justify-end">
          <TwPressable
            onPress={onDismiss}
            testID="bottom-modal-backdrop"
            accessibilityLabel={accessibilityLabel ?? t('common.dismiss')}
            className="absolute inset-0 bg-black/50"
          />
          <TwView testID="bottom-modal-content-container">
            <TwView
              className="bg-background rounded-t-3xl p-6 gap-4"
              style={{ paddingBottom: 24 + insets.bottom }}
            >
              {children}
            </TwView>
          </TwView>
        </TwView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
