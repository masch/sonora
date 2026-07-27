import { logger } from '@/utils/logger';
import { Platform, NativeModules } from 'react-native';

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

export interface AppLifecycleEvents {
  app_open: Record<string, never> | undefined;
}

export interface AudioDownloadEvents {
  audio_download_started: { track_id: string; url: string; title: string };
  audio_download_completed: { track_id: string; title: string };
  audio_download_failed: { track_id: string; error_msg: string; title: string };
}

export interface AudioPlaybackEvents {
  audio_playback_started: { track_id: string; uri: string; title: string; resume: boolean };
  audio_playback_paused: { track_id: string; position_ms: number; title: string };
  audio_playback_stopped: { track_id: string; title: string };
  audio_seeked: { track_id: string; position_ms: number; title: string };
  audio_playback_completed: { track_id: string; title: string };
  audio_playback_failed: { track_id: string; error_msg: string; title: string };
}

export interface GpsLocationEvents {
  gps_permission_status: { status: string };
  gps_status_changed: { status: string; accuracy: number | null };
  geofence_entered: { track_id: string; title: string };
  geofence_exited: { track_id: string; title: string };
}

export interface SystemEvents {
  network_status_changed: { is_online: boolean; type: string };
}

export interface TestEvents {
  test_event: { foo: string };
  test_web_event: { foo: string };
}

export interface PaymentEvents {
  payment_checkout_started: { experience_id: string };
  payment_completed: {
    experience_id: string;
    purchase_id: string;
    provider: string;
    amount: number;
  };
  payment_failed: { experience_id: string; purchase_id: string | null; error_msg?: string };
}

export interface AnalyticsEventMap
  extends
    AppLifecycleEvents,
    AudioDownloadEvents,
    AudioPlaybackEvents,
    GpsLocationEvents,
    SystemEvents,
    TestEvents,
    PaymentEvents {}

export const AnalyticsService = {
  trackEvent: <T extends keyof AnalyticsEventMap>(eventName: T, params?: AnalyticsEventMap[T]) => {
    const extendedParams = {
      ...params,
      platform: Platform.OS,
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
      logger.warn('No se pudo habilitar el seguimiento global de promesas rechazadas:', err);
    }
  },
};
