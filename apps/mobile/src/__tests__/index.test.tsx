import React from 'react';
import { render } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mock modules required by TrackMap (now rendered in index.tsx)
// ---------------------------------------------------------------------------

jest.mock('expo-audio', () => ({
  useAudioPlayer: jest.fn(),
  useAudioPlayerStatus: jest.fn(() => ({})),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/hooks/use-track-download', () => ({
  useTrackDownload: () => ({
    status: 'idle',
    progress: 0,
    localAudioUri: null,
    errorMsg: null,
    startDownload: jest.fn(),
    deleteTrackLocal: jest.fn(),
  }),
}));

jest.mock('@/hooks/use-immersion-player', () => ({
  useImmersionPlayer: () => ({
    status: 'idle',
    positionMs: 0,
    durationMs: 0,
    errorMsg: null,
    play: jest.fn(),
    pause: jest.fn(),
    stop: jest.fn(),
    seekTo: jest.fn(),
  }),
}));

jest.mock('@/data/experiences', () => ({
  getAllTracks: jest.fn(() => [
    {
      id: 'umepay-bosque',
      title: 'Umepay Bosque Antiguo',
      description: 'A meditative walk through the ancient forest.',
      durationSeconds: 2700,
      startCoordinates: { latitude: -32.212, longitude: -64.738 },
      audioRemoteUrl: 'https://example.com/audio.mp3',
    },
  ]),
}));

const mockPush = jest.fn();
const MockLink = ({ children, testID, ...props }: Record<string, unknown>) =>
  React.createElement(
    'TouchableOpacity',
    { testID, onPress: () => mockPush(props.href as string) },
    children as React.ReactNode,
  );
jest.mock('expo-router', () => ({
  Link: MockLink,
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/hooks/use-translation', () => ({
  useAppTranslation: () => ({ t: (k: string) => k }),
}));

jest.mock('expo-symbols', () => ({
  SymbolView: 'SymbolView',
}));

import HomeScreen, { SHOW_LOCAL_MESSAGES } from '@/app/(tabs)/index';

describe('Home screen (Redesigned)', () => {
  it('renders home layout elements and menu items', async () => {
    const { getByText, getByTestId, queryByText, queryByTestId } = await render(<HomeScreen />);

    expect(getByText('home.title')).toBeTruthy();
    expect(getByText('home.poetic')).toBeTruthy();
    expect(getByText('home.instructionsTitle')).toBeTruthy();
    expect(getByText('home.exploreRoutes')).toBeTruthy();
    expect(getByText('home.exploreTracks')).toBeTruthy();

    expect(getByTestId('home-audio-player')).toBeTruthy();
    expect(getByTestId('explore-routes-menu')).toBeTruthy();
    expect(getByTestId('explore-tracks-menu')).toBeTruthy();

    if (SHOW_LOCAL_MESSAGES) {
      expect(getByText('home.localMessages')).toBeTruthy();
      expect(getByTestId('local-messages-menu')).toBeTruthy();
    } else {
      expect(queryByText('home.localMessages')).toBeNull();
      expect(queryByTestId('local-messages-menu')).toBeNull();
    }
  });

  it('renders without crashing', async () => {
    const { toJSON } = await render(<HomeScreen />);

    expect(toJSON()).not.toBeNull();
  });
});
