import { useRef, useState, type ReactNode } from 'react';

import { BottomModal } from '@/components/ui/bottom-modal';
import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { TwView } from '@/tw';

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

  const confirm = (opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setOptions(opts);
      setVisible(true);
    });
  };

  const handleConfirm = () => {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setVisible(false);
  };

  const handleDismiss = () => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setVisible(false);
  };

  const component = options ? (
    <BottomModal
      visible={visible}
      onDismiss={handleDismiss}
      title={options.title}
      showCloseButton={false}
      footer={
        <TwView className="flex-row gap-3">
          {options.cancelLabel && (
            <Button
              className="flex-1"
              variant="outline"
              onPress={handleDismiss}
              testID="confirm-cancel-button"
              accessibilityLabel={options.cancelLabel}
              label={options.cancelLabel}
            />
          )}
          <Button
            className={`flex-1 ${options.destructive ? 'bg-red-500 active:bg-red-600' : 'bg-blue-500 active:bg-blue-600'}`}
            variant="primary"
            onPress={handleConfirm}
            testID={options.destructive ? 'confirm-destructive-button' : 'confirm-button'}
            accessibilityLabel={options.confirmLabel}
            label={options.confirmLabel}
          />
        </TwView>
      }
    >
      <ThemedText className="text-sm text-textSecondary">{options.message}</ThemedText>
    </BottomModal>
  ) : null;

  return { confirm, component };
}
