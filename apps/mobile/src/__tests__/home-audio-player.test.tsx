import { HomeAudioPlayer } from '@/components/home-audio-player';
import { fireEvent, render } from '@testing-library/react-native';

const mockStartDownload = jest.fn();
const mockDeleteTrackLocal = jest.fn();
let mockDownloadStatus = 'idle';
let mockDownloadProgress = 0;
let mockLocalAudioUri: string | null = null;

jest.mock('@/hooks/use-track-download', () => ({
  useTrackDownload: () => ({
    status: mockDownloadStatus,
    progress: mockDownloadProgress,
    localAudioUri: mockLocalAudioUri,
    errorMsg: null,
    startDownload: mockStartDownload,
    deleteTrackLocal: mockDeleteTrackLocal,
  }),
}));

const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockStop = jest.fn();
const mockSeekTo = jest.fn();
let mockPlayerStatus = 'idle';
let mockPositionMs = 0;
let mockDurationMs = 0;

jest.mock('@/hooks/use-immersion-player', () => ({
  useImmersionPlayer: () => ({
    status: mockPlayerStatus,
    positionMs: mockPositionMs,
    durationMs: mockDurationMs,
    errorMsg: null,
    play: mockPlay,
    pause: mockPause,
    stop: mockStop,
    seekTo: mockSeekTo,
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'components.mediaControls.statusDownloading') {
        return `Downloading (${options?.value}%)…`;
      }
      return key;
    },
  }),
}));

jest.mock('expo-symbols', () => ({
  SymbolView: 'SymbolView',
}));

const mockRewind = jest.fn();
jest.mock('@/hooks/use-audio-rewind', () => ({
  useAudioRewind: () => mockRewind,
}));

jest.mock('@/hooks/use-instructions-audio', () => ({
  useInstructionsAudio: () => ({
    audioUrl: 'http://fallback-url/audio/stream?key=instructions.mp3&token=fallback',
    trackId: 'instructions',
    loading: false,
    error: null,
  }),
}));

describe('HomeAudioPlayer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDownloadStatus = 'idle';
    mockDownloadProgress = 0;
    mockLocalAudioUri = null;
    mockPlayerStatus = 'idle';
    mockPositionMs = 0;
    mockDurationMs = 0;
  });

  it('renders initial state when undownloaded', async () => {
    const { getByTestId, getByText } = await render(<HomeAudioPlayer />);

    expect(getByTestId('home-audio-player')).toBeTruthy();
    expect(getByText('home.instructionsTitle')).toBeTruthy();
    expect(getByText('home.instructionsName')).toBeTruthy();
    expect(getByText('home.instructionsSubtitle')).toBeTruthy();

    const playBtn = getByTestId('home-audio-player');
    await fireEvent.press(playBtn);
    expect(mockStartDownload).toHaveBeenCalledTimes(1);
  });

  it('renders downloading state with progress', async () => {
    mockDownloadStatus = 'downloading';
    mockDownloadProgress = 45;

    const { getByTestId, getByText } = await render(<HomeAudioPlayer />);

    expect(getByText('Downloading (45%)…')).toBeTruthy();
    const fill = getByTestId('home-player-progress-bar-fill');
    expect(fill.props.style.width).toBe('45%');
  });

  it('renders completed (downloaded) state with player controls', async () => {
    mockDownloadStatus = 'completed';
    mockLocalAudioUri = 'local-file-path.mp3';
    mockPlayerStatus = 'paused';
    mockPositionMs = 30000;
    mockDurationMs = 120000;

    const { getByTestId, getByText } = await render(<HomeAudioPlayer />);

    // Shows current/duration time
    expect(getByText('0:30 / 2:00')).toBeTruthy();

    const progressFill = getByTestId('home-player-progress-bar-fill');
    expect(progressFill.props.style.width).toBe('25%'); // 30000 / 120000 = 25%

    const playBtn = getByTestId('home-audio-player');
    await fireEvent.press(playBtn);
    expect(mockPlay).toHaveBeenCalledTimes(1);

    const rewindBtn = getByTestId('home-player-rewind-button');
    await fireEvent.press(rewindBtn);
    expect(mockRewind).toHaveBeenCalledTimes(1);

    const resetBtn = getByTestId('home-player-reset-button');
    await fireEvent.press(resetBtn);
    expect(mockSeekTo).toHaveBeenLastCalledWith(0);
  });

  it('toggles pause when playing', async () => {
    mockDownloadStatus = 'completed';
    mockLocalAudioUri = 'local-file-path.mp3';
    mockPlayerStatus = 'playing';

    const { getByTestId } = await render(<HomeAudioPlayer />);

    const playBtn = getByTestId('home-audio-player');
    await fireEvent.press(playBtn);
    expect(mockPause).toHaveBeenCalledTimes(1);
  });
});
