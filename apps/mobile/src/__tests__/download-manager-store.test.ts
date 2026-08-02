import { useDownloadManagerStore } from '@/store/download-manager-store';

// Mock expo-file-system/legacy for the static import in the store
const mockDownloadAsync = jest.fn(() => Promise.resolve({ uri: '/mock/path/audio.mp3' }));
const mockCreateDownloadResumable = jest.fn(() => ({
  downloadAsync: mockDownloadAsync,
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/mock-documents/',
  createDownloadResumable: mockCreateDownloadResumable,
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: false })),
  makeDirectoryAsync: jest.fn(() => Promise.resolve()),
  deleteAsync: jest.fn(() => Promise.resolve()),
}));

describe('DownloadManagerStore', () => {
  beforeEach(() => {
    useDownloadManagerStore.setState({
      downloads: {},
      queue: [],
      activeCount: 0,
    });
    jest.clearAllMocks();
  });

  it('enqueue starts download immediately when no active downloads', () => {
    useDownloadManagerStore
      .getState()
      .enqueue('track-1', 'https://example.com/audio.mp3', 'Track 1');

    const state = useDownloadManagerStore.getState();
    expect(state.downloads['track-1'].status).toBe('downloading');
    expect(state.downloads['track-1'].title).toBe('Track 1');
    expect(state.activeCount).toBe(1);
  });

  it('enqueue queues when 3 are active', () => {
    useDownloadManagerStore.getState().enqueue('track-1', 'url-1', 'Track 1');
    useDownloadManagerStore.getState().enqueue('track-2', 'url-2', 'Track 2');
    useDownloadManagerStore.getState().enqueue('track-3', 'url-3', 'Track 3');

    useDownloadManagerStore.getState().enqueue('track-4', 'url-4', 'Track 4');

    const state = useDownloadManagerStore.getState();
    expect(state.activeCount).toBe(3);
    expect(state.downloads['track-4'].status).toBe('queued');
    expect(state.downloads['track-4'].title).toBe('Track 4');
    expect(state.queue).toHaveLength(1);
    expect(state.queue[0].trackId).toBe('track-4');
  });

  it('on completion, dequeues next FIFO', () => {
    useDownloadManagerStore.getState().enqueue('track-1', 'url-1', 'Track 1');
    useDownloadManagerStore.getState().enqueue('track-2', 'url-2', 'Track 2');
    useDownloadManagerStore.getState().enqueue('track-3', 'url-3', 'Track 3');
    useDownloadManagerStore.getState().enqueue('track-4', 'url-4', 'Track 4');

    expect(useDownloadManagerStore.getState().activeCount).toBe(3);
    expect(useDownloadManagerStore.getState().queue).toHaveLength(1);

    useDownloadManagerStore.getState()._completeDownload('track-1', '/path/to/file.mp3');

    const state = useDownloadManagerStore.getState();
    expect(state.downloads['track-1'].status).toBe('completed');
    expect(state.downloads['track-1'].localUri).toBe('/path/to/file.mp3');
    expect(state.activeCount).toBe(3);
    expect(state.queue).toHaveLength(0);
    expect(state.downloads['track-4'].status).toBe('downloading');
  });

  it('dequeues after failure', () => {
    useDownloadManagerStore.getState().enqueue('track-1', 'url-1', 'Track 1');
    useDownloadManagerStore.getState().enqueue('track-2', 'url-2', 'Track 2');
    useDownloadManagerStore.getState().enqueue('track-3', 'url-3', 'Track 3');
    useDownloadManagerStore.getState().enqueue('track-4', 'url-4', 'Track 4');

    useDownloadManagerStore.getState()._failDownload('track-1', {
      key: 'errors.downloadFailed',
    });

    const state = useDownloadManagerStore.getState();
    expect(state.downloads['track-1'].status).toBe('error');
    expect(state.activeCount).toBe(3);
    expect(state.downloads['track-4'].status).toBe('downloading');
  });

  it('status progression: queued, downloading, completed', () => {
    useDownloadManagerStore.getState().enqueue('track-1', 'url-1', 'Track 1');
    useDownloadManagerStore.getState().enqueue('track-2', 'url-2', 'Track 2');
    useDownloadManagerStore.getState().enqueue('track-3', 'url-3', 'Track 3');

    useDownloadManagerStore.getState().enqueue('track-4', 'url-4', 'Track 4');
    expect(useDownloadManagerStore.getState().downloads['track-4'].status).toBe('queued');

    useDownloadManagerStore.getState()._completeDownload('track-1', '/path/to/file.mp3');
    expect(useDownloadManagerStore.getState().downloads['track-4'].status).toBe('downloading');

    useDownloadManagerStore.getState()._completeDownload('track-4', '/path/to/file2.mp3');
    expect(useDownloadManagerStore.getState().downloads['track-4'].status).toBe('completed');
    expect(useDownloadManagerStore.getState().downloads['track-4'].localUri).toBe(
      '/path/to/file2.mp3',
    );
  });

  it('getDownload returns entry for trackId', () => {
    useDownloadManagerStore.getState().enqueue('track-1', 'url-1', 'Track 1');

    const entry = useDownloadManagerStore.getState().getDownload('track-1');
    expect(entry).toBeDefined();
    expect(entry?.status).toBe('downloading');

    expect(useDownloadManagerStore.getState().getDownload('nonexistent')).toBeUndefined();
  });

  it('cancel removes download and updates active count', () => {
    useDownloadManagerStore.getState().enqueue('track-1', 'url-1', 'Track 1');
    expect(useDownloadManagerStore.getState().activeCount).toBe(1);

    useDownloadManagerStore.getState().cancel('track-1');

    const state = useDownloadManagerStore.getState();
    expect(state.activeCount).toBe(0);
    expect(state.downloads['track-1'].status).toBe('idle');
  });

  it('does not re-enqueue or start download if status is downloading or completed', () => {
    useDownloadManagerStore.getState().enqueue('track-1', 'url-1', 'Track 1');
    expect(useDownloadManagerStore.getState().downloads['track-1'].status).toBe('downloading');

    // Attempting to enqueue again should be ignored
    useDownloadManagerStore.getState().enqueue('track-1', 'url-1', 'Track 1');
    expect(useDownloadManagerStore.getState().activeCount).toBe(1);

    // Complete download
    useDownloadManagerStore.getState()._completeDownload('track-1', '/path/to/file.mp3');
    expect(useDownloadManagerStore.getState().downloads['track-1'].status).toBe('completed');

    // Attempting to enqueue a completed download should be ignored
    useDownloadManagerStore.getState().enqueue('track-1', 'url-1', 'Track 1');
    expect(useDownloadManagerStore.getState().downloads['track-1'].status).toBe('completed');
    expect(useDownloadManagerStore.getState().activeCount).toBe(0);
  });

  it('updates progress only for tracks currently downloading', () => {
    useDownloadManagerStore.getState().enqueue('track-1', 'url-1', 'Track 1');
    useDownloadManagerStore.getState().enqueue('track-2', 'url-2', 'Track 2');

    useDownloadManagerStore.getState()._updateProgress('track-1', 45);
    expect(useDownloadManagerStore.getState().downloads['track-1'].progress).toBe(45);

    // Mock queueing track-3 and track-4 so track-4 is in queue
    useDownloadManagerStore.getState().enqueue('track-3', 'url-3', 'Track 3');
    useDownloadManagerStore.getState().enqueue('track-4', 'url-4', 'Track 4');
    expect(useDownloadManagerStore.getState().downloads['track-4'].status).toBe('queued');

    // Progress update on queued track should be ignored
    useDownloadManagerStore.getState()._updateProgress('track-4', 50);
    expect(useDownloadManagerStore.getState().downloads['track-4'].progress).toBe(0);

    // Progress update on non-existent track should do nothing
    useDownloadManagerStore.getState()._updateProgress('nonexistent', 50);
    expect(useDownloadManagerStore.getState().downloads['nonexistent']).toBeUndefined();
  });

  it('cancel removes a queued download without changing active count', () => {
    useDownloadManagerStore.getState().enqueue('track-1', 'url-1', 'Track 1');
    useDownloadManagerStore.getState().enqueue('track-2', 'url-2', 'Track 2');
    useDownloadManagerStore.getState().enqueue('track-3', 'url-3', 'Track 3');
    useDownloadManagerStore.getState().enqueue('track-4', 'url-4', 'Track 4'); // queued

    expect(useDownloadManagerStore.getState().activeCount).toBe(3);
    expect(useDownloadManagerStore.getState().queue).toHaveLength(1);

    useDownloadManagerStore.getState().cancel('track-4');

    const state = useDownloadManagerStore.getState();
    expect(state.downloads['track-4'].status).toBe('idle');
    expect(state.queue).toHaveLength(0);
    expect(state.activeCount).toBe(3);
  });

  it('cancel does nothing if the track is not enqueued', () => {
    useDownloadManagerStore.getState().cancel('nonexistent');
    expect(useDownloadManagerStore.getState().downloads['nonexistent']).toBeUndefined();
  });

  describe('performWebDownload — Cache API pre-check (offline recovery)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Platform = require('react-native').Platform as { OS: string };
    const originalFetch = globalThis.fetch;
    const originalCaches = (globalThis as Record<string, unknown>).caches;

    beforeEach(() => {
      // Run as web platform so performWebDownload is chosen
      Platform.OS = 'web';
      // URL.createObjectURL is not available in jsdom
      globalThis.URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
    });

    afterEach(() => {
      Platform.OS = 'ios';
      globalThis.fetch = originalFetch;
      (globalThis as Record<string, unknown>).caches = originalCaches;
    });

    it('resolves from Cache API without fetching network when track is already cached', async () => {
      const mockBlob = new Blob(['audio'], { type: 'audio/mpeg' });
      const mockCachedResponse = {
        blob: jest.fn().mockResolvedValue(mockBlob),
        headers: { get: jest.fn().mockReturnValue(null) },
      };
      const mockCache = {
        match: jest.fn().mockResolvedValue(mockCachedResponse),
        put: jest.fn().mockResolvedValue(undefined),
      };
      (globalThis as Record<string, unknown>).caches = {
        open: jest.fn().mockResolvedValue(mockCache),
      };
      globalThis.fetch = jest.fn();

      useDownloadManagerStore
        .getState()
        .enqueue('cached-track', 'https://remote.com/audio.mp3', 'Cached Track');

      // Let the async download complete
      await new Promise((r) => setTimeout(r, 50));

      // Network should NOT have been called
      expect(globalThis.fetch).not.toHaveBeenCalled();
      // Store should be completed
      expect(useDownloadManagerStore.getState().downloads['cached-track'].status).toBe('completed');
    });

    it('falls back to network fetch when Cache API has no entry for the track', async () => {
      const mockCache = {
        match: jest.fn().mockResolvedValue(undefined), // cache miss
        put: jest.fn().mockResolvedValue(undefined),
      };
      (globalThis as Record<string, unknown>).caches = {
        open: jest.fn().mockResolvedValue(mockCache),
      };

      const mockBlob = new Blob(['audio'], { type: 'audio/mpeg' });
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: jest.fn().mockReturnValue(null) },
        body: null, // triggers fallback blob path
        blob: jest.fn().mockResolvedValue(mockBlob),
      } as unknown as Response);

      useDownloadManagerStore
        .getState()
        .enqueue('new-track', 'https://remote.com/audio.mp3', 'New Track');

      await new Promise((r) => setTimeout(r, 50));

      // Fetch was invoked because the cache had no entry
      const [[, options]] = (globalThis.fetch as jest.Mock).mock.calls;
      expect(options.headers.get('X-Device-Id')).toBeTruthy();
    });

    it('falls back to network when Cache API open throws', async () => {
      (globalThis as Record<string, unknown>).caches = {
        open: jest.fn().mockRejectedValue(new Error('Cache API unavailable')),
      };

      const mockBlob = new Blob(['audio'], { type: 'audio/mpeg' });
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: jest.fn().mockReturnValue(null) },
        body: null,
        blob: jest.fn().mockResolvedValue(mockBlob),
      } as unknown as Response);

      useDownloadManagerStore
        .getState()
        .enqueue('error-track', 'https://remote.com/audio.mp3', 'Error Track');

      await new Promise((r) => setTimeout(r, 50));

      const [[, options]] = (globalThis.fetch as jest.Mock).mock.calls;
      expect(options.headers.get('X-Device-Id')).toBeTruthy();
    });
  });
});
