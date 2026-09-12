import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { BottomModal } from '@/components/ui/bottom-modal';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useAppTranslation } from '@/hooks/use-translation';
import { TwPressable, TwTextInput, TwView } from '@/tw';
import { EmailQuerySchema, formatPrice } from '@sonora/shared';
import { useState } from 'react';
import { ActivityIndicator, Platform } from 'react-native';

interface PaymentPromptProps {
  price: number;
  currency?: string;
  onPay: () => void;
  onRestore: (email: string) => Promise<boolean>;
  loading?: boolean;
  error?: string | null;
}

export function PaymentPrompt({
  price,
  currency,
  onPay,
  onRestore,
  loading,
  error,
}: PaymentPromptProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const { isDark } = useColorScheme();
  const [showRestore, setShowRestore] = useState(false);
  const [email, setEmail] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const handleRestore = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    if (!EmailQuerySchema.safeParse({ email: trimmedEmail }).success) {
      setRestoreError(t('payments.restore.invalidEmail'));
      return;
    }

    setRestoring(true);
    setRestoreError(null);
    try {
      const result = await onRestore(trimmedEmail);
      if (result) {
        setShowRestore(false);
        setEmail('');
      } else {
        setRestoreError(t('payments.restore.notFound'));
      }
      setRestoring(false);
    } catch {
      setRestoreError(t('payments.error.restore'));
      setRestoring(false);
    }
  };

  const formattedPrice = formatPrice(price, currency);

  return (
    <>
      {/* Payment prompt card */}
      <TwView className="w-full card-container-solid p-5 rounded-[24px] shadow-md backdrop-blur-md gap-4">
        <ThemedText className="text-base font-extrabold text-center text-zinc-800 dark:text-zinc-100">
          {t('payments.paid.label')}
        </ThemedText>

        <ThemedText className="text-3xl font-black text-center text-emerald-600 dark:text-emerald-400">
          {formattedPrice}
        </ThemedText>

        {error && (
          <ThemedText className="text-xs font-bold text-center text-red-500">{error}</ThemedText>
        )}

        <TwPressable
          accessibilityLabel={t('payments.pay')}
          testID="pay-button"
          className="bg-emerald-500 rounded-xl py-4 items-center justify-center active:opacity-70"
          onPress={onPay}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <ThemedText className="text-white font-extrabold text-base">
              {t('payments.pay')}
            </ThemedText>
          )}
        </TwPressable>

        <TwPressable
          accessibilityLabel={t('payments.restore.link')}
          testID="restore-link-button"
          className="items-center justify-center py-3 px-4 rounded-xl border border-emerald-500/30 dark:border-emerald-400/30 bg-emerald-500/10 dark:bg-emerald-500/15 active:opacity-60 gap-1"
          onPress={() => setShowRestore(true)}
        >
          <ThemedText className="text-xs font-semibold text-center text-zinc-700 dark:text-zinc-300">
            {t('payments.restore.linkQuestion')}
          </ThemedText>
          <TwView className="flex-row items-center justify-center gap-1">
            <ThemedText className="text-xs font-bold text-center text-emerald-600 dark:text-emerald-400">
              {t('payments.restore.linkAction')}
            </ThemedText>
            <Icon
              name="chevronRight"
              size={20}
              weight="bold"
              tintColor={isDark ? '#34d399' : '#059669'}
            />
          </TwView>
        </TwPressable>
      </TwView>

      <BottomModal
        visible={showRestore}
        onDismiss={() => {
          setShowRestore(false);
          setRestoreError(null);
        }}
      >
        <TwView className="p-6 gap-5">
          <ThemedText className="text-xl font-black text-center text-zinc-800 dark:text-zinc-100">
            {t('payments.restore.title')}
          </ThemedText>

          <ThemedText className="text-sm font-semibold text-center text-zinc-600 dark:text-zinc-400">
            {t('payments.restore.description')}
          </ThemedText>

          <TwTextInput
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (restoreError) setRestoreError(null);
            }}
            placeholder={t('payments.restore.emailPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            className={`border rounded-xl px-4 py-3 text-base font-semibold text-text bg-white dark:bg-zinc-800 ${
              restoreError
                ? 'border-red-500 dark:border-red-500'
                : 'border-zinc-300 dark:border-zinc-600'
            } ${Platform.OS === 'web' ? 'outline-none' : ''}`}
            style={{ color: colors.text }}
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel={t('payments.restore.emailPlaceholder')}
            testID="restore-email-input"
          />

          {restoreError && (
            <ThemedText className="text-xs font-bold text-center text-red-500">
              {restoreError}
            </ThemedText>
          )}

          <TwPressable
            accessibilityLabel={t('payments.restore.button')}
            testID="restore-button"
            className="bg-emerald-500 rounded-xl py-4 items-center justify-center active:opacity-70"
            onPress={handleRestore}
            disabled={restoring || !email.trim()}
          >
            {restoring ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <ThemedText className="text-white font-extrabold text-base">
                {t('payments.restore.button')}
              </ThemedText>
            )}
          </TwPressable>

          <TwPressable
            accessibilityLabel={t('common.dismiss')}
            testID="restore-cancel-button"
            className="items-center py-2 active:opacity-70"
            onPress={() => {
              setShowRestore(false);
              setRestoreError(null);
            }}
          >
            <ThemedText themeColor="textSecondary" className="text-sm font-bold">
              {t('common.dismiss')}
            </ThemedText>
          </TwPressable>
        </TwView>
      </BottomModal>
    </>
  );
}
