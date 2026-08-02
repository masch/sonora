import { logger } from '@/utils/logger';
import { Platform, NativeModules } from 'react-native';
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

// Dynamic require: native Firebase modules only available in production/dev builds, not Expo Go
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let firebaseAnalytics: ((...args: any[]) => any) | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let firebaseCrashlytics: ((...args: any[]) => any) | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const analytics = require('@react-native-firebase/analytics');
  firebaseAnalytics = analytics.default || analytics;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crashlytics = require('@react-native-firebase/crashlytics');
  firebaseCrashlytics = crashlytics.default || crashlytics;
} catch {
  // Native Firebase not available (running in Expo Go or web)
}

const isFirebaseAvailable = () => {
  // If RNFBAppModule is not present, native Firebase is not linked/configured in this binary
  return !!NativeModules.RNFBAppModule;
};

export const AnalyticsService = {
  trackEvent: <T extends keyof AnalyticsEventMap>(eventName: T, params?: AnalyticsEventMap[T]) => {
    const extendedParams = {
      ...params,
      platform: Platform.OS,
      app_version: getAppVersion().versionName,
    };

    try {
      if (isFirebaseAvailable() && firebaseAnalytics) {
        firebaseAnalytics().logEvent(eventName, extendedParams);
      } else {
        logger.info(`[Analytics Native - Disabled] Event: ${eventName}`, extendedParams);
      }
    } catch (err) {
      logger.warn(`Firebase logEvent error for ${eventName}:`, err);
    }
  },

  recordError: (error: Error, customDescription?: string) => {
    try {
      if (isFirebaseAvailable() && firebaseCrashlytics) {
        firebaseCrashlytics().setAttribute('app_version', getAppVersion().versionName);
        if (customDescription) {
          firebaseCrashlytics().setAttribute('custom_description', customDescription);
        }
        firebaseCrashlytics().recordError(error);
      } else {
        logger.error('[Native Error - Disabled]', error, customDescription);
      }
    } catch (err) {
      logger.warn('Firebase Crashlytics recordError error:', err);
    }
  },

  initializeGlobalErrorTracking: async () => {
    try {
      const rejectionTracking = await import('promise/setimmediate/rejection-tracking');
      rejectionTracking.enable({
        all: true,
        onUnhandled: (id: unknown, error: unknown) => {
          AnalyticsService.recordError(
            error instanceof Error ? error : new Error(String(error)),
            `Unhandled promise rejection (id: ${String(id)})`,
          );
        },
      });
    } catch (err) {
      logger.warn('Failed to enable global promise rejection tracking:', err);
    }
  },
};
