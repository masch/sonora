import { ReactNode, useEffect, useRef } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTranslation } from '@/hooks/use-translation';
import { ModalPrimitive } from '@/components/ui/modal-primitive';
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

  const bottomPadding = Platform.select({
    ios: 24 + insets.bottom,
    web: 16,
    default: 24,
  });

  return (
    <ModalPrimitive visible={visible} dismissable onDismiss={onDismiss}>
      <TwView className="flex-1 justify-end">
        <TwPressable
          onPress={onDismiss}
          testID="bottom-modal-backdrop"
          accessibilityLabel={accessibilityLabel ?? t('common.dismiss')}
          className="absolute inset-0 bg-black/50"
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          testID="bottom-modal-keyboard-view"
        >
          <TwView testID="bottom-modal-content-container">
            <TwView
              className="bg-background rounded-t-3xl pt-6 px-6 gap-4"
              style={{
                paddingBottom: bottomPadding,
              }}
            >
              {children}
            </TwView>
          </TwView>
        </KeyboardAvoidingView>
      </TwView>
    </ModalPrimitive>
  );
}
