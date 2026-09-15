import React from 'react';
import { Linking } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ModalPrimitive } from '@/components/ui/modal-primitive';
import { useAppTranslation } from '@/hooks/use-translation';
import { getPlayStoreUrl } from '@/services/store-url';
import { isAndroidBrowser } from '@/utils/platform';
import { TwPressable, TwView } from '@/tw';

/** Module-scoped store redirect. */
function handleOpenPlayStore() {
  const url = getPlayStoreUrl();
  Linking.openURL(url).catch(() => {
    if (typeof window !== 'undefined') {
      window.location.href = url;
    }
  });
}

/**
 * Non-dismissable gate displayed when the web application is accessed
 * from an Android browser, requiring users to install the native app.
 */
export function AndroidWebGate() {
  const { t } = useAppTranslation();

  if (!isAndroidBrowser()) {
    return null;
  }

  return (
    <ModalPrimitive visible transparent={false} animationType="fade" dismissable={false}>
      <TwView
        testID="android-web-gate"
        className="flex-1 justify-center items-center p-8 bg-background"
      >
        <TwView className="items-center gap-6 max-w-sm">
          <ThemedText className="text-2xl font-bold text-center">{t('webGate.title')}</ThemedText>
          <ThemedText className="text-base text-center text-textSecondary">
            {t('webGate.message')}
          </ThemedText>
          <TwPressable
            testID="android-web-gate-button"
            accessibilityLabel={t('webGate.button')}
            className="px-8 py-3 bg-emerald-600 rounded-xl active:opacity-75"
            onPress={handleOpenPlayStore}
          >
            <ThemedText className="text-white font-semibold text-base">
              {t('webGate.button')}
            </ThemedText>
          </TwPressable>
        </TwView>
      </TwView>
    </ModalPrimitive>
  );
}
