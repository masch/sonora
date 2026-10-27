import { initializeApp } from 'firebase/app';
import { getAnalytics, logEvent, type Analytics } from 'firebase/analytics';

import { logger } from '@/utils/logger';
import { Platform } from 'react-native';
import { getAppVersion } from '@/utils/app-version';
import { errorReference } from '@/utils/error-reference';
import type { AnalyticsEventMap } from './analytics-events';
import type { AnalyticsTracker, ErrorContext } from './analytics.types';

export type {
  AppLifecycleEvents,
  AudioDownloadEvents,
  AudioPlaybackEvents,
  GpsLocationEvents,
  SystemEvents,
  TestEvents,
  PaymentEvents,
  TermsEvents,
  ErrorEvents,
} from './analytics-events';

export type { AnalyticsEventMap, AnalyticsTracker, ErrorContext };

/**
 * Firebase Analytics rejects a parameter value longer than 100 characters, so a
 * message past that limit reaches the dashboard as no message at all. Both
 * string fields are bounded here rather than at the call site.
 */
const ANALYTICS_PARAM_LIMIT = 100;

/** Trims a value to what a standard Analytics property accepts. */
function bounded(value: string): string {
  return value.slice(0, ANALYTICS_PARAM_LIMIT);
}

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

/**
 * Payload for the cross-platform `app_error` event.
 *
 * `error_reference` falls back to the locally derived code when the caller did
 * not send one, so web and native report the same reference for the same crash
 * and the code a walker reads off the screen can be found in the metrics.
 */
function buildAppErrorFields(error: Error, context?: ErrorContext): AnalyticsEventMap['app_error'] {
  const fields: AnalyticsEventMap['app_error'] = {
    error_reference: context?.reference ?? errorReference(error),
    message: bounded(error.message),
    fatal: context?.fatal ?? false,
  };

  if (context?.route) {
    fields.route = bounded(context.route);
  }

  return fields;
}

export const AnalyticsService: AnalyticsTracker = {
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

  recordError: (error: Error, customDescription?: string, context?: ErrorContext) => {
    ensureWebInitialized();

    const fields = buildAppErrorFields(error, context);

    if (webAnalytics) {
      try {
        logEvent(webAnalytics, 'app_error', {
          ...fields,
          platform: Platform.OS,
          app_version: getAppVersion().versionName,
        });
      } catch (err) {
        logger.warn('Firebase Web logEvent error for app_error:', err);
      }
      // Keep the raw error in the console trail the console-only version left.
      logger.error('[Web Error]', error, customDescription);
      return;
    }

    // No SDK credentials: the same fields reach the console fallback so the
    // crash is still greppable by the reference the walker quotes.
    logger.error('[Web Error]', error, customDescription, fields);
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
