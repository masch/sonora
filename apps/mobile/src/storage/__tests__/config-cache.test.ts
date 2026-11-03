import { DEFAULT_REMOTE_CONFIG } from '@sonora/shared';
import AsyncStorage from 'expo-sqlite/kv-store';

// We test the default (native) module resolution since
// jest-expo resolves config-cache → config-cache.ts in Node.
const CONFIG_CACHE_KEY = 'remote-config';

// Helper to reimport config-cache fresh for each test
function importModule() {
  return jest.requireActual('../config-cache') as typeof import('../config-cache');
}

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

const CONFIG_FIXTURE = {
  geofence: {
    trip: { radiusMeters: 100, defaultMode: 'formatDefaultRadius' as const },
    track: { radiusMeters: 100, defaultMode: 'entityRadius' as const },
    bypassGeofence: true,
    bypassIosBrowser: true,
  },
  audio: { rewindOffsetMs: 15000 },
  feedback: { syncIntervalSec: 60 },
  appVersion: { minimumVersion: '0.0.0', blockOlderVersions: false },
  social: { instagramHandle: 'sonora.derivapoetica' },
  map: DEFAULT_REMOTE_CONFIG.map,
};

describe('config-cache', () => {
  describe('setCachedConfig', () => {
    it('stores the config next to the moment it was fetched', async () => {
      const { setCachedConfig } = importModule();
      const before = Date.now();

      await setCachedConfig(CONFIG_FIXTURE);

      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
      const [key, stored] = (AsyncStorage.setItem as jest.Mock).mock.calls[0] as [string, string];
      expect(key).toBe(CONFIG_CACHE_KEY);

      const entry = JSON.parse(stored) as { config: unknown; fetchedAt: number };
      expect(entry.config).toEqual(CONFIG_FIXTURE);
      expect(entry.fetchedAt).toBeGreaterThanOrEqual(before);
      expect(entry.fetchedAt).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('getCachedConfig', () => {
    it('still returns a payload cached by a build that did not stamp it', async () => {
      const config = {
        geofence: {
          trip: { radiusMeters: 75, defaultMode: 'formatDefaultRadius' as const },
          track: { radiusMeters: 75, defaultMode: 'entityRadius' as const },
          bypassGeofence: false,
          bypassIosBrowser: true,
        },
        audio: { rewindOffsetMs: 5000 },
        feedback: { syncIntervalSec: 120 },
        appVersion: { minimumVersion: '0.0.0', blockOlderVersions: false },
        social: { instagramHandle: 'sonora.derivapoetica' },
        map: DEFAULT_REMOTE_CONFIG.map,
      };
      // The bare payload every build before this one wrote at the same key. It
      // still renders instantly; only its age is unknowable.
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(config));

      const { getCachedConfig } = importModule();
      const result = await getCachedConfig();

      expect(result).toEqual(config);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(CONFIG_CACHE_KEY);
    });

    it('returns the payload with the moment it was fetched', async () => {
      const fetchedAt = Date.parse('2026-03-01T10:00:00Z');
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ config: CONFIG_FIXTURE, fetchedAt }),
      );

      const { getCachedConfig } = importModule();
      const result = await getCachedConfig();

      expect(result).toEqual({ config: CONFIG_FIXTURE, fetchedAt });
    });

    it('returns null when cache is empty', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const { getCachedConfig } = importModule();
      const result = await getCachedConfig();

      expect(result).toBeNull();
    });

    it('returns null when cache contains corrupted JSON', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('{bad: json');

      const { getCachedConfig } = importModule();
      const result = await getCachedConfig();

      expect(result).toBeNull();
    });

    it('returns null when getItem throws', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('KV store error'));

      const { getCachedConfig } = importModule();
      const result = await getCachedConfig();

      expect(result).toBeNull();
    });
  });

  describe('clearCachedConfig', () => {
    it('removes the cache key from storage', async () => {
      const { clearCachedConfig } = importModule();

      await clearCachedConfig();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(CONFIG_CACHE_KEY);
    });
  });
});
