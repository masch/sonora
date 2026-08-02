import { initializeApp } from 'firebase/app';
import { getAnalytics, logEvent, type Analytics } from 'firebase/analytics';

import { logger } from '@/utils/logger';
import { Platform } from 'react-native';
import { getAppVersion } from '@/utils/app-version';
import type { AnalyticsEventMap } from './analytics-events';

export type {
  AppLifecycleEvents,
  AudioDownloadEvents,
  AudioPlaybackEvents,
  GpsLocationEvents,
  SystemEvents,
  TestEvents,
  PaymentEvents,
} from './analytics-events';

export type { AnalyticsEventMap };

// Firebase Web SDK instance
let webAnalytics: Analytics | null = null;
let isWebInitialized = false;

function ensureWebInitialized() {
  if (isWebInitialized) return;
  if (typeof window === 'undefined') return;

  try {
    const firebaseConfig = {
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
    };

    if (firebaseConfig.apiKey && firebaseConfig.projectId) {
      const app = initializeApp(firebaseConfig);
      webAnalytics = getAnalytics(app);
    } else {
      logger.warn(
        'Firebase Web credentials are missing. Web analytics will be printed to console.',
      );
    }
    // Mark initialized only on success (or missing-credentials, where retrying
    // would change nothing) so a failed SDK init can be retried on the next call.
    isWebInitialized = true;
  } catch (err) {
    logger.warn('Failed to initialize Firebase Web SDK:', err);
  }
}

export const AnalyticsService = {
  trackEvent: <T extends keyof AnalyticsEventMap>(eventName: T, params?: AnalyticsEventMap[T]) => {
    ensureWebInitialized();

    const extendedParams = {
      ...params,
      platform: Platform.OS,
      app_version: getAppVersion().versionName,
    };

    if (webAnalytics) {
      try {
        logEvent(webAnalytics, eventName, extendedParams);
      } catch (err) {
        logger.warn(`Firebase Web logEvent error for ${eventName}:`, err);
      }
    } else {
      logger.info(`[Analytics Web] Event: ${eventName}`, extendedParams);
    }
  },

  recordError: (error: Error, customDescription?: string) => {
    ensureWebInitialized();
    logger.error('[Web Error]', error, customDescription);
  },

  initializeGlobalErrorTracking: async () => {
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        AnalyticsService.recordError(
          reason instanceof Error ? reason : new Error(String(reason)),
          'Unhandled web promise rejection',
        );
      });
    }
  },
};
