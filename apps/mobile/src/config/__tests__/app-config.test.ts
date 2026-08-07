import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { APP_CONFIG, detectHostFromExpo, getApiBaseUrl } from '../app-config';

let mockDebuggerHost: string | null = null;
let mockExtraDomain: string | null = null;

jest.mock('expo-constants', () => ({
  get expoGoConfig() {
    return mockDebuggerHost ? { debuggerHost: mockDebuggerHost } : null;
  },
  get expoConfig() {
    return mockExtraDomain
      ? { extra: { domain: mockExtraDomain, isProduction: true } }
      : { extra: {} };
  },
}));

describe('APP_CONFIG and config helpers', () => {
  const originalEnv = process.env.EXPO_PUBLIC_API_URL;
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    mockDebuggerHost = null;
    mockExtraDomain = null;
    process.env.EXPO_PUBLIC_API_URL = originalEnv;
    Platform.OS = originalPlatformOS;
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_API_URL = originalEnv;
    Platform.OS = originalPlatformOS;
  });

  it('exports valid app environment properties for staging and production', () => {
    expect(typeof APP_CONFIG.isProduction).toBe('boolean');
    expect(['production', 'staging']).toContain(APP_CONFIG.appEnv);
    if (APP_CONFIG.isProduction) {
      expect(APP_CONFIG.appEnv).toBe('production');
    } else {
      expect(APP_CONFIG.appEnv).toBe('staging');
    }
    expect(APP_CONFIG.apiBaseUrl).toBeDefined();
    expect(APP_CONFIG.geofence.trip.radiusMeters).toBeGreaterThan(0);
    expect(APP_CONFIG.geofence.track.radiusMeters).toBeGreaterThan(0);
    expect(APP_CONFIG.geofence.bypassGeofence).toBe(false);
    expect(APP_CONFIG.audio.instructionsUrl).toBeDefined();
    expect(APP_CONFIG.feedback.syncIntervalSec).toBeGreaterThan(0);
  });

  it('evaluates appEnv as production when Constants.expoConfig.extra.isProduction is true', () => {
    mockExtraDomain = 'example.com';
    jest.isolateModules(() => {
      const { APP_CONFIG: isolatedConfig } = jest.requireActual('../app-config');
      expect(isolatedConfig.isProduction).toBe(true);
      expect(isolatedConfig.appEnv).toBe('production');
    });
  });

  it('evaluates appEnv as staging when Constants.expoConfig.extra.isProduction is false', () => {
    mockExtraDomain = null;
    jest.isolateModules(() => {
      const { APP_CONFIG: isolatedConfig } = jest.requireActual('../app-config');
      expect(isolatedConfig.isProduction).toBe(false);
      expect(isolatedConfig.appEnv).toBe('staging');
    });
  });

  describe('geofence.bypassGeofence', () => {
    const originalBypass = process.env.EXPO_PUBLIC_BYPASS_GEOFENCE;

    afterEach(() => {
      process.env.EXPO_PUBLIC_BYPASS_GEOFENCE = originalBypass;
    });

    it('evaluates bypassGeofence as true when EXPO_PUBLIC_BYPASS_GEOFENCE env is true', () => {
      process.env.EXPO_PUBLIC_BYPASS_GEOFENCE = 'true';
      jest.isolateModules(() => {
        const { APP_CONFIG: isolatedConfig } = jest.requireActual('../app-config');
        expect(isolatedConfig.geofence.bypassGeofence).toBe(true);
      });
    });

    it('evaluates bypassGeofence as false when EXPO_PUBLIC_BYPASS_GEOFENCE env is false or undefined', () => {
      process.env.EXPO_PUBLIC_BYPASS_GEOFENCE = 'false';
      jest.isolateModules(() => {
        const { APP_CONFIG: isolatedConfig } = jest.requireActual('../app-config');
        expect(isolatedConfig.geofence.bypassGeofence).toBe(false);
      });
    });
  });

  describe('detectHostFromExpo', () => {
    it('returns null when expoGoConfig is null', () => {
      mockDebuggerHost = null;
      expect(detectHostFromExpo()).toBeNull();
    });

    it('returns host when debuggerHost contains a valid IP', () => {
      mockDebuggerHost = '192.168.1.50:8081';
      expect(detectHostFromExpo()).toBe('192.168.1.50');
    });

    it('returns null for loopback addresses like localhost, 127.0.0.1, or ::1', () => {
      mockDebuggerHost = 'localhost:8081';
      expect(detectHostFromExpo()).toBeNull();

      mockDebuggerHost = '127.0.0.1:8081';
      expect(detectHostFromExpo()).toBeNull();

      mockDebuggerHost = '::1:8081';
      expect(detectHostFromExpo()).toBeNull();
    });

    it('returns null when accessing expoGoConfig throws an error', () => {
      jest.spyOn(Constants, 'expoGoConfig', 'get').mockImplementationOnce(() => {
        throw new Error('Access error');
      });
      expect(detectHostFromExpo()).toBeNull();
    });
  });

  describe('getApiBaseUrl', () => {
    it('returns EXPO_PUBLIC_API_URL when set', () => {
      process.env.EXPO_PUBLIC_API_URL = 'https://custom-api.example.com';
      expect(getApiBaseUrl()).toBe('https://custom-api.example.com');
    });

    it('returns host from Expo when EXPO_PUBLIC_API_URL is not set', () => {
      delete process.env.EXPO_PUBLIC_API_URL;
      mockDebuggerHost = '192.168.1.100:8081';
      expect(getApiBaseUrl()).toBe('http://192.168.1.100:3000');
    });

    it('returns extra domain when available and Expo host is null', () => {
      delete process.env.EXPO_PUBLIC_API_URL;
      mockDebuggerHost = null;
      mockExtraDomain = 'sonora-staging.workers.dev';
      expect(getApiBaseUrl()).toBe('https://sonora-staging.workers.dev');
    });

    it('returns android fallback on android platform', () => {
      delete process.env.EXPO_PUBLIC_API_URL;
      mockDebuggerHost = null;
      mockExtraDomain = null;
      Platform.OS = 'android';
      expect(getApiBaseUrl()).toBe('http://10.0.2.2:3000');
    });

    it('returns localhost fallback on other platforms', () => {
      delete process.env.EXPO_PUBLIC_API_URL;
      mockDebuggerHost = null;
      mockExtraDomain = null;
      Platform.OS = 'ios';
      expect(getApiBaseUrl()).toBe('http://localhost:3000');
    });
  });
});
