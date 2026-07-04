import AsyncStorage from 'expo-sqlite/kv-store';

// We test the default (native) module resolution since
// jest-expo resolves translation-cache → translation-cache.ts in Node.
const CACHE_KEY_EN = 'translations:en';
const CACHE_KEY_ES = 'translations:es';

// Helper to reimport translation-cache fresh for each test
function importModule() {
  return require('../translation-cache') as typeof import('../translation-cache');
}

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('translation-cache', () => {
  describe('setCachedTranslations', () => {
    it('stores translations as JSON string under the language key', async () => {
      const { setCachedTranslations } = importModule();
      const translations = { 'common.hello': 'Hello', 'common.goodbye': 'Goodbye' };

      await setCachedTranslations('en', translations);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(CACHE_KEY_EN, JSON.stringify(translations));
    });
  });

  describe('getCachedTranslations', () => {
    it('returns parsed translations when cache exists', async () => {
      const translations = { 'common.hello': 'Hola', 'common.learnMore': 'Más información' };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(translations));

      const { getCachedTranslations } = importModule();
      const result = await getCachedTranslations('es');

      expect(result).toEqual(translations);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(CACHE_KEY_ES);
    });

    it('returns null when cache is empty', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const { getCachedTranslations } = importModule();
      const result = await getCachedTranslations('en');

      expect(result).toBeNull();
    });

    it('returns null when cache contains corrupted JSON', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('{bad: json');

      const { getCachedTranslations } = importModule();
      const result = await getCachedTranslations('en');

      expect(result).toBeNull();
    });

    it('returns null when getItem throws', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('KV store error'));

      const { getCachedTranslations } = importModule();
      const result = await getCachedTranslations('en');

      expect(result).toBeNull();
    });
  });

  describe('clearCachedTranslations', () => {
    it('removes the cache key for the given language from storage', async () => {
      const { clearCachedTranslations } = importModule();

      await clearCachedTranslations('en');

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(CACHE_KEY_EN);
    });
  });

  describe('language isolation', () => {
    it('stores and retrieves per-language caches independently', async () => {
      const { setCachedTranslations, getCachedTranslations, clearCachedTranslations } =
        importModule();

      const enTranslations = { 'common.hello': 'Hello' };
      const esTranslations = { 'common.hello': 'Hola' };

      // Store both
      await setCachedTranslations('en', enTranslations);
      await setCachedTranslations('es', esTranslations);

      // Make getItem return the correct mock per key
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === CACHE_KEY_EN) return Promise.resolve(JSON.stringify(enTranslations));
        if (key === CACHE_KEY_ES) return Promise.resolve(JSON.stringify(esTranslations));
        return Promise.resolve(null);
      });

      const enResult = await getCachedTranslations('en');
      const esResult = await getCachedTranslations('es');

      expect(enResult).toEqual(enTranslations);
      expect(esResult).toEqual(esTranslations);

      // Clear only en
      await clearCachedTranslations('en');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(CACHE_KEY_EN);

      // es should still be retrievable
      const esStillResult = await getCachedTranslations('es');
      expect(esStillResult).toEqual(esTranslations);
    });
  });
});
