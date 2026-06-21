import { act, renderHook } from '@testing-library/react-hooks';
import { useImmersionPlayer } from '@/hooks/use-immersion-player';
import { useAudioPlayerStore } from '@/store/audio-player-store';

jest.mock('expo-audio', () => ({
  useAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(),
    replace: jest.fn(),
    remove: jest.fn(),
  })),
  useAudioPlayerStatus: jest.fn(() => ({
    playing: false,
    currentTime: 0,
    duration: 0,
    isBuffering: false,
    isLoaded: false,
    didJustFinish: false,
    timeControlStatus: 'idle',
    error: null,
  })),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(),
    replace: jest.fn(),
    remove: jest.fn(),
  })),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('expo-symbols', () => ({
  SymbolView: 'SymbolView',
}));

describe('useImmersionPlayer (refactored — thin store wrapper)', () => {
  beforeEach(() => {
    useAudioPlayerStore.setState({
      status: 'idle',
      positionMs: 0,
      durationMs: 0,
      errorMsg: null,
      currentUri: null,
      pendingPlayRequest: null,
      _player: null,
    });
  });

  it('returns idle status when localAudioUri is null', () => {
    const { result } = renderHook(() => useImmersionPlayer(null));

    expect(result.current.status).toBe('idle');
    expect(result.current.positionMs).toBe(0);
    expect(result.current.durationMs).toBe(0);
    expect(result.current.errorMsg).toBeNull();
    expect(typeof result.current.play).toBe('function');
    expect(typeof result.current.pause).toBe('function');
    expect(typeof result.current.stop).toBe('function');
    expect(typeof result.current.seekTo).toBe('function');
  });

  it('returns store status when localAudioUri is set', () => {
    useAudioPlayerStore.getState()._syncStatus({
      status: 'playing',
      positionMs: 15000,
      durationMs: 120000,
    });

    const { result } = renderHook(() => useImmersionPlayer('file://audio.mp3'));

    expect(result.current.status).toBe('playing');
    expect(result.current.positionMs).toBe(15000);
    expect(result.current.durationMs).toBe(120000);
  });

  it('forwards idle status from store when URI is set but store is idle', () => {
    const { result } = renderHook(() => useImmersionPlayer('file://audio.mp3'));

    expect(result.current.status).toBe('idle');
  });

  it('play() calls store play with localAudioUri', () => {
    const storePlay = jest.fn();
    const originalPlay = useAudioPlayerStore.getState().play;
    useAudioPlayerStore.setState({ play: storePlay as never });

    const { result } = renderHook(() => useImmersionPlayer('file://audio.mp3'));
    result.current.play();

    expect(storePlay).toHaveBeenCalledWith('file://audio.mp3');

    // Restore inside act to avoid <act(...)> warning on zustand subscriber
    act(() => {
      useAudioPlayerStore.setState({ play: originalPlay as never });
    });
  });

  it('play() does nothing when localAudioUri is null', () => {
    const storePlay = jest.fn();
    const originalPlay = useAudioPlayerStore.getState().play;
    useAudioPlayerStore.setState({ play: storePlay as never });

    const { result } = renderHook(() => useImmersionPlayer(null));
    result.current.play();

    expect(storePlay).not.toHaveBeenCalled();

    act(() => {
      useAudioPlayerStore.setState({ play: originalPlay as never });
    });
  });

  it('pause() delegates to store.pause()', () => {
    const storePause = jest.fn();
    const originalPause = useAudioPlayerStore.getState().pause;
    useAudioPlayerStore.setState({ pause: storePause as never });

    const { result } = renderHook(() => useImmersionPlayer('file://audio.mp3'));
    result.current.pause();

    expect(storePause).toHaveBeenCalledTimes(1);

    act(() => {
      useAudioPlayerStore.setState({ pause: originalPause as never });
    });
  });

  it('stop() delegates to store.stop()', () => {
    const storeStop = jest.fn();
    const originalStop = useAudioPlayerStore.getState().stop;
    useAudioPlayerStore.setState({ stop: storeStop as never });

    const { result } = renderHook(() => useImmersionPlayer('file://audio.mp3'));
    result.current.stop();

    expect(storeStop).toHaveBeenCalledTimes(1);

    act(() => {
      useAudioPlayerStore.setState({ stop: originalStop as never });
    });
  });

  it('seekTo() delegates to store.seekTo()', () => {
    const storeSeekTo = jest.fn();
    const originalSeekTo = useAudioPlayerStore.getState().seekTo;
    useAudioPlayerStore.setState({ seekTo: storeSeekTo as never });

    const { result } = renderHook(() => useImmersionPlayer('file://audio.mp3'));
    result.current.seekTo(30000);

    expect(storeSeekTo).toHaveBeenCalledWith(30000);

    act(() => {
      useAudioPlayerStore.setState({ seekTo: originalSeekTo as never });
    });
  });

  it('returns same interface shape as original ImmersionPlayerState', () => {
    const { result } = renderHook(() => useImmersionPlayer('file://audio.mp3'));

    const keys = Object.keys(result.current).sort();
    expect(keys).toEqual(
      [
        'durationMs',
        'errorMsg',
        'pause',
        'play',
        'positionMs',
        'seekTo',
        'setMediaMetadata',
        'status',
        'stop',
      ].sort(),
    );
    expect(typeof result.current.play).toBe('function');
    expect(typeof result.current.pause).toBe('function');
    expect(typeof result.current.stop).toBe('function');
    expect(typeof result.current.seekTo).toBe('function');
    expect(typeof result.current.setMediaMetadata).toBe('function');
    expect(typeof result.current.status).toBe('string');
    expect(typeof result.current.positionMs).toBe('number');
    expect(typeof result.current.durationMs).toBe('number');
  });
});
