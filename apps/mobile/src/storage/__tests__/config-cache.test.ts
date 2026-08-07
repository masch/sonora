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

describe('config-cache', () => {
  describe('setCachedConfig', () => {
    it('stores config as JSON string under the cache key', async () => {
      const { setCachedConfig } = importModule();
      const config = {
        geofence: {
          trip: { radiusMeters: 100, defaultMode: 'formatDefaultRadius' as const },
          track: { radiusMeters: 100, defaultMode: 'entityRadius' as const },
          bypassGeofence: true,
        },
        audio: { rewindOffsetMs: 15000 },
        feedback: { syncIntervalSec: 60 },
        appVersion: { minimumVersion: '0.0.0', blockOlderVersions: false },
      };

      await setCachedConfig(config);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(CONFIG_CACHE_KEY, JSON.stringify(config));
    });
  });

  describe('getCachedConfig', () => {
    it('returns parsed config when cache exists', async () => {
      const config = {
        geofence: {
          trip: { radiusMeters: 75, defaultMode: 'formatDefaultRadius' as const },
          track: { radiusMeters: 75, defaultMode: 'entityRadius' as const },
          bypassGeofence: false,
        },
        audio: { rewindOffsetMs: 5000 },
        feedback: { syncIntervalSec: 120 },
        appVersion: { minimumVersion: '0.0.0', blockOlderVersions: false },
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(config));

      const { getCachedConfig } = importModule();
      const result = await getCachedConfig();

      expect(result).toEqual(config);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(CONFIG_CACHE_KEY);
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
