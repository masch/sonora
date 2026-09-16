import React, { useState } from 'react';
import { ThemedText } from '@/components/themed-text';
import { useAppTranslation } from '@/hooks/use-translation';
import { updateService } from '@/services/update-service';
import { TwPressable, TwView } from '@/tw';

/** Module-scoped update trigger. */
function handleUpdatePress() {
  updateService.triggerUpdate({ mode: 'flexible' });
}

/**
 * Dismissable banner shown when a newer app version is available
 * but the current version is not blocked.
 */
export function UpdateWarningBanner() {
  const { t } = useAppTranslation();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <TwView testID="update-warning-banner" className="px-4 py-3 bg-amber-500/90">
      <TwView className="flex-row items-center justify-between">
        <TwView className="flex-1 mr-3">
          <ThemedText className="font-bold text-sm text-white">
            {t('versionCheck.bannerTitle')}
          </ThemedText>
          <ThemedText className="text-xs text-white/90 mt-0.5">
            {t('versionCheck.bannerMessage')}
          </ThemedText>
        </TwView>
        <TwView className="flex-row items-center gap-2">
          <TwPressable
            testID="update-banner-update-button"
            onPress={handleUpdatePress}
            accessibilityLabel={t('versionCheck.bannerUpdate')}
            className="px-3 py-1.5 bg-white rounded-lg active:opacity-75"
          >
            <ThemedText className="text-amber-800 font-semibold text-xs">
              {t('versionCheck.bannerUpdate')}
            </ThemedText>
          </TwPressable>
          <TwPressable
            testID="update-banner-dismiss-button"
            onPress={() => setDismissed(true)}
            accessibilityLabel={t('versionCheck.bannerDismiss')}
            className="px-3 py-1.5 bg-white/20 rounded-lg active:opacity-75"
          >
            <ThemedText className="text-white font-medium text-xs">
              {t('versionCheck.bannerDismiss')}
            </ThemedText>
          </TwPressable>
        </TwView>
      </TwView>
    </TwView>
  );
}
