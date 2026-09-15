import React from 'react';
import { ThemedText } from '@/components/themed-text';
import { ModalPrimitive } from '@/components/ui/modal-primitive';
import { useAppTranslation } from '@/hooks/use-translation';
import { updateService } from '@/services/update-service';
import { TwPressable, TwView } from '@/tw';

/** Module-scoped — no local state dependencies. */
function handleUpdatePress() {
  updateService.triggerUpdate({ mode: 'immediate' });
}

/**
 * Full-screen non-dismissable modal shown when the app version is blocked.
 * Prevents access to app content until the user updates.
 */
export function UpdateRequiredModal() {
  const { t } = useAppTranslation();

  return (
    <ModalPrimitive visible transparent={false} animationType="fade" dismissable={false}>
      <TwView
        testID="update-required-modal"
        className="flex-1 justify-center items-center p-8 bg-background"
      >
        <TwView className="items-center gap-6 max-w-sm">
          <ThemedText className="text-2xl font-bold text-center">
            {t('versionCheck.modalTitle')}
          </ThemedText>
          <ThemedText className="text-base text-center text-textSecondary">
            {t('versionCheck.modalMessage')}
          </ThemedText>
          <TwPressable
            testID="update-download-button"
            accessibilityLabel={t('versionCheck.modalButton')}
            className="px-8 py-3 bg-indigo-600 rounded-xl active:opacity-75"
            onPress={handleUpdatePress}
          >
            <ThemedText className="text-white font-semibold text-base">
              {t('versionCheck.modalButton')}
            </ThemedText>
          </TwPressable>
        </TwView>
      </TwView>
    </ModalPrimitive>
  );
}
