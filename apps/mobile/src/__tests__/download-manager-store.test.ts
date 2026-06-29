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

    useDownloadManagerStore.getState()._failDownload('track-1', 'Network error');

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
});
