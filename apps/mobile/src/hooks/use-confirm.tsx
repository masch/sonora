import { useCallback, useRef, useState, type ReactNode } from 'react';

import { BottomModal } from '@/components/ui/bottom-modal';
import { ThemedText } from '@/components/themed-text';
import { TwPressable, TwView } from '@/tw';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ConfirmResult {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  component: ReactNode;
}

/**
 * Promise-based confirm dialog backed by BottomModal.
 *
 * Usage:
 *   const { confirm, component } = useConfirm();
 *
 *   if (condition) {
 *     const ok = await confirm({ title, message, confirmLabel, cancelLabel });
 *     if (ok) doSomething();
 *   }
 *
 *   return (
 *     <>
 *       {component}
 *       ...
 *     </>
 *   );
 */
export function useConfirm(): ConfirmResult {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setOptions(opts);
      setVisible(true);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setVisible(false);
  }, []);

  const handleDismiss = useCallback(() => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setVisible(false);
  }, []);

  const component = options ? (
    <BottomModal visible={visible} onDismiss={handleDismiss}>
      <TwView className="px-6 pb-2">
        <ThemedText type="subtitle" className="mb-2">
          {options.title}
        </ThemedText>
        <ThemedText className="mb-6">{options.message}</ThemedText>
        <TwView className="flex-row gap-3">
          {options.cancelLabel && (
            <TwPressable
              className="flex-1 rounded-xl py-3 items-center border border-border"
              onPress={handleDismiss}
              testID="confirm-cancel-button"
              accessibilityLabel={options.cancelLabel}
            >
              <ThemedText>{options.cancelLabel}</ThemedText>
            </TwPressable>
          )}
          <TwPressable
            className={`flex-1 rounded-xl py-3 items-center ${
              options.destructive ? 'bg-red-500' : 'bg-blue-500'
            }`}
            onPress={handleConfirm}
            testID={options.destructive ? 'confirm-destructive-button' : 'confirm-button'}
            accessibilityLabel={options.confirmLabel}
          >
            <ThemedText className="text-white font-semibold">{options.confirmLabel}</ThemedText>
          </TwPressable>
        </TwView>
      </TwView>
    </BottomModal>
  ) : null;

  return { confirm, component };
}
