import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mutable track data — allows per-test override without jest.clearAllMocks issues
// ---------------------------------------------------------------------------
let mockTracksData: {
  id: string;
  title: string;
  description: string;
  durationSeconds: number;
  startCoordinates: { latitude: number; longitude: number };
  audioRemoteUrl: string;
}[];

const DEFAULT_TRACKS = [
  {
    id: 'umepay-bosque',
    title: 'Umepay Bosque Antiguo',
    description: 'A meditative walk through the ancient forest.',
    durationSeconds: 2700,
    startCoordinates: { latitude: -32.212, longitude: -64.738 },
    audioRemoteUrl: 'https://example.com/audio.mp3',
  },
  {
    id: 'rio-claro',
    title: 'Rio Claro Trail',
    description: 'A walk along the clear river.',
    durationSeconds: 1800,
    startCoordinates: { latitude: -33.123, longitude: -65.456 },
    audioRemoteUrl: 'https://example.com/audio2.mp3',
  },
];

beforeEach(() => {
  mockTracksData = DEFAULT_TRACKS;
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Mock tracks data
// ---------------------------------------------------------------------------
jest.mock('@/data/tracks', () => ({
  getAllTracks: jest.fn(() => mockTracksData),
}));

// ---------------------------------------------------------------------------
// Mock expo-router
// ---------------------------------------------------------------------------
const mockPush = jest.fn();
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  const MockLink = (props: Record<string, unknown>) => {
    if (props.asChild && React.Children.count(props.children as React.ReactNode) > 0) {
      const child = React.Children.only(props.children as React.ReactNode);
      return React.cloneElement(child as React.ReactElement, {
        onPress: () => mockPush(props.href),
      });
    }
    return React.createElement(
      'Text',
      {
        ...props,
        onPress: () => mockPush(props.href),
      },
      props.children,
    );
  };
  MockLink.displayName = 'Link';
  return { Link: MockLink, useRouter: () => ({ push: mockPush }) };
});

// ---------------------------------------------------------------------------
// Mock expo-location
// ---------------------------------------------------------------------------
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

import * as Location from 'expo-location';

// ---------------------------------------------------------------------------
// Mock useLocationStore
// ---------------------------------------------------------------------------
import { useLocationStore } from '@/store/location-store';
jest.mock('@/store/location-store', () => ({
  useLocationStore: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Mock useAppTranslation
// ---------------------------------------------------------------------------
jest.mock('@/hooks/use-translation', () => ({
  useAppTranslation: () => ({
    t: (k: string, params?: Record<string, unknown>) =>
      params ? `${k}-${JSON.stringify(params)}` : k,
  }),
}));

// Import after mocks
import TrackMap from '@/components/track-map';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('TrackMap native component', () => {
  beforeEach(() => {
    mockTracksData = DEFAULT_TRACKS;
    jest.clearAllMocks();
    (useLocationStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = { coords: null, accuracy: null, status: 'initializing', errorMsg: null };
      return selector ? selector(state) : state;
    });
  });

  it('renders track cards when tracks exist', () => {
    const { getByText } = render(<TrackMap />);

    expect(getByText('Umepay Bosque Antiguo')).toBeTruthy();
    expect(getByText('Rio Claro Trail')).toBeTruthy();
  });

  it('renders view track link per track', () => {
    const { getByTestId } = render(<TrackMap />);

    expect(getByTestId('view-track-umepay-bosque')).toBeTruthy();
    expect(getByTestId('view-track-rio-claro')).toBeTruthy();
  });

  it('renders empty state when no tracks', () => {
    mockTracksData = [];

    const { getByText } = render(<TrackMap />);

    expect(getByText('map.noTracksTitle')).toBeTruthy();
  });

  it('renders instructions card', () => {
    const { getByText } = render(<TrackMap />);

    expect(getByText('map.instructionsTitle')).toBeTruthy();
  });

  // -----------------------------------------------------------------------
  // FR2 — Location-Based Distance
  // -----------------------------------------------------------------------

  it('shows distance when location permission is granted', async () => {
    (useLocationStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = {
        coords: { latitude: -32.0, longitude: -64.0 },
        accuracy: 5,
        status: 'ready',
        errorMsg: null,
      };
      return selector ? selector(state) : state;
    });

    const { getAllByText } = render(<TrackMap />);

    await waitFor(() => {
      expect(getAllByText(/map\.distanceFromYou/).length).toBe(2); // 2 tracks
    });
  });

  it('hides distance when location permission is denied', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: true,
    });

    const { queryByText, getByText } = render(<TrackMap />);

    // Wait for effects to settle
    await waitFor(() => {
      expect(getByText('Umepay Bosque Antiguo')).toBeTruthy();
    });

    // Distance text must NOT be present
    expect(queryByText(/map\.distanceFromYou/)).toBeNull();
  });

  it('hides distance when location fetch throws', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
    });
    jest
      .mocked(Location.getCurrentPositionAsync)
      .mockRejectedValue(new Error('Location unavailable'));

    const { queryByText, getByText } = render(<TrackMap />);

    await waitFor(() => {
      expect(getByText('Umepay Bosque Antiguo')).toBeTruthy();
    });

    expect(queryByText(/map\.distanceFromYou/)).toBeNull();
  });
});
