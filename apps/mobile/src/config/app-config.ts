import { Platform } from 'react-native';

const getApiBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // Local development fallback depending on platform
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }
  return 'http://localhost:3000';
};

/**
 * Sonora Global App Configuration
 */
export const APP_CONFIG = {
  apiBaseUrl: getApiBaseUrl(),
  audio: {
    /**
     * Duration in milliseconds to rewind the audio player.
     */
    rewindOffsetMs: 10000,
  },
  feedback: {
    /**
     * Feedback queue sync interval in seconds (used on Web and Mobile background sync).
     * Note: iOS caps background execution to a minimum of 15 minutes (900 seconds).
     */
    syncIntervalSec: 30,
  },
} as const;
