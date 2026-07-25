import { fetchExperiences, fetchThemes } from '@/data/experiences';
import { appStorage as storage } from '@/storage/app-storage';

// Mock storage
let mockStore: Record<string, string> = {};
jest.mock('@/storage/app-storage', () => ({
  appStorage: {
    getItem: jest.fn(async (key: string) => mockStore[key] || null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStore[key] = value;
    }),
    removeItem: jest.fn(async (key: string) => {
      delete mockStore[key];
    }),
  },
  getDeviceId: jest.fn().mockResolvedValue('test-device-id'),
}));

const mockFetch = jest.fn();
Object.assign(globalThis, { fetch: mockFetch });

const mockServerExperiences = [
  { id: '1', format: 'track', title: 'Track 1' },
  { id: '2', format: 'trip', title: 'Trip 2' },
  { id: '3', format: 'article', title: 'Article 3' }, // Should be filtered out
];

describe('fetchExperiences data service', () => {
  beforeEach(() => {
    mockStore = {};
    mockFetch.mockReset();
    jest.clearAllMocks();
  });

  it('should fetch experiences from the API, filter them, and cache them locally when online', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockServerExperiences,
    });

    const result = await fetchExperiences();

    // Verify it only returned trips/tracks
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('2');

    // Verify it called storage.setItem with the filtered list
    expect(storage.setItem).toHaveBeenCalledWith(
      'experiences_list_cache',
      JSON.stringify([
        { id: '1', format: 'track', title: 'Track 1' },
        { id: '2', format: 'trip', title: 'Trip 2' },
      ]),
    );
  });

  it('should fallback to local cache when API fetch fails', async () => {
    // Seed the cache
    const cachedExperiences = [{ id: '1', format: 'track', title: 'Cached Track 1' }];
    mockStore['experiences_list_cache'] = JSON.stringify(cachedExperiences);

    // API fails
    mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));

    const result = await fetchExperiences();

    // Verify fallback to local storage
    expect(result).toEqual(cachedExperiences);
    expect(storage.getItem).toHaveBeenCalledWith('experiences_list_cache');
  });

  it('should fallback to local cache when API returns a non-OK HTTP status (e.g. 500)', async () => {
    const cachedExperiences = [{ id: '2', format: 'trip', title: 'Cached Trip 2' }];
    mockStore['experiences_list_cache'] = JSON.stringify(cachedExperiences);

    // API responds with 500
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const result = await fetchExperiences();
    expect(result).toEqual(cachedExperiences);
  });

  it('should propagate the fetch error if both API fails and cache is empty', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));

    await expect(fetchExperiences()).rejects.toThrow('Network request failed');
  });

  it('should propagate the HTTP error if API returns non-OK and cache is empty', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
    });

    await expect(fetchExperiences()).rejects.toThrow('Failed to fetch experiences');
  });

  it('should still return fetched experiences even if writing to storage fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockServerExperiences,
    });

    // Make storage setItem fail
    (storage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Disk Full'));

    const result = await fetchExperiences();
    expect(result).toHaveLength(2); // Still successfully returns filtered data
  });

  it('should propagate original API error if reading from cache throws an error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    // Make storage getItem fail
    (storage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Database corrupted'));

    await expect(fetchExperiences()).rejects.toThrow('Network error');
  });

  describe('fetchThemes data service', () => {
    const mockServerThemes = [
      { key: 'theme-1', labelKey: 'Theme 1', order: 1 },
      { key: 'theme-2', labelKey: 'Theme 2', order: 2 },
    ];

    it('should fetch themes from the API and cache them locally when online', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockServerThemes,
      });

      const result = await fetchThemes();

      expect(result).toEqual(mockServerThemes);
      expect(storage.setItem).toHaveBeenCalledWith(
        'themes_list_cache',
        JSON.stringify(mockServerThemes),
      );
    });

    it('should fallback to local cache when API fetch fails', async () => {
      const cachedThemes = [{ key: 'cached-theme', labelKey: 'Cached Theme', order: 1 }];
      mockStore['themes_list_cache'] = JSON.stringify(cachedThemes);

      mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));

      const result = await fetchThemes();

      expect(result).toEqual(cachedThemes);
      expect(storage.getItem).toHaveBeenCalledWith('themes_list_cache');
    });

    it('should fallback to local cache when API returns a non-OK HTTP status (e.g. 500)', async () => {
      const cachedThemes = [{ key: 'cached-theme', labelKey: 'Cached Theme', order: 2 }];
      mockStore['themes_list_cache'] = JSON.stringify(cachedThemes);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await fetchThemes();
      expect(result).toEqual(cachedThemes);
    });

    it('should propagate the fetch error if both API fails and cache is empty', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));

      await expect(fetchThemes()).rejects.toThrow('Network request failed');
    });

    it('should propagate the HTTP error if API returns non-OK and cache is empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
      });

      await expect(fetchThemes()).rejects.toThrow('Failed to fetch themes');
    });

    it('should still return fetched themes even if writing to storage fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockServerThemes,
      });

      // Make storage setItem fail
      (storage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Disk Full'));

      const result = await fetchThemes();
      expect(result).toEqual(mockServerThemes);
    });

    it('should propagate original API error if reading from cache throws an error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Make storage getItem fail
      (storage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Database corrupted'));

      await expect(fetchThemes()).rejects.toThrow('Network error');
    });
  });
});
