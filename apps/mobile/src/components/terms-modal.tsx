import React, { useState } from 'react';
import { ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { TermsResponse } from '@sonora/shared';
import { ThemedText } from '@/components/themed-text';
import { ModalPrimitive } from '@/components/ui/modal-primitive';
import { useAppTranslation } from '@/hooks/use-translation';
import { useThemeColors } from '@/hooks/use-theme-colors';
import type { TermsStatus } from '@/hooks/use-terms-check';
import { TwPressable, TwView } from '@/tw';

export interface TermsModalProps {
  visible: boolean;
  status: TermsStatus;
  terms: TermsResponse | null;
  error?: string | null;
  onAccept: () => Promise<boolean> | boolean;
  onRetry: () => Promise<void> | void;
}

export function TermsModal({ visible, status, terms, error, onAccept, onRetry }: TermsModalProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAccept = async () => {
    setIsSubmitting(true);
    try {
      await onAccept();
      setIsSubmitting(false);
    } catch {
      setIsSubmitting(false);
    }
  };

  if (!visible || status === 'accepted') {
    return null;
  }

  return (
    <ModalPrimitive visible transparent={false} animationType="fade" dismissable={false}>
      <TwView testID="terms-modal" className="flex-1 bg-background">
        <SafeAreaView style={{ flex: 1 }}>
          {status === 'offline_blocked' ? (
            <TwView testID="terms-offline-view" className="flex-1 justify-center items-center px-6">
              <ThemedText className="text-2xl font-bold text-center mb-3">
                {t('terms.offlineTitle')}
              </ThemedText>
              <ThemedText className="text-base text-center text-textSecondary mb-8 max-w-sm">
                {t('terms.offlineDescription')}
              </ThemedText>
              <TwView className="w-full max-w-xs">
                <TwView className="bg-emerald-500 rounded-xl overflow-hidden shadow-sm">
                  <TwPressable
                    testID="terms-retry-button"
                    accessibilityLabel={t('terms.retry')}
                    className="py-3 items-center active:opacity-80"
                    onPress={onRetry}
                  >
                    <ThemedText
                      themeColor="background"
                      className="text-white font-extrabold text-sm"
                    >
                      {t('terms.retry')}
                    </ThemedText>
                  </TwPressable>
                </TwView>
              </TwView>
            </TwView>
          ) : (
            <TwView className="flex-1 px-6 py-4 justify-between">
              <TwView className="items-center">
                <ThemedText testID="terms-title" className="text-xl font-bold text-center mb-1">
                  {terms?.title ?? t('terms.title')}
                </ThemedText>
                {terms?.version && (
                  <ThemedText
                    testID="terms-version"
                    className="text-xs text-center text-textSecondary mb-2"
                  >
                    {t('terms.version', { version: terms.version })}
                  </ThemedText>
                )}
              </TwView>

              <TwView className="flex-1 my-2 p-4 rounded-xl border border-border bg-backgroundElement overflow-hidden">
                <ScrollView
                  testID="terms-content-scroll"
                  className="flex-1"
                  showsVerticalScrollIndicator={true}
                >
                  <ThemedText
                    testID="terms-content"
                    className="text-sm leading-relaxed"
                    style={{ color: colors.homeCardText }}
                  >
                    {terms?.content}
                  </ThemedText>
                </ScrollView>
              </TwView>

              {error && (
                <TwView className="my-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <ThemedText
                    testID="terms-error-message"
                    className="text-red-500 text-xs text-center font-medium"
                  >
                    {error}
                  </ThemedText>
                </TwView>
              )}

              <TwView className="self-stretch mt-3">
                <TwView className="bg-emerald-500 rounded-xl overflow-hidden shadow-sm">
                  <TwPressable
                    testID="terms-accept-button"
                    accessibilityLabel={t('terms.accept')}
                    className="py-3 items-center active:opacity-80"
                    disabled={isSubmitting}
                    onPress={handleAccept}
                  >
                    {isSubmitting ? (
                      <TwView className="flex-row items-center gap-2">
                        <ActivityIndicator size="small" color="#ffffff" />
                        <ThemedText
                          themeColor="background"
                          className="text-white font-extrabold text-sm"
                        >
                          {t('terms.accepting')}
                        </ThemedText>
                      </TwView>
                    ) : (
                      <ThemedText
                        themeColor="background"
                        className="text-white font-extrabold text-sm"
                      >
                        {t('terms.accept')}
                      </ThemedText>
                    )}
                  </TwPressable>
                </TwView>
              </TwView>
            </TwView>
          )}
        </SafeAreaView>
      </TwView>
    </ModalPrimitive>
  );
}
