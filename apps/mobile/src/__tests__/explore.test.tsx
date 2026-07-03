import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { useTranslation } from 'react-i18next';

import ExploreScreen from '@/app/(tabs)/explore';
import { fetchExperiences } from '@/data/experiences';

jest.mock('expo-device', () => ({ isDevice: false }));
jest.mock('@/hooks/use-offline-geofence', () => ({
  useOfflineGeofence: () => ({
    isNearStart: false,
    gpsAccuracy: null,
    gpsStatus: 'initializing',
    distanceMeters: null,
    requiredRadiusMeters: 50,
    errorMsg: null,
  }),
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
  fetchExperiences: jest.fn(() =>
    Promise.resolve([
      {
        id: 'umepay-bosque',
        slug: 'umepay-bosque',
        audioUrl: 'https://example.com/audio.mp3',
        format: 'track',
      },
    ]),
  ),
  isPlayableExperience: (experience: unknown) => {
    const exp = experience as { format?: string };
    return exp?.format === 'track' || exp?.format === 'trip';
  },
}));

const mockMap: Record<string, string> = {
  'index.title': 'Welcome to Expo',
  'index.getStarted': 'get started',
  'index.hints.editing': 'Try editing',
  'index.hints.devtools': 'Dev tools',
  'index.hints.freshStart': 'Fresh start',
  'index.hints.devtoolsWeb': 'use browser devtools',
  'index.hints.devtoolsDevice': 'shake device or press m in terminal',
  'index.hints.devtoolsAndroid': 'press cmd+m (or ctrl+m)',
  'index.hints.devtoolsIos': 'press cmd+d',
  'index.loading': 'Loading…',
  'index.errorLoading': 'Failed to load featured experience.',
  'index.retry': 'Retry',
  'index.empty': 'No experiences available yet.',
};

beforeAll(() => {
  (useTranslation().t as unknown as jest.Mock).mockImplementation((k: string) => mockMap[k] ?? k);
});

describe('Explore screen (now Home content)', () => {
  it('renders the title', async () => {
    const { getByText } = await render(<ExploreScreen />);
    await waitFor(() => {
      expect(getByText('Welcome to Expo')).toBeTruthy();
    });
  });

  it('renders the get started badge', async () => {
    const { getByText } = await render(<ExploreScreen />);
    await waitFor(() => {
      expect(getByText('get started')).toBeTruthy();
    });
  });

  it('renders all HintRow titles', async () => {
    const { getByText } = await render(<ExploreScreen />);
    await waitFor(() => {
      expect(getByText('Try editing')).toBeTruthy();
    });
    expect(getByText('Dev tools')).toBeTruthy();
    expect(getByText('Fresh start')).toBeTruthy();
  });

  it('renders without crashing', async () => {
    const { toJSON } = await render(<ExploreScreen />);
    await waitFor(() => {
      expect(toJSON()).not.toBeNull();
    });
  });

  it('shows empty state when experiences API returns empty', async () => {
    (fetchExperiences as jest.Mock).mockResolvedValueOnce([]);
    const { getByText } = await render(<ExploreScreen />);
    await waitFor(() => {
      expect(getByText('No experiences available yet.')).toBeTruthy();
    });
    // Title still visible in empty state
    expect(getByText('Welcome to Expo')).toBeTruthy();
  });

  it('shows error state when experiences API fails', async () => {
    (fetchExperiences as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
    const { getByText } = await render(<ExploreScreen />);
    await waitFor(() => {
      expect(getByText('Failed to load featured experience.')).toBeTruthy();
    });
    // Retry button is rendered
    expect(getByText('Retry')).toBeTruthy();
  });
});
