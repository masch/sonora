import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';

import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { PaymentClient } from '@/services/payment-client';
import { getPurchasedIds, addPurchasedId, getUserEmail, setUserEmail } from '@/storage/app-storage';
import { useAppTranslation } from '@/hooks/use-translation';
import { logger } from '@/utils/logger';

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

  const refresh = useCallback(async () => {
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
  }, [free, price, checkLocalCache, checkRemoteEmail]);

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

  const pay = useCallback(async () => {
    setState((prev) => ({ ...prev, paying: true, error: null }));

    try {
      const result = await PaymentClient.createPayment(experienceId);
      pollingRef.current.purchaseId = result.purchaseId;
      setState((prev) => ({ ...prev, purchaseId: result.purchaseId }));

      // Open checkout URL in browser
      try {
        const browserResult = await WebBrowser.openAuthSessionAsync(
          result.checkoutUrl,
          Linking.createURL('/payment/callback'),
        );

        if (browserResult.type === 'success' || browserResult.type === 'dismiss') {
          // Start polling — the webhook may have already completed or will soon
          startPolling(result.purchaseId);
        }
      } catch {
        // WebBrowser might not be supported on all platforms
        logger.warn('[usePurchase] openAuthSessionAsync failed, falling back to Linking');
        const canOpen = await Linking.canOpenURL(result.checkoutUrl);
        if (canOpen) {
          await Linking.openURL(result.checkoutUrl);
          startPolling(result.purchaseId);
        } else {
          setState((prev) => ({
            ...prev,
            paying: false,
            error: t('payments.error.noBrowser'),
          }));
        }
      }
    } catch {
      logger.error('[usePurchase] Failed to create payment');
      setState((prev) => ({
        ...prev,
        paying: false,
        error: t('payments.error.create'),
      }));
    }
  }, [experienceId, startPolling, t]);

  const restore = useCallback(
    async (email: string): Promise<boolean> => {
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
    },
    [experienceId, t],
  );

  const checkStatus = useCallback(async () => {
    if (state.purchaseId) {
      setState((prev) => ({ ...prev, error: null }));
      startPolling(state.purchaseId);
    }
  }, [state.purchaseId, startPolling]);

  // Listen for deep links from payment redirect (runs once)
  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      const url = event.url;
      if (url && url.includes('/payment/')) {
        const segments = url.split('/');
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
