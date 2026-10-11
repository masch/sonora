import { ReactNode, useEffect, useRef } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconButton } from '@/components/ui/icon-button';
import { ModalPrimitive } from '@/components/ui/modal-primitive';
import { ModalBasePadding, ModalWebPadding } from '@/constants/theme';
import { useAppTranslation } from '@/hooks/use-translation';
import { TwPressable, TwView } from '@/tw';

export interface BottomModalProps {
  visible: boolean;
  onDismiss: () => void;
  title?: string;
  showCloseButton?: boolean;
  closeButtonTestID?: string;
  footer?: ReactNode;
  children: ReactNode;
  autoDismissTrigger?: boolean;
  autoDismissDelay?: number;
  accessibilityLabel?: string;
}

/**
 * Reusable modal component that slides from the bottom,
 * overlays the screen, and handles safe area insets at the bottom.
 * Supports standardized header (title + dismiss), body content, action footer,
 * tap-to-dismiss on backdrop, keyboard avoidance, and auto-dismiss.
 */
export function BottomModal({
  visible,
  onDismiss,
  title,
  showCloseButton,
  closeButtonTestID,
  footer,
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
    web: ModalWebPadding,
    default: ModalBasePadding + insets.bottom,
  });

  const hasHeader = Boolean(title) || showCloseButton === true;
  const isCloseVisible = showCloseButton ?? Boolean(title);

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
              {hasHeader && (
                <TwView className="flex-row justify-between items-center">
                  {title ? (
                    <ThemedText className="text-lg font-bold text-text">{title}</ThemedText>
                  ) : (
                    <TwView />
                  )}
                  {isCloseVisible && (
                    <IconButton
                      onPress={onDismiss}
                      testID={closeButtonTestID ?? 'bottom-modal-dismiss-button'}
                      accessibilityLabel={t('common.dismiss')}
                      icon={{
                        ios: 'xmark',
                        android: 'close',
                        web: 'close',
                      }}
                      size="sm"
                      className="-mr-2"
                    />
                  )}
                </TwView>
              )}
              {children}
              {footer}
            </TwView>
          </TwView>
        </KeyboardAvoidingView>
      </TwView>
    </ModalPrimitive>
  );
}
