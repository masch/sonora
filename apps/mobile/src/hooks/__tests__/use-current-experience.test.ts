import { renderHook } from '@testing-library/react-native';
import { useCurrentExperience } from '../use-current-experience';
import { useAudioPlayerStore } from '@/store/audio-player-store';

jest.mock('@/store/audio-player-store', () => {
  const actual = jest.requireActual('@/store/audio-player-store');
  return {
    ...actual,
    useAudioPlayerStore: jest.fn(),
  };
});

describe('useCurrentExperience', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns default state when nothing is playing', async () => {
    (useAudioPlayerStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({
        currentUri: null,
        status: 'idle',
        currentMetadata: null,
      }),
    );

    const { result } = await renderHook(() => useCurrentExperience());
    expect(result.current).toEqual({
      experienceId: null,
      status: 'idle',
      isPlaying: false,
      isPaused: false,
      metadata: null,
    });
  });

  it('returns active experience status and metadata when playing', async () => {
    (useAudioPlayerStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({
        currentUri: 'file:///var/mobile/tracks/track-123/audio.mp3',
        status: 'playing',
        currentMetadata: { title: 'Test Track', id: '123' },
      }),
    );

    const { result } = await renderHook(() => useCurrentExperience());
    expect(result.current).toEqual({
      experienceId: '123',
      status: 'playing',
      isPlaying: true,
      isPaused: false,
      metadata: { title: 'Test Track', id: '123' },
    });
  });

  it('normalizes trip ID prefixes', async () => {
    (useAudioPlayerStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({
        currentUri: 'file:///var/mobile/tracks/trip-456/audio.mp3',
        status: 'playing',
        currentMetadata: { title: 'Test Trip', id: '456' },
      }),
    );

    const { result } = await renderHook(() => useCurrentExperience());
    expect(result.current.experienceId).toBe('456');
  });
});
