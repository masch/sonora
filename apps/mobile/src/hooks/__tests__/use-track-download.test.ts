import { renderHook, act } from '@testing-library/react-hooks';
import * as FileSystem from 'expo-file-system/legacy';
import { useTrackDownload } from '../use-track-download';

// ---------------------------------------------------------------------------
// Mock expo-file-system — the hook still needs it for local file checks and
// deleteTrackLocal, but download orchestration is delegated to the store.
// ---------------------------------------------------------------------------
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock-docs/',
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Mock the download manager store — the hook derives state from it.
//
// Uses `let` (same pattern as the immersion player test) so the jest.mock
// factory can close over the binding without TDZ issues. The mock functions
// read the current value at call time (render), by which time beforeEach has
// initialised it.
// ---------------------------------------------------------------------------
let mockStore: {
  downloads: Record<
    string,
    | { status: string; progress: number; localUri: string | null; errorMsg: string | null }
    | undefined
  >;
  enqueue: jest.Mock;
};

jest.mock('@/store/download-manager-store', () => {
  const hook = (selector: (s: typeof mockStore) => unknown) => selector(mockStore);
  return { useDownloadManagerStore: Object.assign(hook, { getState: () => mockStore }) };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useTrackDownload hook (refactored — store-driven)', () => {
  const trackId = 'umepay-bosque';
  const remoteAudioUrl = 'https://mock.com/audio.mp3';

  beforeEach(() => {
    jest.clearAllMocks();
    mockStore = { downloads: {}, enqueue: jest.fn() };
  });

  it('should initialize with idle status when file does not exist locally', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

    let result: { readonly current: ReturnType<typeof useTrackDownload> };
    await act(async () => {
      const renderResult = renderHook(() => useTrackDownload(trackId, remoteAudioUrl));
      result = renderResult.result;
      await Promise.resolve(); // flush checkLocalFile microtask
    });

    expect(result!.current.status).toBe('idle');
    expect(result!.current.progress).toBe(0);
    expect(result!.current.localAudioUri).toBeNull();
  });

  it('should initialize with completed status if file exists locally', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
      exists: true,
      uri: 'file:///mock-docs/tracks/umepay-bosque/audio.mp3',
    });

    let result: { readonly current: ReturnType<typeof useTrackDownload> };
    await act(async () => {
      const renderResult = renderHook(() => useTrackDownload(trackId, remoteAudioUrl));
      result = renderResult.result;
      await Promise.resolve(); // flush checkLocalFile microtask
    });

    expect(result!.current.status).toBe('completed');
    expect(result!.current.progress).toBe(100);
    expect(result!.current.localAudioUri).toBe('file:///mock-docs/tracks/umepay-bosque/audio.mp3');
  });

  it('should show error status when store entry has error', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
    mockStore.downloads[trackId] = {
      status: 'error',
      progress: 0,
      localUri: null,
      errorMsg: 'errors.insufficientSpace',
    };

    let result: { readonly current: ReturnType<typeof useTrackDownload> };
    await act(async () => {
      const renderResult = renderHook(() => useTrackDownload(trackId, remoteAudioUrl));
      result = renderResult.result;
      await Promise.resolve();
    });

    expect(result!.current.status).toBe('error');
    expect(result!.current.errorMsg).toBe('errors.insufficientSpace');
  });

  it('should show downloading status when store entry is downloading', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
    mockStore.downloads[trackId] = {
      status: 'downloading',
      progress: 45,
      localUri: null,
      errorMsg: null,
    };

    let result: { readonly current: ReturnType<typeof useTrackDownload> };
    await act(async () => {
      const renderResult = renderHook(() => useTrackDownload(trackId, remoteAudioUrl));
      result = renderResult.result;
      await Promise.resolve();
    });

    expect(result!.current.status).toBe('downloading');
    expect(result!.current.progress).toBe(45);
  });

  it('should show completed status when store entry is completed', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
    mockStore.downloads[trackId] = {
      status: 'completed',
      progress: 100,
      localUri: 'file:///mock-docs/tracks/umepay-bosque/audio.mp3',
      errorMsg: null,
    };

    let result: { readonly current: ReturnType<typeof useTrackDownload> };
    await act(async () => {
      const renderResult = renderHook(() => useTrackDownload(trackId, remoteAudioUrl));
      result = renderResult.result;
      await Promise.resolve();
    });

    expect(result!.current.status).toBe('completed');
    expect(result!.current.progress).toBe(100);
    expect(result!.current.localAudioUri).toBe('file:///mock-docs/tracks/umepay-bosque/audio.mp3');
  });

  it('should show idle status when trackId is null', async () => {
    let result: { readonly current: ReturnType<typeof useTrackDownload> };
    await act(async () => {
      const renderResult = renderHook(() => useTrackDownload(null, null));
      result = renderResult.result;
      await Promise.resolve();
    });

    expect(result!.current.status).toBe('idle');
    expect(result!.current.localAudioUri).toBeNull();
  });

  it('startDownload should enqueue via store.getState().enqueue', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

    let result: { readonly current: ReturnType<typeof useTrackDownload> };
    await act(async () => {
      const renderResult = renderHook(() => useTrackDownload(trackId, remoteAudioUrl));
      result = renderResult.result;
      await Promise.resolve();
    });

    act(() => {
      result!.current.startDownload();
    });

    expect(mockStore.enqueue).toHaveBeenCalledTimes(1);
    expect(mockStore.enqueue).toHaveBeenCalledWith(trackId, remoteAudioUrl);
  });

  it('should not enqueue when trackId is null', async () => {
    let result: { readonly current: ReturnType<typeof useTrackDownload> };
    await act(async () => {
      const renderResult = renderHook(() => useTrackDownload(null, null));
      result = renderResult.result;
      await Promise.resolve();
    });

    act(() => {
      result!.current.startDownload();
    });

    expect(mockStore.enqueue).not.toHaveBeenCalled();
  });

  it('deleteTrackLocal should remove the local file', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
      exists: true,
      uri: 'file:///mock-docs/tracks/umepay-bosque/audio.mp3',
    });
    (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

    let result: { readonly current: ReturnType<typeof useTrackDownload> };
    await act(async () => {
      const renderResult = renderHook(() => useTrackDownload(trackId, remoteAudioUrl));
      result = renderResult.result;
      await Promise.resolve(); // flush checkLocalFile — sets cachedLocalUri
    });

    expect(result!.current.status).toBe('completed'); // found local file

    await act(async () => {
      await result!.current.deleteTrackLocal();
    });

    expect(FileSystem.getInfoAsync).toHaveBeenCalledWith(
      'file:///mock-docs/tracks/umepay-bosque/audio.mp3',
    );
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      'file:///mock-docs/tracks/umepay-bosque/audio.mp3',
    );
    expect(result!.current.localAudioUri).toBeNull();
    expect(result!.current.status).toBe('idle');
  });
});
