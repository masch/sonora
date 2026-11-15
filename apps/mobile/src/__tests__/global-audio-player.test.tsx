import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { GlobalAudioPlayer } from '@/components/global-audio-player';

import { ExperienceAudioMetadata } from '@/store/audio-player-store';
import { useRemoteConfigStore } from '@/store/remote-config-store';

let mockSegments = ['(tabs)', 'index'];
let mockPathname = '/(tabs)/index';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useSegments: () => mockSegments,
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: mockPush,
  }),
  useFocusEffect: jest.fn(),
}));

const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockStop = jest.fn();
const mockRewind = jest.fn();

const mockState = {
  status: 'idle',
  positionMs: 0,
  durationMs: 0,
  currentUri: null as string | null,
  currentMetadata: null as ExperienceAudioMetadata | null,
  play: mockPlay,
  pause: mockPause,
  stop: mockStop,
  rewind: mockRewind,
};

jest.mock('@/store/audio-player-store', () => {
  const actual = jest.requireActual('@/store/audio-player-store');
  return {
    ...actual,
    useAudioPlayerStore: (selector: (state: typeof mockState) => unknown) => selector(mockState),
  };
});

// A real zustand store backing the mocked module, so tests drive it with
// `useRemoteConfigStore.setState` exactly like the app runtime does, and
// `getState()` works for imperative readers (the global player navigation).
jest.mock('@/store/remote-config-store', () => {
  const { create } = jest.requireActual('zustand') as typeof import('zustand');
  return {
    useRemoteConfigStore: create(() => ({
      config: {
        audio: {
          rewindOffsetMs: 10000,
        },
        experiences: {},
      },
      isLoading: false,
      error: null,
    })),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('expo-symbols', () => ({
  SymbolView: 'SymbolView',
}));

describe('GlobalAudioPlayer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSegments = ['(tabs)', 'index'];
    mockPathname = '/(tabs)/index';
    mockState.status = 'idle';
    mockState.positionMs = 0;
    mockState.durationMs = 0;
    mockState.currentUri = null;
    mockState.currentMetadata = null;
  });

  it('renders nothing when state is idle and uri is null', async () => {
    const { queryByTestId } = await render(<GlobalAudioPlayer />);
    expect(queryByTestId('global-audio-player')).toBeNull();
  });

  it('renders mini player when audio is playing', async () => {
    mockState.status = 'playing';
    mockState.currentUri = 'file://some-audio.mp3';
    mockState.currentMetadata = { title: 'Poesia del Rio' };
    mockState.positionMs = 30000;
    mockState.durationMs = 120000;

    const { getByTestId, getByText } = await render(<GlobalAudioPlayer />);

    expect(getByTestId('global-audio-player')).toBeTruthy();
    expect(getByText('Poesia del Rio')).toBeTruthy();

    const progressFill = getByTestId('global-player-progress-bar-fill');
    expect(progressFill.props.style.width).toBe('25%'); // 30s / 120s = 25%
  });

  it('calls pause when playing', async () => {
    mockState.status = 'playing';
    mockState.currentUri = 'file://some-audio.mp3';

    const { getByTestId } = await render(<GlobalAudioPlayer />);

    const playPauseBtn = getByTestId('global-player-play-pause-button');
    await fireEvent.press(playPauseBtn);
    expect(mockPause).toHaveBeenCalledTimes(1);
  });

  it('calls play when paused', async () => {
    mockState.status = 'paused';
    mockState.currentUri = 'file://some-audio.mp3';

    const { getByTestId } = await render(<GlobalAudioPlayer />);

    const playPauseBtn = getByTestId('global-player-play-pause-button');
    await fireEvent.press(playPauseBtn);
    expect(mockPlay).toHaveBeenCalledWith('file://some-audio.mp3');
  });

  it('stops playback and hides on close press', async () => {
    mockState.status = 'playing';
    mockState.currentUri = 'file://some-audio.mp3';

    const { getByTestId } = await render(<GlobalAudioPlayer />);

    const closeBtn = getByTestId('global-player-close-button');
    await fireEvent.press(closeBtn);
    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it('calls rewind with offset on rewind press', async () => {
    mockState.status = 'playing';
    mockState.currentUri = 'file://some-audio.mp3';
    mockState.positionMs = 30000;

    const { getByTestId } = await render(<GlobalAudioPlayer />);

    const rewindBtn = getByTestId('global-player-rewind-button');
    await fireEvent.press(rewindBtn);
    expect(mockRewind).toHaveBeenCalledWith(10000);
  });

  it.each([
    ['/', ['(tabs)']],
    ['/index', ['(tabs)', 'index']],
    ['/(tabs)', ['(tabs)']],
    ['/(tabs)/index', ['(tabs)', 'index']],
  ])(
    'shows when playing instructions on the Home screen with pathname "%s"',
    async (pathname, segments) => {
      mockSegments = segments;
      mockPathname = pathname;
      mockState.status = 'playing';
      mockState.currentUri = 'file://instructions.mp3';

      const { queryByTestId } = await render(<GlobalAudioPlayer />);
      expect(queryByTestId('global-audio-player')).not.toBeNull();
    },
  );

  it('shows when playing instructions on the Home tab screen with a blob URI and metadata id instructions', async () => {
    mockSegments = ['(tabs)', 'index'];
    mockPathname = '/(tabs)/index';
    mockState.status = 'playing';
    mockState.currentUri = 'blob:http://localhost:8081/b279c3d6-f2c0-4b7c-8406-bb5127bbc0e2';
    mockState.currentMetadata = {
      title: 'Instructions',
      id: 'instructions',
    };

    const { queryByTestId } = await render(<GlobalAudioPlayer />);
    expect(queryByTestId('global-audio-player')).not.toBeNull();
  });

  it('hides when on track detail screen and the playing track matches', async () => {
    mockSegments = ['poetics', '[id]'];
    mockPathname = '/poetics/5a9463ce-daba-4756-892e-4dd4cb862309';
    mockState.status = 'playing';
    mockState.currentUri =
      'file:///var/mobile/tracks/5a9463ce-daba-4756-892e-4dd4cb862309/audio.mp3';

    const { queryByTestId } = await render(<GlobalAudioPlayer />);
    expect(queryByTestId('global-audio-player')).toBeNull();
  });

  it('remains visible on track detail screen if a different track is playing', async () => {
    mockSegments = ['poetics', '[id]'];
    mockPathname = '/poetics/5a9463ce-daba-4756-892e-4dd4cb862309';
    mockState.status = 'playing';
    mockState.currentUri = 'file:///var/mobile/tracks/different-track/audio.mp3';

    const { queryByTestId } = await render(<GlobalAudioPlayer />);
    expect(queryByTestId('global-audio-player')).not.toBeNull();
  });

  it('navigates to experience detail screen when title is pressed', async () => {
    mockState.status = 'playing';
    mockState.currentUri =
      'file:///var/mobile/tracks/5a9463ce-daba-4756-892e-4dd4cb862309/audio.mp3';
    mockState.currentMetadata = {
      id: '5a9463ce-daba-4756-892e-4dd4cb862309',
      title: 'Poesia del Rio',
    };

    const { getByTestId } = await render(<GlobalAudioPlayer />);
    const titleBtn = getByTestId('global-player-title-button');
    await fireEvent.press(titleBtn);

    expect(mockPush).toHaveBeenCalledWith(
      '/poetics/5a9463ce-daba-4756-892e-4dd4cb862309?title=Poesia%20del%20Rio',
    );
  });

  it('navigates to the configured route when the current track is a configured instructions slug', async () => {
    useRemoteConfigStore.setState({
      config: {
        audio: { rewindOffsetMs: 10000 },
        experiences: {
          trip: {
            instructions: {
              slug: 'instructions-trip',
              audioUrl: 'https://audio.example.com/instructions-trip.mp3',
              route: '/derivas',
            },
          },
          track: {
            instructions: {
              slug: 'instructions-track',
              audioUrl: 'https://audio.example.com/instructions-track.mp3',
              route: '/poetics',
            },
          },
        },
      },
    } as never);
    mockState.status = 'playing';
    mockState.currentUri = 'file://instructions.mp3';
    mockState.currentMetadata = {
      id: 'instructions-trip',
      title: 'Instructions',
    };

    const { getByTestId } = await render(<GlobalAudioPlayer />);
    const titleBtn = getByTestId('global-player-title-button');
    await fireEvent.press(titleBtn);

    expect(mockPush).toHaveBeenCalledWith('/derivas');

    // The same guard routes each format to its own configured list: a fresh
    // render picks up the track instructions metadata.
    mockState.currentMetadata = {
      id: 'instructions-track',
      title: 'Instructions',
    };
    const trackRender = await render(<GlobalAudioPlayer />);
    await fireEvent.press(trackRender.getByTestId('global-player-title-button'));

    expect(mockPush).toHaveBeenCalledWith('/poetics');
  });

  it('navigates to poetics detail when the slug matches no configured instructions', async () => {
    mockState.status = 'playing';
    mockState.currentUri = 'file://audio.mp3';
    mockState.currentMetadata = {
      slug: 'instructions',
    };

    const { getByTestId } = await render(<GlobalAudioPlayer />);
    const titleBtn = getByTestId('global-player-title-button');
    await fireEvent.press(titleBtn);

    expect(mockPush).toHaveBeenCalledWith('/poetics/instructions');
  });

  it('navigates to poetics detail with slug when id is absent', async () => {
    mockState.status = 'playing';
    mockState.currentUri = 'file://poetry.mp3';
    mockState.currentMetadata = {
      slug: 'poetry-slug',
    };

    const { getByTestId } = await render(<GlobalAudioPlayer />);
    const titleBtn = getByTestId('global-player-title-button');
    await fireEvent.press(titleBtn);

    expect(mockPush).toHaveBeenCalledWith('/poetics/poetry-slug');
  });

  it('does not navigate when targetId cannot be resolved', async () => {
    mockPush.mockClear();
    mockState.status = 'playing';
    mockState.currentUri = 'file://.mp3';
    mockState.currentMetadata = null;

    const { getByTestId } = await render(<GlobalAudioPlayer />);
    const titleBtn = getByTestId('global-player-title-button');
    await fireEvent.press(titleBtn);

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('calculates android bottom offset when on poetics screen on Android', async () => {
    const originalOS = Platform.OS;
    try {
      Platform.OS = 'android';
      mockSegments = ['poetics', 'different-id'];
      mockPathname = '/poetics/different-id';
      mockState.status = 'playing';
      mockState.currentUri = 'file://active-track.mp3';

      const { getByTestId } = await render(<GlobalAudioPlayer />);
      expect(getByTestId('global-audio-player')).not.toBeNull();
    } finally {
      Platform.OS = originalOS;
    }
  });
});
