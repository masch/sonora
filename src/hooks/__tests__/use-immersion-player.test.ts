import { renderHook, act } from '@testing-library/react-hooks';
import { Audio } from 'expo-av';
import { useImmersionPlayer } from '../use-immersion-player';

// ---------------------------------------------------------------------------
// Mock expo-av — native audio module
// ---------------------------------------------------------------------------
const mockSound = {
  playAsync: jest.fn().mockResolvedValue(undefined),
  pauseAsync: jest.fn().mockResolvedValue(undefined),
  stopAsync: jest.fn().mockResolvedValue(undefined),
  unloadAsync: jest.fn().mockResolvedValue(undefined),
  setPositionAsync: jest.fn().mockResolvedValue(undefined),
};

jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    Sound: {
      createAsync: jest.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Mock logger — avoid side effects during tests
// ---------------------------------------------------------------------------
jest.mock('@/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

/** Simulate a loaded AVPlaybackStatus */
function loadedStatus(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    isLoaded: true,
    isPlaying: false,
    didJustFinish: false,
    positionMillis: 0,
    durationMillis: 120_000,
    ...overrides,
  };
}

describe('useImmersionPlayer', () => {
  const audioUri = 'file:///mock/trips/umepay-bosque/audio.mp3';
  let onPlaybackStatusUpdate: (status: Record<string, unknown>) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue(undefined);

    // Wire createAsync to capture the status callback and return a fresh mock sound
    (Audio.Sound.createAsync as jest.Mock).mockImplementation(
      (
        _source: unknown,
        _initialStatus: unknown,
        callback?: (status: Record<string, unknown>) => void,
      ) => {
        if (callback) onPlaybackStatusUpdate = callback;
        return Promise.resolve({ sound: mockSound });
      },
    );
  });

  // ── Initial state ──────────────────────────────────────────────────

  it('should initialize with idle state when URI is null', () => {
    const { result } = renderHook(() => useImmersionPlayer(null));

    expect(result.current.status).toBe('idle');
    expect(result.current.positionMs).toBe(0);
    expect(result.current.durationMs).toBe(0);
    expect(result.current.errorMsg).toBeNull();
  });

  it('should initialize with idle state when URI is provided (not yet playing)', () => {
    const { result } = renderHook(() => useImmersionPlayer(audioUri));

    expect(result.current.status).toBe('idle');
    expect(result.current.positionMs).toBe(0);
    expect(result.current.durationMs).toBe(0);
    expect(result.current.errorMsg).toBeNull();
  });

  it('should return play, pause, stop, seekTo functions', () => {
    const { result } = renderHook(() => useImmersionPlayer(audioUri));

    expect(typeof result.current.play).toBe('function');
    expect(typeof result.current.pause).toBe('function');
    expect(typeof result.current.stop).toBe('function');
    expect(typeof result.current.seekTo).toBe('function');
  });

  // ── play() ─────────────────────────────────────────────────────────

  it('should configure exclusive audio session and create sound on play()', async () => {
    const { result } = renderHook(() => useImmersionPlayer(audioUri));

    await act(async () => {
      await result.current.play();
    });

    // Must configure exclusive audio focus (shouldDuckAndroid: false)
    expect(Audio.setAudioModeAsync).toHaveBeenCalledWith({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });

    // Must create sound with the given URI, auto-play, and a status callback
    expect(Audio.Sound.createAsync).toHaveBeenCalledWith(
      { uri: audioUri },
      { shouldPlay: true, progressUpdateIntervalMillis: 500 },
      expect.any(Function),
    );

    // State transitions to playing
    expect(result.current.status).toBe('playing');
    expect(result.current.errorMsg).toBeNull();
  });

  it('should do nothing on play() when URI is null', async () => {
    const { result } = renderHook(() => useImmersionPlayer(null));

    await act(async () => {
      await result.current.play();
    });

    expect(Audio.setAudioModeAsync).not.toHaveBeenCalled();
    expect(Audio.Sound.createAsync).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('should reuse the same sound on subsequent play() calls', async () => {
    const { result } = renderHook(() => useImmersionPlayer(audioUri));

    // First play — creates sound via createAsync (shouldPlay: true, so playAsync
    // is not called directly — the native layer handles it)
    await act(async () => {
      await result.current.play();
    });
    expect(Audio.Sound.createAsync).toHaveBeenCalledTimes(1);
    expect(mockSound.playAsync).not.toHaveBeenCalled();

    // Second play — must reuse existing sound and call playAsync directly
    await act(async () => {
      await result.current.play();
    });
    expect(Audio.Sound.createAsync).toHaveBeenCalledTimes(1);
    expect(mockSound.playAsync).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('playing');
  });

  // ── pause() ────────────────────────────────────────────────────────

  it('should pause playback and update status to paused', async () => {
    const { result } = renderHook(() => useImmersionPlayer(audioUri));

    await act(async () => {
      await result.current.play();
    });

    await act(async () => {
      await result.current.pause();
    });

    expect(mockSound.pauseAsync).toHaveBeenCalled();
    expect(result.current.status).toBe('paused');
  });

  it('should do nothing on pause() before play() (no sound loaded)', async () => {
    const { result } = renderHook(() => useImmersionPlayer(audioUri));

    await act(async () => {
      await result.current.pause();
    });

    expect(mockSound.pauseAsync).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  // ── stop() ─────────────────────────────────────────────────────────

  it('should stop, unload sound, and reset state to stopped', async () => {
    const { result } = renderHook(() => useImmersionPlayer(audioUri));

    await act(async () => {
      await result.current.play();
    });

    await act(async () => {
      await result.current.stop();
    });

    expect(mockSound.stopAsync).toHaveBeenCalled();
    expect(mockSound.unloadAsync).toHaveBeenCalled();
    expect(result.current.status).toBe('stopped');
    expect(result.current.positionMs).toBe(0);
    expect(result.current.errorMsg).toBeNull();
  });

  it('should do nothing on stop() before play() (no sound loaded)', async () => {
    const { result } = renderHook(() => useImmersionPlayer(audioUri));

    await act(async () => {
      await result.current.stop();
    });

    expect(mockSound.stopAsync).not.toHaveBeenCalled();
    expect(mockSound.unloadAsync).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  // ── seekTo() ───────────────────────────────────────────────────────

  it('should set sound position to the given milliseconds', async () => {
    const { result } = renderHook(() => useImmersionPlayer(audioUri));

    await act(async () => {
      await result.current.play();
    });

    await act(async () => {
      await result.current.seekTo(30_000);
    });

    expect(mockSound.setPositionAsync).toHaveBeenCalledWith(30_000);
  });

  it('should do nothing on seekTo() before play() (no sound loaded)', async () => {
    const { result } = renderHook(() => useImmersionPlayer(audioUri));

    await act(async () => {
      await result.current.seekTo(30_000);
    });

    expect(mockSound.setPositionAsync).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  // ── Headphone unplug detection ─────────────────────────────────────

  it('should pause when external playback interruption is detected (headphone unplug)', async () => {
    const { result } = renderHook(() => useImmersionPlayer(audioUri));

    await act(async () => {
      await result.current.play();
    });

    // Simulate: playing → externally paused without finishing
    act(() => {
      onPlaybackStatusUpdate(loadedStatus({ isPlaying: false, positionMillis: 15_000 }));
    });

    expect(result.current.status).toBe('paused');
    expect(result.current.positionMs).toBe(15_000);
  });

  it('should NOT pause when playback finishes naturally', async () => {
    const { result } = renderHook(() => useImmersionPlayer(audioUri));

    await act(async () => {
      await result.current.play();
    });

    // Simulate natural finish
    act(() => {
      onPlaybackStatusUpdate(loadedStatus({ didJustFinish: true, positionMillis: 120_000 }));
    });

    // Must be 'stopped' (not paused) on natural finish
    expect(result.current.status).toBe('stopped');
    expect(result.current.positionMs).toBe(0);
  });

  // ── Error handling ─────────────────────────────────────────────────

  it('should set error state from unloaded playback status', async () => {
    const { result } = renderHook(() => useImmersionPlayer(audioUri));

    // Play to establish the status callback
    await act(async () => {
      await result.current.play();
    });

    act(() => {
      onPlaybackStatusUpdate({
        isLoaded: false,
        error: 'Decoder initialization failed',
      });
    });

    expect(result.current.status).toBe('error');
    expect(result.current.errorMsg).toBe('Decoder initialization failed');
  });

  it('should set error state when Audio.Sound.createAsync rejects', async () => {
    (Audio.Sound.createAsync as jest.Mock).mockRejectedValue(new Error('Network request failed'));

    const { result } = renderHook(() => useImmersionPlayer(audioUri));

    await act(async () => {
      await result.current.play();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.errorMsg).toBe('Network request failed');
  });

  // ── URI lifecycle ──────────────────────────────────────────────────

  it('should reset to idle when URI changes from a valid URI to null', () => {
    const { result, rerender } = renderHook<string | null, ReturnType<typeof useImmersionPlayer>>(
      (uri: string | null) => useImmersionPlayer(uri),
      { initialProps: audioUri },
    );

    rerender(null);

    expect(result.current.status).toBe('idle');
    expect(result.current.positionMs).toBe(0);
    expect(result.current.durationMs).toBe(0);
    expect(result.current.errorMsg).toBeNull();
  });

  it('should unload sound on unmount if a sound was loaded', async () => {
    const { result, unmount } = renderHook(() => useImmersionPlayer(audioUri));

    await act(async () => {
      await result.current.play();
    });

    unmount();

    expect(mockSound.unloadAsync).toHaveBeenCalled();
  });
});
