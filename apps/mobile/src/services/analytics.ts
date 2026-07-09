import { type Analytics } from 'firebase/analytics';
import { logger } from '@/utils/logger';
import { Platform } from 'react-native';

// Firebase Web SDK instance
let webAnalytics: Analytics | null = null;
let isWebInitialized = false;

function ensureWebInitialized() {
  if (Platform.OS !== 'web') return;
  if (isWebInitialized) return;
  isWebInitialized = true;

  if (typeof window !== 'undefined') {
    try {
      const { initializeApp } = require('firebase/app');
      const { getAnalytics } = require('firebase/analytics');

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
          'Faltan credeciales de Firebase Web. Las analíticas web se imprimirán en consola.',
        );
      }
    } catch (err) {
      logger.warn('Error al inicializar Firebase Web SDK:', err);
    }
  }
}

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

export interface AnalyticsEventMap
  extends
    AppLifecycleEvents,
    AudioDownloadEvents,
    AudioPlaybackEvents,
    GpsLocationEvents,
    SystemEvents,
    TestEvents {}

export const AnalyticsService = {
  trackEvent: <T extends keyof AnalyticsEventMap>(eventName: T, params?: AnalyticsEventMap[T]) => {
    ensureWebInitialized();

    const extendedParams = {
      ...params,
      platform: Platform.OS,
    };

    if (Platform.OS === 'web') {
      if (webAnalytics) {
        try {
          const { logEvent } = require('firebase/analytics');
          logEvent(webAnalytics, eventName, extendedParams);
        } catch (err) {
          logger.warn(`Firebase Web logEvent error for ${eventName}:`, err);
        }
      } else {
        logger.info(`[Analytics Web] Event: ${eventName}`, extendedParams);
      }
      return;
    }

    try {
      const analytics = require('@react-native-firebase/analytics').default;
      analytics().logEvent(eventName, extendedParams);
    } catch (err) {
      logger.warn(`Firebase logEvent error for ${eventName}:`, err);
    }
  },

  recordError: (error: Error, customDescription?: string) => {
    ensureWebInitialized();

    if (Platform.OS === 'web') {
      logger.error('[Web Error]', error, customDescription);
      return;
    }

    try {
      const crashlytics = require('@react-native-firebase/crashlytics').default;
      if (customDescription) {
        crashlytics().setAttribute('custom_description', customDescription);
      }
      crashlytics().recordError(error);
    } catch (err) {
      logger.warn('Firebase Crashlytics recordError error:', err);
    }
  },

  initializeGlobalErrorTracking: () => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.addEventListener('unhandledrejection', (event) => {
          const reason = event.reason;
          AnalyticsService.recordError(
            reason instanceof Error ? reason : new Error(String(reason)),
            'Unhandled web promise rejection',
          );
        });
      }
      return;
    }
  },
};
