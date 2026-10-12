import React from 'react';
import { BottomModal } from '@/components/ui/bottom-modal';
import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { useAudioPlayerStore } from '@/store/audio-player-store';
import { useAppTranslation } from '@/hooks/use-translation';
import { TwView } from '@/tw';

export function InterruptConfirmationModal() {
  const { t } = useAppTranslation();
  const pendingPlayRequest = useAudioPlayerStore((s) => s.pendingPlayRequest);
  const confirmInterrupt = useAudioPlayerStore((s) => s.confirmInterrupt);
  const cancelInterrupt = useAudioPlayerStore((s) => s.cancelInterrupt);

  const visible = pendingPlayRequest !== null;

  if (!visible) return null;

  return (
    <BottomModal
      visible={visible}
      onDismiss={cancelInterrupt}
      title={t('audio.interruptModalTitle')}
      showCloseButton={false}
      accessibilityLabel={t('audio.interruptModalTitle')}
      footer={
        <TwView className="flex-row gap-3">
          <Button
            className="flex-1"
            variant="outline"
            testID="interrupt-deny-button"
            onPress={cancelInterrupt}
            accessibilityLabel={t('common.no')}
            label={t('common.no')}
          />
          <Button
            className="flex-1"
            variant="primary"
            testID="interrupt-confirm-button"
            onPress={confirmInterrupt}
            accessibilityLabel={t('common.yes')}
            label={t('common.yes')}
          />
        </TwView>
      }
    >
      <TwView testID="interrupt-confirmation-modal">
        <ThemedText className="text-sm text-center text-textSecondary">
          {t('audio.interruptModalMessage')}
        </ThemedText>
      </TwView>
    </BottomModal>
  );
}
