import { renderHook, act } from '@testing-library/react-hooks';
import { useTrackDownload } from '@/hooks/use-track-download';
import { useDownloadManagerStore } from '@/store/download-manager-store';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/mock-documents/',
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: false })),
  makeDirectoryAsync: jest.fn(() => Promise.resolve()),
  deleteAsync: jest.fn(() => Promise.resolve()),
  createDownloadResumable: jest.fn(() => ({
    downloadAsync: jest.fn(() => Promise.resolve({ uri: '/mock/path/audio.mp3' })),
  })),
}));

describe('useTrackDownload (refactored — download store integration)', () => {
  beforeEach(() => {
    useDownloadManagerStore.setState({
      downloads: {},
      queue: [],
      activeCount: 0,
    });
  });

  it('returns idle initial state when trackId is null', () => {
    const { result } = renderHook(() => useTrackDownload(null, null, 'unknown'));

    expect(result.current.status).toBe('idle');
    expect(result.current.progress).toBe(0);
    expect(result.current.localAudioUri).toBeNull();
    expect(result.current.errorMsg).toBeNull();
    expect(typeof result.current.startDownload).toBe('function');
    expect(typeof result.current.deleteTrackLocal).toBe('function');
  });

  it('returns idle when trackId is provided but no store entry exists', () => {
    const { result } = renderHook(() =>
      useTrackDownload('track-1', 'https://example.com/audio.mp3', 'Track 1'),
    );

    expect(result.current.status).toBe('idle');
    expect(result.current.progress).toBe(0);
  });

  it('reflects downloading state from the store entry', () => {
    useDownloadManagerStore.setState({
      downloads: {
        'track-1': {
          status: 'downloading',
          progress: 45,
          localUri: null,
          errorMsg: null,
          title: 'Track 1',
        },
      },
    });

    const { result } = renderHook(() =>
      useTrackDownload('track-1', 'https://example.com/audio.mp3', 'Track 1'),
    );

    expect(result.current.status).toBe('downloading');
    expect(result.current.progress).toBe(45);
  });

  it('reflects completed state from the store entry', () => {
    useDownloadManagerStore.setState({
      downloads: {
        'track-1': {
          status: 'completed',
          progress: 100,
          localUri: '/mock/path/audio.mp3',
          errorMsg: null,
          title: 'Track 1',
        },
      },
    });

    const { result } = renderHook(() =>
      useTrackDownload('track-1', 'https://example.com/audio.mp3', 'Track 1'),
    );

    expect(result.current.status).toBe('completed');
    expect(result.current.progress).toBe(100);
    expect(result.current.localAudioUri).toBe('/mock/path/audio.mp3');
  });

  it('reflects error state from the store entry', () => {
    useDownloadManagerStore.setState({
      downloads: {
        'track-1': {
          status: 'error',
          progress: 0,
          localUri: null,
          errorMsg: 'Network failed',
          title: 'Track 1',
        },
      },
    });

    const { result } = renderHook(() =>
      useTrackDownload('track-1', 'https://example.com/audio.mp3', 'Track 1'),
    );

    expect(result.current.status).toBe('error');
    expect(result.current.errorMsg).toBe('Network failed');
  });

  it('startDownload calls download store enqueue', () => {
    const enqueueSpy = jest
      .spyOn(useDownloadManagerStore.getState(), 'enqueue')
      .mockImplementation(() => {});

    const { result } = renderHook(() =>
      useTrackDownload('track-1', 'https://example.com/audio.mp3', 'Track 1'),
    );

    act(() => {
      result.current.startDownload();
    });

    expect(enqueueSpy).toHaveBeenCalledWith('track-1', 'https://example.com/audio.mp3', 'Track 1');

    enqueueSpy.mockRestore();
  });

  it('reacts to store entry changing from idle to downloading', () => {
    const { result } = renderHook(() =>
      useTrackDownload('track-1', 'https://example.com/audio.mp3', 'Track 1'),
    );

    expect(result.current.status).toBe('idle');

    act(() => {
      useDownloadManagerStore.setState({
        downloads: {
          'track-1': {
            status: 'downloading',
            progress: 10,
            localUri: null,
            errorMsg: null,
            title: 'Track 1',
          },
        },
      });
    });

    expect(result.current.status).toBe('downloading');
    expect(result.current.progress).toBe(10);
  });

  it('returns same interface shape as original TrackDownloadState', () => {
    const { result } = renderHook(() =>
      useTrackDownload('track-1', 'https://example.com/audio.mp3', 'Track 1'),
    );

    const keys = Object.keys(result.current).sort();
    expect(keys).toEqual(
      [
        'deleteTrackLocal',
        'errorMsg',
        'localAudioUri',
        'progress',
        'startDownload',
        'status',
      ].sort(),
    );
    expect(typeof result.current.status).toBe('string');
    expect(typeof result.current.progress).toBe('number');
    expect(typeof result.current.startDownload).toBe('function');
    expect(typeof result.current.deleteTrackLocal).toBe('function');
  });
});
