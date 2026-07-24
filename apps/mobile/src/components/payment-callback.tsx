import { useEffect, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import LoadingView from '@/components/loading-view';
import { ScrollScreenWrapper } from '@/components/screen-wrapper';
import { ThemedText } from '@/components/themed-text';
import { PaymentClient } from '@/services/payment-client';
import { addPurchasedId, setUserEmail } from '@/storage/app-storage';
import { useAppTranslation } from '@/hooks/use-translation';
import { TwPressable, TwView } from '@/tw';
import { logger } from '@/utils/logger';
import { ROUTES } from '@/constants/routes';

interface PaymentCallbackProps {
  status: 'success' | 'failure' | 'pending';
}

export default function PaymentCallback({ status }: PaymentCallbackProps) {
  const { id: purchaseId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useAppTranslation();
  const [processing, setProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function handleCallback() {
      try {
        // Dismiss any web browser session if still open
        if (Platform.OS !== 'web') {
          WebBrowser.dismissBrowser();
        }

        if (!purchaseId) {
          setError(t('payments.error.rejected'));
          setProcessing(false);
          return;
        }

        // Fetch the definitive status from backend
        const result = await PaymentClient.getPaymentStatus(purchaseId);

        if (!active) return;

        // 1. Process status-specific side effects
        switch (result.status) {
          case 'approved':
            await addPurchasedId(result.experienceId);
            if (result.email) {
              await setUserEmail(result.email);
            }
            PaymentClient.logAccess(result.experienceId, 'paid', result.email, Platform.OS);
            break;
          case 'rejected':
            setError(t('payments.error.rejected'));
            setProcessing(false);
            break;
          case 'pending':
          default:
            break;
        }

        // 2. Handle web popup window closure for non-rejected states
        const isWebPopup =
          Platform.OS === 'web' && typeof window !== 'undefined' && !!window.opener;
        if (isWebPopup && result.status !== 'rejected') {
          window.close();
          return;
        }

        // 3. Routing navigation (if not in a popup and not rejected)
        if (result.status !== 'rejected') {
          router.replace(ROUTES.PATH.POETICS_DETAIL(result.experienceId));
        }
      } catch (err) {
        logger.error('[PaymentCallback] Failed to handle payment callback', err);
        if (active) {
          setError(t('payments.error.rejected'));
          setProcessing(false);
        }
      }
    }

    handleCallback();

    return () => {
      active = false;
    };
  }, [status, purchaseId, router, t]);

  if (processing) {
    return (
      <ScrollScreenWrapper withTabBar={false}>
        <Stack.Screen options={{ headerShown: false }} />
        <TwView className="flex-1 justify-center items-center p-6">
          <LoadingView message={t('payments.processing')} />
        </TwView>
      </ScrollScreenWrapper>
    );
  }

  return (
    <ScrollScreenWrapper withTabBar={false}>
      <Stack.Screen options={{ headerShown: false }} />
      <TwView className="flex-1 justify-center items-center p-6 bg-slate-900">
        <TwView className="w-full max-w-sm p-6 bg-slate-800 rounded-2xl border border-slate-700 items-center">
          <ThemedText className="text-xl font-bold text-white text-center mb-4">
            {error ? t('common.somethingWentWrong') : t('payments.success')}
          </ThemedText>
          <ThemedText className="text-slate-300 text-center mb-6">
            {error || t('payments.redirecting')}
          </ThemedText>
          <TwPressable
            className="w-full py-3 bg-indigo-600 rounded-lg active:bg-indigo-700 items-center"
            onPress={() => router.replace('/')}
            accessibilityLabel={t('common.retry')}
            testID="go-home-button"
          >
            <ThemedText className="text-white font-medium">{t('common.retry')}</ThemedText>
          </TwPressable>
        </TwView>
      </TwView>
    </ScrollScreenWrapper>
  );
}
