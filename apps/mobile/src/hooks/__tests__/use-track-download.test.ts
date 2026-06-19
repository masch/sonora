import { renderHook, act } from '@testing-library/react-hooks';
import * as FileSystem from 'expo-file-system/legacy';
import { useTrackDownload } from '../use-track-download';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock-docs/',
  getInfoAsync: jest.fn(),
  getFreeDiskStorageAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  createDownloadResumable: jest.fn(),
  deleteAsync: jest.fn(),
}));

describe('useTrackDownload hook', () => {
  const trackId = 'umepay-bosque';
  const remoteAudioUrl = 'https://mock.com/audio.mp3';

  beforeEach(() => {
    jest.clearAllMocks();
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

  it('should fail download if disk space is insufficient', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
    // Simulate low disk space (10MB free vs 30MB * 1.5 multiplier required)
    (FileSystem.getFreeDiskStorageAsync as jest.Mock).mockResolvedValue(10 * 1024 * 1024);

    let result: { readonly current: ReturnType<typeof useTrackDownload> };
    await act(async () => {
      const renderResult = renderHook(() => useTrackDownload(trackId, remoteAudioUrl));
      result = renderResult.result;
      await Promise.resolve();
    });

    await act(async () => {
      await result!.current.startDownload();
    });

    expect(result!.current.status).toBe('error');
    expect(result!.current.errorMsg).toContain('errors.insufficientSpace');
  });

  it('should execute full download successfully when space is sufficient', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
    (FileSystem.getFreeDiskStorageAsync as jest.Mock).mockResolvedValue(100 * 1024 * 1024); // 100MB free

    const mockDownloadAsync = jest.fn().mockResolvedValue({
      uri: 'file:///mock-docs/tracks/umepay-bosque/audio.mp3',
    });

    (FileSystem.createDownloadResumable as jest.Mock).mockReturnValue({
      downloadAsync: mockDownloadAsync,
      pauseAsync: jest.fn().mockResolvedValue({}),
    });

    let result: { readonly current: ReturnType<typeof useTrackDownload> };
    await act(async () => {
      const renderResult = renderHook(() => useTrackDownload(trackId, remoteAudioUrl));
      result = renderResult.result;
      await Promise.resolve();
    });

    await act(async () => {
      await result!.current.startDownload();
    });

    expect(result!.current.status).toBe('completed');
    expect(result!.current.progress).toBe(100);
    expect(result!.current.localAudioUri).toBe('file:///mock-docs/tracks/umepay-bosque/audio.mp3');
    expect(FileSystem.makeDirectoryAsync).toHaveBeenCalled();
  });
});
