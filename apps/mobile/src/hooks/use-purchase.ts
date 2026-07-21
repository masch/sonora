import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';

import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useFocusEffect } from 'expo-router';
import { PaymentClient } from '@/services/payment-client';
import { getPurchasedIds, addPurchasedId, getUserEmail, setUserEmail } from '@/storage/app-storage';
import { useAppTranslation } from '@/hooks/use-translation';
import { logger } from '@/utils/logger';
import { AnalyticsService } from '@/services/analytics';
import { APP_CONFIG } from '@/config/app-config';

export type PurchaseStatus = 'loading' | 'free' | 'paid' | 'purchased' | 'error';

export interface PurchaseState {
  status: PurchaseStatus;
  free: boolean;
  price: number | null;
  purchaseId: string | null;
  error: string | null;
  paying: boolean;
  restoring: boolean;
  polling: boolean;
}

export interface PurchaseActions {
  pay: () => Promise<void>;
  restore: (email: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  checkStatus: () => Promise<void>;
}

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 15; // 30 seconds total

export function usePurchase(
  experienceId: string,
  free?: boolean,
  price?: number | null,
): [PurchaseState, PurchaseActions] {
  const { t } = useAppTranslation();
  const [state, setState] = useState<PurchaseState>({
    status: 'loading',
    free: free ?? true,
    price: price ?? null,
    purchaseId: null,
    error: null,
    paying: false,
    restoring: false,
    polling: false,
  });

  const pollingRef = useRef<{
    purchaseId: string;
    attempts: number;
    intervalId: ReturnType<typeof setInterval> | null;
  }>({
    purchaseId: '',
    attempts: 0,
    intervalId: null,
  });

  // Check purchase status on mount
  const checkLocalCache = useCallback(async () => {
    try {
      const purchasedIds = await getPurchasedIds();
      if (purchasedIds.has(experienceId)) {
        setState((prev) => ({ ...prev, status: 'purchased', free: false, error: null }));
        return true;
      }
      return false;
    } catch {
      logger.warn('[usePurchase] Local cache check failed');
      return false;
    }
  }, [experienceId]);

  const checkRemoteEmail = useCallback(async () => {
    try {
      const email = await getUserEmail();
      if (email && !free) {
        const result = await PaymentClient.checkPurchased(experienceId, email);
        if (result.purchased) {
          await addPurchasedId(experienceId);
          setState((prev) => ({ ...prev, status: 'purchased', free: false, error: null }));
          return true;
        }
      }
      return false;
    } catch {
      logger.warn('[usePurchase] Remote email check failed');
      return false;
    }
  }, [experienceId, free]);

  const refresh = async () => {
    setState((prev) => ({ ...prev, status: 'loading', error: null }));

    const isCached = await checkLocalCache();
    if (isCached) return;

    const isRemote = await checkRemoteEmail();
    if (isRemote) return;

    if (free) {
      setState((prev) => ({ ...prev, status: 'free', error: null }));
    } else {
      setState((prev) => ({ ...prev, status: 'paid', price: price ?? null, error: null }));
    }
  };

  const initRef = useRef(false);

  // Initial purchase status check (runs once — initRef prevents re-execution)
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const init = async () => {
      const isCached = await checkLocalCache();
      if (isCached) return;

      const isRemote = await checkRemoteEmail();
      if (isRemote) return;

      setState((prev) => ({
        ...prev,
        status: free ? 'free' : 'paid',
        price: price ?? null,
        error: null,
      }));
    };
    init();
  }, [free, price, checkLocalCache, checkRemoteEmail]);

  // Re-verify purchase status on focus to refresh state when returning from Mercado Pago callback
  useFocusEffect(
    useCallback(() => {
      const recheck = async () => {
        const isCached = await checkLocalCache();
        if (isCached) return;

        const isRemote = await checkRemoteEmail();
        if (isRemote) return;
      };
      recheck();
    }, [checkLocalCache, checkRemoteEmail]),
  );

  const startPolling = useCallback(
    (purchaseId: string) => {
      pollingRef.current = { purchaseId, attempts: 0, intervalId: null };

      setState((prev) => ({ ...prev, polling: true }));

      pollingRef.current.intervalId = setInterval(async () => {
        pollingRef.current.attempts += 1;

        if (pollingRef.current.attempts > POLL_MAX_ATTEMPTS) {
          // Timeout — stop polling
          if (pollingRef.current.intervalId) {
            clearInterval(pollingRef.current.intervalId);
            pollingRef.current.intervalId = null;
          }
          setState((prev) => ({
            ...prev,
            polling: false,
            paying: false,
            error: t('payments.pending'),
          }));
          return;
        }

        try {
          const result = await PaymentClient.getPaymentStatus(purchaseId);
          if (result.status === 'approved') {
            if (pollingRef.current.intervalId) {
              clearInterval(pollingRef.current.intervalId);
              pollingRef.current.intervalId = null;
            }
            await addPurchasedId(experienceId);
            // Save email from webhook response and log access
            if (result.email) {
              await setUserEmail(result.email);
            }
            PaymentClient.logAccess(experienceId, 'paid', result.email, Platform.OS);
            AnalyticsService.trackEvent('payment_completed', {
              experience_id: experienceId,
              purchase_id: result.purchaseId,
              provider: result.provider,
              amount: result.amount,
            });
            setState((prev) => ({
              ...prev,
              status: 'purchased',
              purchaseId: result.purchaseId,
              polling: false,
              paying: false,
              error: null,
            }));
          } else if (result.status === 'rejected') {
            if (pollingRef.current.intervalId) {
              clearInterval(pollingRef.current.intervalId);
              pollingRef.current.intervalId = null;
            }
            AnalyticsService.trackEvent('payment_failed', {
              experience_id: experienceId,
              purchase_id: result.purchaseId,
              error_msg: 'rejected',
            });
            setState((prev) => ({
              ...prev,
              polling: false,
              paying: false,
              error: t('payments.error.rejected'),
            }));
          }
          // 'pending' → keep polling
        } catch {
          // Network error — keep polling (webhook might still arrive)
          logger.warn('[usePurchase] Polling attempt failed');
        }
      }, POLL_INTERVAL_MS);
    },
    [experienceId, t],
  );

  const pay = async () => {
    setState((prev) => ({ ...prev, paying: true, error: null }));

    try {
      const isWeb = Platform.OS === 'web';

      const domain = new URL(APP_CONFIG.apiBaseUrl).hostname;
      const redirectUrl = isWeb ? Linking.createURL('') : `https://${domain}`;
      const callbackUrl = isWeb
        ? Linking.createURL('/payment/callback')
        : `https://${domain}/payment/callback`;

      const result = await PaymentClient.createPayment(experienceId, redirectUrl);
      pollingRef.current.purchaseId = result.purchaseId;
      setState((prev) => ({ ...prev, purchaseId: result.purchaseId }));

      AnalyticsService.trackEvent('payment_checkout_started', { experience_id: experienceId });

      // Start polling immediately in the background
      startPolling(result.purchaseId);

      // Open checkout URL in browser
      try {
        await WebBrowser.openAuthSessionAsync(result.checkoutUrl, callbackUrl);
      } catch {
        // WebBrowser might not be supported on all platforms
        logger.warn('[usePurchase] openAuthSessionAsync failed, falling back to Linking');
        const canOpen = await Linking.canOpenURL(result.checkoutUrl);
        if (canOpen) {
          await Linking.openURL(result.checkoutUrl);
        } else {
          setState((prev) => ({
            ...prev,
            paying: false,
            error: t('payments.error.noBrowser'),
          }));
        }
      }
    } catch (err) {
      logger.error('[usePurchase] Failed to create payment');
      AnalyticsService.trackEvent('payment_failed', {
        experience_id: experienceId,
        purchase_id: null,
        error_msg: err instanceof Error ? err.message : 'create_payment_failed',
      });
      setState((prev) => ({
        ...prev,
        paying: false,
        error: t('payments.error.create'),
      }));
    }
  };

  const restore = async (email: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, restoring: true, error: null }));

    try {
      const result = await PaymentClient.checkPurchased(experienceId, email);
      if (result.purchased) {
        await setUserEmail(email);
        await addPurchasedId(experienceId);
        PaymentClient.logAccess(experienceId, 'restored', email, Platform.OS);
        setState((prev) => ({
          ...prev,
          status: 'purchased',
          restoring: false,
          error: null,
        }));
        return true;
      } else {
        setState((prev) => ({ ...prev, restoring: false }));
        return false;
      }
    } catch {
      logger.error('[usePurchase] Failed to restore purchases');
      setState((prev) => ({
        ...prev,
        restoring: false,
        error: t('payments.error.restore'),
      }));
      return false;
    }
  };

  const checkStatus = async () => {
    if (state.purchaseId) {
      setState((prev) => ({ ...prev, error: null }));
      startPolling(state.purchaseId);
    }
  };

  // Listen for deep links from payment redirect (runs once)
  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      const url = event.url;
      if (url && url.includes('/payment/')) {
        const urlWithoutQuery = url.split('?')[0];
        const segments = urlWithoutQuery.split('/');
        const purchaseId = segments[segments.length - 1];
        if (purchaseId && pollingRef.current.purchaseId === purchaseId) {
          startPolling(purchaseId);
        }
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [startPolling]);

  return [state, { pay, restore, refresh, checkStatus }];
}
