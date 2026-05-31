import { renderHook, act } from '@testing-library/react-hooks';
import { useImmersionPlayer } from '../use-immersion-player';

// ---------------------------------------------------------------------------
// Mock expo-audio — reactive audio player hooks
// ---------------------------------------------------------------------------
const mockPlayer = {
  play: jest.fn(),
  pause: jest.fn(),
  seekTo: jest.fn(),
};

let mockStatus: {
  playing: boolean;
  currentTime: number;
  duration: number;
  isBuffering: boolean;
  isLoaded: boolean;
  didJustFinish: boolean;
  timeControlStatus: string;
};

jest.mock('expo-audio', () => ({
  useAudioPlayer: jest.fn(() => mockPlayer),
  useAudioPlayerStatus: jest.fn(() => mockStatus),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
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
describe('useImmersionPlayer hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStatus = {
      playing: false,
      currentTime: 0,
      duration: 0,
      isBuffering: false,
      isLoaded: false,
      didJustFinish: false,
      timeControlStatus: 'paused',
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

    it('should return loading when player is buffering', () => {
      mockStatus.isBuffering = true;

      const { result } = renderHook(() => useImmersionPlayer('file:///audio.mp3'));

      expect(result.current.status).toBe('loading');
    });

    it('should return loading when not yet loaded', () => {
      const { result } = renderHook(() => useImmersionPlayer('file:///audio.mp3'));

      expect(result.current.status).toBe('loading');
    });

    it('should return playing when status.playing is true', () => {
      mockStatus.playing = true;
      mockStatus.isLoaded = true;
      mockStatus.currentTime = 5;
      mockStatus.duration = 120;

      const { result } = renderHook(() => useImmersionPlayer('file:///audio.mp3'));

      expect(result.current.status).toBe('playing');
    });

    it('should return paused when timeControlStatus is paused', () => {
      mockStatus.isLoaded = true;
      mockStatus.timeControlStatus = 'paused';
      mockStatus.currentTime = 30;

      const { result } = renderHook(() => useImmersionPlayer('file:///audio.mp3'));

      expect(result.current.status).toBe('paused');
    });

    it('should return stopped when didJustFinish is true', () => {
      mockStatus.isLoaded = true;
      mockStatus.didJustFinish = true;

      const { result } = renderHook(() => useImmersionPlayer('file:///audio.mp3'));

      expect(result.current.status).toBe('stopped');
    });

    it('should convert seconds to milliseconds', () => {
      mockStatus.playing = true;
      mockStatus.isLoaded = true;
      mockStatus.currentTime = 42.5;
      mockStatus.duration = 180;

      const { result } = renderHook(() => useImmersionPlayer('file:///audio.mp3'));

      expect(result.current.positionMs).toBe(42500);
      expect(result.current.durationMs).toBe(180000);
    });
  });

  describe('play action', () => {
    it('should call player.play() when uri is set', () => {
      const { result } = renderHook(() => useImmersionPlayer('file:///audio.mp3'));

      act(() => {
        result.current.play();
      });

      expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    });

    it('should not call player.play() when uri is null', () => {
      const { result } = renderHook(() => useImmersionPlayer(null));

      act(() => {
        result.current.play();
      });

      expect(mockPlayer.play).not.toHaveBeenCalled();
    });
  });

  describe('pause action', () => {
    it('should call player.pause()', () => {
      const { result } = renderHook(() => useImmersionPlayer('file:///audio.mp3'));

      act(() => {
        result.current.pause();
      });

      expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop action', () => {
    it('should pause and seek to 0', () => {
      const { result } = renderHook(() => useImmersionPlayer('file:///audio.mp3'));

      act(() => {
        result.current.stop();
      });

      expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
      expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
    });
  });

  describe('seekTo action', () => {
    it('should call player.seekTo with seconds', () => {
      const { result } = renderHook(() => useImmersionPlayer('file:///audio.mp3'));

      act(() => {
        result.current.seekTo(45000); // 45 seconds in ms
      });

      expect(mockPlayer.seekTo).toHaveBeenCalledWith(45);
    });
  });
});
