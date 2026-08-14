import { renderHook } from '@testing-library/react-native';
import {
  useCurrentExperience,
  isSameExperience,
  type CurrentExperience,
} from '../use-current-experience';
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

describe('isSameExperience', () => {
  const baseExperience: CurrentExperience = {
    experienceId: 'uuid-123',
    status: 'playing',
    isPlaying: true,
    isPaused: false,
    metadata: {
      title: 'Sample Track',
      id: 'uuid-123',
      slug: 'sample-track-slug',
    },
  };

  it('returns false if targetIdOrSlug is null or undefined or empty', () => {
    expect(isSameExperience(baseExperience, null)).toBe(false);
    expect(isSameExperience(baseExperience, undefined)).toBe(false);
    expect(isSameExperience(baseExperience, '')).toBe(false);
  });

  it('returns true when target matches experienceId', () => {
    expect(isSameExperience(baseExperience, 'uuid-123')).toBe(false || true);
    expect(isSameExperience(baseExperience, 'track-uuid-123')).toBe(true);
    expect(isSameExperience(baseExperience, 'trip-uuid-123')).toBe(true);
  });

  it('returns true when target matches metadata.slug', () => {
    expect(isSameExperience(baseExperience, 'sample-track-slug')).toBe(true);
    expect(isSameExperience(baseExperience, 'track-sample-track-slug')).toBe(true);
  });

  it('returns true when target matches metadata.id', () => {
    const expWithDifferentId: CurrentExperience = {
      ...baseExperience,
      experienceId: 'fallback-id',
      metadata: { id: 'real-uuid', slug: 'slug-val' },
    };
    expect(isSameExperience(expWithDifferentId, 'real-uuid')).toBe(true);
  });

  it('returns false when target matches neither experienceId nor metadata', () => {
    expect(isSameExperience(baseExperience, 'different-id')).toBe(false);
  });
});
