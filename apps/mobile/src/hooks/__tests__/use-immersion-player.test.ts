import { renderHook, act } from '@testing-library/react-hooks';
import { useImmersionPlayer } from '../use-immersion-player';
import type { PlayerStatus } from '@/store/audio-player-store';

// ---------------------------------------------------------------------------
// Mock the centralized store — the refactored hook is a thin wrapper over it
// ---------------------------------------------------------------------------
let mockStoreState: {
  status: PlayerStatus;
  positionMs: number;
  durationMs: number;
  errorMsg: string | null;
  play: jest.Mock;
  pause: jest.Mock;
  stop: jest.Mock;
  seekTo: jest.Mock;
};

jest.mock('@/store/audio-player-store', () => ({
  useAudioPlayerStore: (selector: (s: typeof mockStoreState) => unknown) =>
    selector(mockStoreState),
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useImmersionPlayer hook (refactored — store wrapper)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreState = {
      status: 'idle',
      positionMs: 0,
      durationMs: 0,
      errorMsg: null,
      play: jest.fn(),
      pause: jest.fn(),
      stop: jest.fn(),
      seekTo: jest.fn(),
    };
  });

  describe('status mapping', () => {
    it('should return idle when uri is null', () => {
      const { result } = renderHook(() => useImmersionPlayer(null));

      expect(result.current.status).toBe('idle');
      expect(result.current.positionMs).toBe(0);
      expect(result.current.durationMs).toBe(0);
      expect(result.current.errorMsg).toBeNull();
    });

    it('should return loading when store status is loading', () => {
      mockStoreState.status = 'loading';

      const { result } = renderHook(() => useImmersionPlayer('file:///audio.mp3'));

      expect(result.current.status).toBe('loading');
    });

    it('should return playing when store status is playing', () => {
      mockStoreState.status = 'playing';
      mockStoreState.positionMs = 5000;
      mockStoreState.durationMs = 120000;

      const { result } = renderHook(() => useImmersionPlayer('file:///audio.mp3'));

      expect(result.current.status).toBe('playing');
    });

    it('should return paused when store status is paused', () => {
      mockStoreState.status = 'paused';
      mockStoreState.positionMs = 30000;

      const { result } = renderHook(() => useImmersionPlayer('file:///audio.mp3'));

      expect(result.current.status).toBe('paused');
    });

    it('should return stopped when store status is stopped', () => {
      mockStoreState.status = 'stopped';

      const { result } = renderHook(() => useImmersionPlayer('file:///audio.mp3'));

      expect(result.current.status).toBe('stopped');
    });

    it('should expose errorMsg from store', () => {
      mockStoreState.status = 'error';
      mockStoreState.errorMsg = 'Playback failed';

      const { result } = renderHook(() => useImmersionPlayer('file:///audio.mp3'));

      expect(result.current.status).toBe('error');
      expect(result.current.errorMsg).toBe('Playback failed');
    });
  });

  describe('play action', () => {
    it('should call store play() with uri when uri is set', () => {
      const { result } = renderHook(() => useImmersionPlayer('file:///audio.mp3'));

      act(() => {
        result.current.play();
      });

      expect(mockStoreState.play).toHaveBeenCalledTimes(1);
      expect(mockStoreState.play).toHaveBeenCalledWith('file:///audio.mp3');
    });

    it('should not call store play() when uri is null', () => {
      const { result } = renderHook(() => useImmersionPlayer(null));

      act(() => {
        result.current.play();
      });

      expect(mockStoreState.play).not.toHaveBeenCalled();
    });
  });

  describe('pause action', () => {
    it('should call store pause()', () => {
      const { result } = renderHook(() => useImmersionPlayer('file:///audio.mp3'));

      act(() => {
        result.current.pause();
      });

      expect(mockStoreState.pause).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop action', () => {
    it('should call store stop()', () => {
      const { result } = renderHook(() => useImmersionPlayer('file:///audio.mp3'));

      act(() => {
        result.current.stop();
      });

      expect(mockStoreState.stop).toHaveBeenCalledTimes(1);
    });
  });

  describe('seekTo action', () => {
    it('should call store seekTo with seconds', () => {
      const { result } = renderHook(() => useImmersionPlayer('file:///audio.mp3'));

      act(() => {
        result.current.seekTo(45000); // 45 seconds in ms
      });

      expect(mockStoreState.seekTo).toHaveBeenCalledWith(45000);
    });
  });
});
