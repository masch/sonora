import React, { useState } from 'react';
import { Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { TermsResponse } from '@sonora/shared';
import { ThemedText } from '@/components/themed-text';
import { ModalPrimitive } from '@/components/ui/modal-primitive';
import { DEFAULT_TRACK_IMAGE, SONORA_TRACKS_BG } from '@/constants/images';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useAppTranslation } from '@/hooks/use-translation';
import type { TermsBlockingError } from '@/hooks/use-terms-check';
import { TwPressable, TwView, TwScrollView } from '@/tw';
import { TwImage } from '@/tw/image';

export interface TermsModalProps {
  visible: boolean;
  terms: TermsResponse | null;
  error?: string | null;
  blockingError?: TermsBlockingError | null;
  onAccept: () => Promise<boolean> | boolean;
  onRetry: () => Promise<void> | void;
}

function renderMarkdownContent(content: string) {
  const paragraphs = content.split(/\n\n+/);

  return paragraphs.map((para, pIdx) => {
    const trimmed = para.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('# ')) {
      return (
        <ThemedText
          key={pIdx}
          className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-3 leading-snug"
        >
          {trimmed.replace(/^#\s+/, '')}
        </ThemedText>
      );
    }

    if (trimmed.startsWith('## ')) {
      return (
        <ThemedText
          key={pIdx}
          className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2 leading-snug"
        >
          {trimmed.replace(/^##\s+/, '')}
        </ThemedText>
      );
    }

    const lines = trimmed.split('\n');
    return (
      <TwView key={pIdx} className="mb-4 gap-2">
        {lines.map((line, lIdx) => {
          const lineTrimmed = line.trim();
          if (!lineTrimmed) return null;

          const parts = lineTrimmed.split(/(\*\*.*?\*\*)/g);
          return (
            <ThemedText
              key={lIdx}
              className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200"
            >
              {parts.map((part, partIdx) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return (
                    <ThemedText
                      key={partIdx}
                      className="font-bold text-zinc-900 dark:text-zinc-100 text-sm"
                    >
                      {part.slice(2, -2)}
                    </ThemedText>
                  );
                }
                return part;
              })}
            </ThemedText>
          );
        })}
      </TwView>
    );
  });
}

export function TermsModal({
  visible,
  terms,
  error,
  blockingError,
  onAccept,
  onRetry,
}: TermsModalProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cardBg = colors.homeExploreTracksBg + 'F2';

  const handleAccept = async () => {
    setIsSubmitting(true);
    try {
      await onAccept();
      setIsSubmitting(false);
    } catch {
      setIsSubmitting(false);
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <ModalPrimitive visible transparent={false} animationType="fade" dismissable={false}>
      <TwView testID="terms-modal" className="flex-1 bg-background relative overflow-hidden">
        {/* Sonora ambient background */}
        <TwImage
          source={SONORA_TRACKS_BG}
          className="absolute inset-0 w-full h-full"
          contentFit="cover"
          alt=""
        />

        {/* Top Cover Banner */}
        <TwView className="relative w-full h-32 sm:h-44 overflow-hidden bg-zinc-900">
          <TwImage
            source={DEFAULT_TRACK_IMAGE}
            className="w-full h-full"
            contentFit="cover"
            alt=""
          />
          <TwView className="absolute inset-0 bg-black/20" />
        </TwView>

        {/* SafeArea and Main Card */}
        <SafeAreaView edges={['bottom']} style={{ flex: 1, width: '100%', alignItems: 'center' }}>
          <TwView className="flex-1 w-full max-w-2xl px-4 pb-4 -mt-6 z-10 self-center">
            <TwView
              style={{ backgroundColor: cardBg, borderColor: colors.border }}
              className="flex-1 w-full border px-4 py-5 rounded-[28px] shadow-lg backdrop-blur-md justify-between"
            >
              {blockingError ? (
                <TwView
                  testID="terms-offline-view"
                  className="flex-1 justify-center items-center px-4 gap-3 self-center max-w-md"
                >
                  <ThemedText
                    className="text-2xl font-bold text-center mb-1"
                    style={{ color: colors.homeCardText }}
                  >
                    {blockingError.title}
                  </ThemedText>
                  <ThemedText
                    className="text-sm text-center mb-6"
                    style={{ color: colors.homeCardSubtext }}
                  >
                    {blockingError.description}
                  </ThemedText>
                  <TwView className="w-full max-w-xs">
                    <TwView className="bg-emerald-500 rounded-xl overflow-hidden shadow-sm">
                      <TwPressable
                        testID="terms-retry-button"
                        accessibilityLabel={t('terms.retry')}
                        className="py-3.5 items-center active:opacity-80"
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
                <>
                  {/* Card Header */}
                  <TwView className="mb-2 gap-0.5">
                    <ThemedText
                      testID="terms-title"
                      className="text-2xl font-bold leading-tight"
                      style={{ color: colors.homeCardText }}
                    >
                      {terms?.title ?? t('terms.title')}
                    </ThemedText>
                    {terms?.version && (
                      <ThemedText
                        testID="terms-version"
                        className="text-xs font-bold uppercase tracking-wider"
                        style={{ color: colors.homeCardSubtext }}
                      >
                        {t('terms.version', { version: terms.version })}
                      </ThemedText>
                    )}
                  </TwView>

                  {/* Scrollable Terms Text in dark translucent card container */}
                  <TwView
                    className={`card-container flex-1 my-2 p-4 rounded-2xl overflow-hidden ${
                      Platform.OS === 'web' ? 'outline-none' : ''
                    }`}
                  >
                    <TwScrollView
                      testID="terms-content-scroll"
                      className={`flex-1 ${Platform.OS === 'web' ? 'outline-none' : ''}`}
                      showsVerticalScrollIndicator={true}
                    >
                      <TwView testID="terms-content" className="py-1">
                        {terms?.content ? renderMarkdownContent(terms.content) : null}
                      </TwView>
                    </TwScrollView>
                  </TwView>

                  {/* Error Notification */}
                  {error && (
                    <TwView className="my-1.5 p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl">
                      <ThemedText
                        testID="terms-error-message"
                        className="text-red-500 text-xs text-center font-semibold"
                      >
                        {error}
                      </ThemedText>
                    </TwView>
                  )}

                  {/* Emerald Action Button */}
                  <TwView className="w-full self-stretch mt-2">
                    <TwView className="bg-emerald-500 rounded-xl overflow-hidden shadow-sm">
                      <TwPressable
                        testID="terms-accept-button"
                        accessibilityLabel={t('terms.accept')}
                        className="py-3.5 items-center active:opacity-80"
                        disabled={isSubmitting}
                        onPress={handleAccept}
                      >
                        {isSubmitting ? (
                          <TwView className="flex-row items-center gap-2">
                            <ActivityIndicator size="small" color="#ffffff" />
                            <ThemedText
                              themeColor="background"
                              className="text-white font-extrabold text-base"
                            >
                              {t('terms.accepting')}
                            </ThemedText>
                          </TwView>
                        ) : (
                          <ThemedText
                            themeColor="background"
                            className="text-white font-extrabold text-base"
                          >
                            {t('terms.accept')}
                          </ThemedText>
                        )}
                      </TwPressable>
                    </TwView>
                  </TwView>
                </>
              )}
            </TwView>
          </TwView>
        </SafeAreaView>
      </TwView>
    </ModalPrimitive>
  );
}
