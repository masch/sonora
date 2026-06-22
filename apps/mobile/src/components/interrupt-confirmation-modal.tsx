import React from 'react';
import { BottomModal } from '@/components/ui/bottom-modal';
import { ThemedText } from '@/components/themed-text';
import { useAudioPlayerStore } from '@/store/audio-player-store';
import { useAppTranslation } from '@/hooks/use-translation';
import { TwPressable, TwView } from '@/tw';

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
      accessibilityLabel={t('audio.interruptModalTitle')}
    >
      <TwView testID="interrupt-confirmation-modal" className="gap-4">
        <ThemedText className="text-lg font-bold text-center">
          {t('audio.interruptModalTitle')}
        </ThemedText>
        <ThemedText className="text-sm text-center text-textSecondary mb-4">
          {t('audio.interruptModalMessage')}
        </ThemedText>
        <TwView className="flex-row gap-4 justify-center">
          <TwPressable
            testID="interrupt-deny-button"
            onPress={cancelInterrupt}
            accessibilityLabel={t('common.no')}
            className="px-6 py-2.5 bg-zinc-200 dark:bg-zinc-700 rounded-xl active:opacity-75"
          >
            <ThemedText className="font-semibold">{t('common.no')}</ThemedText>
          </TwPressable>
          <TwPressable
            testID="interrupt-confirm-button"
            onPress={confirmInterrupt}
            accessibilityLabel={t('common.yes')}
            className="px-6 py-2.5 bg-emerald-500 rounded-xl active:opacity-75"
          >
            <ThemedText className="font-semibold text-white">{t('common.yes')}</ThemedText>
          </TwPressable>
        </TwView>
      </TwView>
    </BottomModal>
  );
}
