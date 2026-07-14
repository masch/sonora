import { DEFAULT_REMOTE_CONFIG } from '@sonora/shared';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Extract the machine's local IP from the Expo Go debugger host.
 *
 * When a physical device (or emulator) connects to the dev server,
 * Constants.expoGoConfig.debuggerHost contains the host:port of Metro,
 * e.g. "192.168.1.42:8081" (physical) or "10.0.2.2:8081" (emulator).
 * We extract the host part and re-use it for the API on port 3000.
 */
function detectHostFromExpo(): string | null {
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

function getApiBaseUrl(): string {
  // 1. Explicit env var wins
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. Auto-detect from Expo's bundler connection
  const host = detectHostFromExpo();
  if (host) {
    return `http://${host}:3000`;
  }

  // 3. Platform fallback
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000'; // emulator → host loopback
  }
  return 'http://localhost:3000'; // web, iOS simulator, etc.
}

const apiClientKey = process.env.EXPO_PUBLIC_API_CLIENT_KEY || 'sonora-client-secret-1234';

/**
 * Sonora Global App Configuration
 */
export const APP_CONFIG = {
  apiBaseUrl: getApiBaseUrl(),
  apiClientKey,
  audio: {
    /**
     * Duration in milliseconds to rewind the audio player.
     * Default sourced from @sonora/shared — overrideable via GET /api/config.
     */
    rewindOffsetMs: DEFAULT_REMOTE_CONFIG.audio.rewindOffsetMs,
    /**
     * Default instructions audio URL.
     */
    instructionsUrl:
      process.env.EXPO_PUBLIC_INSTRUCTIONS_AUDIO_URL ||
      `${getApiBaseUrl()}/audio/stream?key=experiences%2Finstrucciones.mp3&token=${apiClientKey}`,
  },
  geofence: {
    /**
     * Radius in meters the user must be within to start playback.
     * Default sourced from @sonora/shared — overrideable via GET /api/config.
     */
    radiusMeters: DEFAULT_REMOTE_CONFIG.geofence.radiusMeters,
    /**
     * Build-time env override to bypass geofence restriction entirely.
     * Default sourced from @sonora/shared — overrideable via GET /api/config.
     */
    bypassGeofence: process.env.EXPO_PUBLIC_BYPASS_GEOFENCE === 'true',
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
