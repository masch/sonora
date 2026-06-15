import React from 'react';
import { render } from '@testing-library/react-native';
import { useTranslation } from 'react-i18next';

import { getTripById } from '@/data/trips';
import TripDetailScreen from '@/app/trips/[id]';

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

jest.mock('@/hooks/use-trip-download', () => ({
  useTripDownload: () => ({
    status: 'idle',
    progress: 0,
    localAudioUri: null,
    errorMsg: null,
    startDownload: jest.fn(),
    deleteTripLocal: jest.fn(),
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
  'trips.notFound': 'Trip not found',
  'trips.duration': '45 min walk',
  'index.waitingForDownload': 'Download audio first to play it',
};

beforeAll(() => {
  (useTranslation().t as unknown as jest.Mock).mockImplementation((k: string) => mockMap[k] ?? k);
});

beforeEach(() => {
  // Default to a valid trip
  mockParams.id = 'umepay-bosque';
});

describe('TripDetailScreen', () => {
  it('renders the trip title from metadata', () => {
    const { getByText } = render(<TripDetailScreen />);
    const trip = getTripById('umepay-bosque')!;
    expect(getByText(trip.title)).toBeTruthy();
  });

  it('renders the trip description', () => {
    const { getByText } = render(<TripDetailScreen />);
    const trip = getTripById('umepay-bosque')!;
    expect(getByText(trip.description)).toBeTruthy();
  });

  it('renders the duration from translation', () => {
    const { getByText } = render(<TripDetailScreen />);
    expect(getByText('45 min walk')).toBeTruthy();
  });

  it('renders download card', () => {
    const { getByTestId } = render(<TripDetailScreen />);
    expect(getByTestId('unified-audio-controller-idle')).toBeTruthy();
  });

  it('renders GPS badge', () => {
    const { getByTestId } = render(<TripDetailScreen />);
    expect(getByTestId('gps-precision-badge')).toBeTruthy();
  });

  it('shows not-found for unknown trip id', () => {
    mockParams.id = 'unknown-trip';
    const { getByText } = render(<TripDetailScreen />);
    expect(getByText('Trip not found')).toBeTruthy();
  });

  it('handles empty id gracefully', () => {
    mockParams.id = '';
    const { getByText } = render(<TripDetailScreen />);
    expect(getByText('Trip not found')).toBeTruthy();
  });
});
