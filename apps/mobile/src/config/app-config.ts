import { DEFAULT_REMOTE_CONFIG, INSTRUCTIONS_AUDIO_KEY } from '@sonora/shared';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { SPLASH_ICONS } from '@/constants/images';
import { SPLASH_COLORS } from '@/constants/theme';

/**
 * Extract the machine's local IP from the Expo Go debugger host.
 *
 * When a physical device (or emulator) connects to the dev server,
 * Constants.expoGoConfig.debuggerHost contains the host:port of Metro,
 * e.g. "192.168.1.42:8081" (physical) or "10.0.2.2:8081" (emulator).
 * We extract the host part and re-use it for the API on port 3000.
 */
export function detectHostFromExpo(): string | null {
  try {
    const debuggerHost = Constants.expoGoConfig?.debuggerHost;
    if (!debuggerHost) return null;

    const host = debuggerHost.split(':')[0];
    // Skip loopback addresses — they wouldn't work on a physical device
    if (!host || host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      return null;
    }
    return host;
  } catch {
    return null;
  }
}

export function getApiBaseUrl(): string {
  // 1. Explicit env var wins
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. Auto-detect from Expo's bundler connection
  const host = detectHostFromExpo();
  if (host) {
    return `http://${host}:3000`;
  }

  // 3. Dynamic build-time domain from app.config.ts extra
  const extraDomain = Constants.expoConfig?.extra?.domain;
  if (extraDomain) {
    return `https://${extraDomain}`;
  }

  // 4. Platform fallback
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000'; // emulator → host loopback
  }
  return 'http://localhost:3000'; // web, iOS simulator, etc.
}

const isProduction = Constants.expoConfig?.extra?.isProduction === true;
const appEnv: 'production' | 'staging' = isProduction ? 'production' : 'staging';

/**
 * Sonora Global App Configuration
 */
export const APP_CONFIG = {
  isProduction,
  appEnv,
  splashColor: SPLASH_COLORS[appEnv],
  splashIcon: SPLASH_ICONS[appEnv],
  apiBaseUrl: getApiBaseUrl(),
  audio: {
    /**
     * Duration in milliseconds to rewind the audio player.
     * Default sourced from @sonora/shared — overrideable via GET /api/config.
     */
    rewindOffsetMs: DEFAULT_REMOTE_CONFIG.audio.rewindOffsetMs,
    /**
     * Default instructions audio URL.
     */
    instructionsUrl: `${getApiBaseUrl()}/audio/public/${encodeURIComponent(INSTRUCTIONS_AUDIO_KEY)}`,
  },
  geofence: {
    /**
     * Per-format type-level (fallback) radii in meters the user must be within
     * to start playback. Defaults sourced from @sonora/shared — overrideable via GET /api/config.
     */
    trip: DEFAULT_REMOTE_CONFIG.geofence.trip,
    track: DEFAULT_REMOTE_CONFIG.geofence.track,
    /**
     * Build-time env override to bypass geofence restriction entirely.
     * Default sourced from @sonora/shared — overrideable via GET /api/config.
     */
    bypassGeofence:
      process.env.EXPO_PUBLIC_BYPASS_GEOFENCE === 'true' ||
      DEFAULT_REMOTE_CONFIG.geofence.bypassGeofence,
  },
  feedback: {
    /**
     * Feedback queue sync interval in seconds (used on Web and Mobile background sync).
     * Default sourced from @sonora/shared — overrideable via GET /api/config.
     * Note: iOS caps background execution to a minimum of 15 minutes (900 seconds).
     */
    syncIntervalSec: DEFAULT_REMOTE_CONFIG.feedback.syncIntervalSec,
  },
} as const;
