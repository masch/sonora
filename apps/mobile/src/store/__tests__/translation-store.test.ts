import { ApiClient } from '../../services/api-client';
import { getCachedTranslations, setCachedTranslations } from '../../storage/translation-cache';
import { useTranslationStore } from '../translation-store';

// ── Mocks ──────────────────────────────────────────────────────────

jest.mock('../../storage/translation-cache', () => ({
  getCachedTranslations: jest.fn(),
  setCachedTranslations: jest.fn().mockResolvedValue(undefined),
  clearCachedTranslations: jest.fn(),
}));

jest.mock('../../services/api-client', () => ({
  ApiClient: {
    get: jest.fn(),
  },
}));

const mockApiGet = ApiClient.get as jest.Mock;
const mockGetCachedTranslations = getCachedTranslations as jest.Mock;
const mockSetCachedTranslations = setCachedTranslations as jest.Mock;

const EN_TRANSLATIONS = { 'common.hello': 'Hello', 'common.goodbye': 'Goodbye' };
const ES_TRANSLATIONS = { 'common.hello': 'Hola', 'common.learnMore': 'Más información' };

beforeEach(() => {
  jest.clearAllMocks();
  useTranslationStore.setState({
    overridesByLang: {},
    isLoading: false,
    error: null,
  });
  mockGetCachedTranslations.mockResolvedValue(null);
  mockApiGet.mockResolvedValue({});
});

// ── Store integration ──────────────────────────────────────────────

describe('TranslationStore', () => {
  it('initialises with empty overrides and no error', () => {
    const state = useTranslationStore.getState();
    expect(state.overridesByLang).toEqual({});
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('init() is non-blocking and returns immediately', async () => {
    mockApiGet.mockResolvedValue(EN_TRANSLATIONS);

    const result = useTranslationStore.getState().init();
    // init() should return immediately (Promise resolves after async work, but
    // the function body should not await the full chain synchronously)
    expect(result).toBeUndefined();

    // Let async work settle
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
  });

  describe('fetchLanguage', () => {
    it('reads cache first, then fetches API, replacing cache with API values', async () => {
      mockGetCachedTranslations.mockResolvedValue(EN_TRANSLATIONS);
      mockApiGet.mockResolvedValue({ 'common.hello': 'Hey' });

      await useTranslationStore.getState().fetchLanguage('en');

      // Cache was read
      expect(mockGetCachedTranslations).toHaveBeenCalledWith('en');

      // API was called with AbortSignal
      expect(mockApiGet).toHaveBeenCalledWith(
        '/api/translations/en',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );

      // Final state: API values replace cache (API is source of truth)
      const state = useTranslationStore.getState();
      expect(state.overridesByLang.en).toEqual({
        'common.hello': 'Hey',
      });
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();

      // Result was cached
      expect(mockSetCachedTranslations).toHaveBeenCalledWith('en', {
        'common.hello': 'Hey',
      });
    });

    it('fetches and caches translations by language when no cache exists', async () => {
      mockApiGet.mockResolvedValue(EN_TRANSLATIONS);

      await useTranslationStore.getState().fetchLanguage('en');

      expect(mockApiGet).toHaveBeenCalledWith(
        '/api/translations/en',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      // Merged result should be cached
      expect(mockSetCachedTranslations).toHaveBeenCalledWith('en', EN_TRANSLATIONS);
      const state = useTranslationStore.getState();
      expect(state.overridesByLang.en).toEqual(EN_TRANSLATIONS);
    });

    it('silently discards invalid remote entries that fail TranslationEntrySchema', async () => {
      mockApiGet.mockResolvedValue({
        'common.valid': 'Valid value',
        '': 'Empty key',
        'common.invalidValue': 123,
      });

      await useTranslationStore.getState().fetchLanguage('en');

      // Only valid entries should appear
      const state = useTranslationStore.getState();
      expect(state.overridesByLang.en).toEqual({
        'common.valid': 'Valid value',
      });
    });

    it('handles network failure with no cache — silent fallback, no error surfaced', async () => {
      mockApiGet.mockRejectedValue(new Error('Network Error'));

      await useTranslationStore.getState().fetchLanguage('en');

      const state = useTranslationStore.getState();
      expect(state.overridesByLang).toEqual({});
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it('handles network failure with cache — keeps cache, no error surfaced', async () => {
      mockGetCachedTranslations.mockResolvedValue(EN_TRANSLATIONS);
      mockApiGet.mockRejectedValue(new Error('Offline'));

      await useTranslationStore.getState().fetchLanguage('en');

      const state = useTranslationStore.getState();
      expect(state.overridesByLang.en).toEqual(EN_TRANSLATIONS);
      expect(state.error).toBeNull();
    });

    it('passes an AbortSignal to ApiClient.get for timeout control', async () => {
      let capturedSignal: AbortSignal | undefined;
      mockApiGet.mockImplementation((_path: string, options?: { signal?: AbortSignal }) => {
        capturedSignal = options?.signal;
        return Promise.reject(new Error('ignore'));
      });

      await useTranslationStore.getState().fetchLanguage('en');

      expect(capturedSignal).toBeDefined();
      expect(capturedSignal!.aborted).toBe(false);
      expect(capturedSignal!.constructor.name).toBe('AbortSignal');
    });

    it('handles timeout (AbortError) gracefully — keeps cache, no error', async () => {
      mockGetCachedTranslations.mockResolvedValue(EN_TRANSLATIONS);
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockApiGet.mockRejectedValue(abortError);

      await useTranslationStore.getState().fetchLanguage('en');

      const state = useTranslationStore.getState();
      expect(state.overridesByLang.en).toEqual(EN_TRANSLATIONS);
      expect(state.error).toBeNull();
    });

    it('merges multiple language calls independently', async () => {
      mockApiGet.mockImplementation((path: string) => {
        if (path === '/api/translations/en') return Promise.resolve(EN_TRANSLATIONS);
        if (path === '/api/translations/es') return Promise.resolve(ES_TRANSLATIONS);
        return Promise.resolve({});
      });

      await useTranslationStore.getState().fetchLanguage('en');
      await useTranslationStore.getState().fetchLanguage('es');

      const state = useTranslationStore.getState();
      expect(state.overridesByLang.en).toEqual(EN_TRANSLATIONS);
      expect(state.overridesByLang.es).toEqual(ES_TRANSLATIONS);
    });
  });
});
