import React from 'react';
import { render } from '@testing-library/react-native';
import { useTranslation } from 'react-i18next';

import { getTrackById } from '@/data/tracks';
import TrackDetailScreen from '@/app/tracks/[id]';

// Mock expo-router (Stack and useLocalSearchParams)
const mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  useLocalSearchParams: () => mockParams,
}));

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
  }),
}));

jest.mock('react-native-webview', () => ({
  WebView: 'WebView',
}));

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-symbols', () => ({ SymbolView: 'SymbolView' }));

const mockMap: Record<string, string> = {
  'tracks.notFound': 'Track not found',
  'tracks.duration': '45 min walk',
  'index.waitingForDownload': 'Download audio first to play it',
};

beforeAll(() => {
  (useTranslation().t as unknown as jest.Mock).mockImplementation((k: string) => mockMap[k] ?? k);
});

beforeEach(() => {
  // Default to a valid track
  mockParams.id = 'umepay-bosque';
});

describe('TrackDetailScreen', () => {
  it('renders the track title from metadata', () => {
    const { getByText } = render(<TrackDetailScreen />);
    const track = getTrackById('umepay-bosque')!;
    expect(getByText(track.title)).toBeTruthy();
  });

  it('renders the track description', () => {
    const { getByText } = render(<TrackDetailScreen />);
    const track = getTrackById('umepay-bosque')!;
    expect(getByText(track.description)).toBeTruthy();
  });

  it('renders the duration from translation', () => {
    const { getByText } = render(<TrackDetailScreen />);
    expect(getByText('45 min walk')).toBeTruthy();
  });

  it('renders download card', () => {
    const { getByTestId } = render(<TrackDetailScreen />);
    expect(getByTestId('unified-audio-controller-idle')).toBeTruthy();
  });

  it('renders GPS badge', () => {
    const { getByTestId } = render(<TrackDetailScreen />);
    expect(getByTestId('gps-precision-badge')).toBeTruthy();
  });

  it('shows not-found for unknown track id', () => {
    mockParams.id = 'unknown-track';
    const { getByText } = render(<TrackDetailScreen />);
    expect(getByText('Track not found')).toBeTruthy();
  });

  it('handles empty id gracefully', () => {
    mockParams.id = '';
    const { getByText } = render(<TrackDetailScreen />);
    expect(getByText('Track not found')).toBeTruthy();
  });
});
