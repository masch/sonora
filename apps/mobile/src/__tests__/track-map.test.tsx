import type { Experience } from '@/data/experiences';
import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

let mockTracksData: Experience[];

const DEFAULT_TRACKS: Experience[] = [
  {
    id: 'a23baa7e-2c82-472f-9241-4f23e00c1732',
    slug: 'umepay-bosque',
    title: 'Umepay Bosque Antiguo',
    description: 'A meditative walk through the ancient forest.',
    format: 'track',
    themeKey: 'landscapes',
    durationSeconds: 2700,
    latitude: -32.212,
    longitude: -64.738,
    audioUrl: 'https://example.com/audio.mp3',
    imageKey: 'trips-deriva-centro-cover',
  },
  {
    id: '5a9463ce-daba-4756-892e-4dd4cb862309',
    slug: 'rio-claro',
    title: 'Rio Claro Trail',
    description: 'A walk along the clear river.',
    format: 'track',
    themeKey: 'community',
    durationSeconds: 1800,
    latitude: -33.123,
    longitude: -65.456,
    audioUrl: 'https://example.com/audio2.mp3',
    imageKey: 'trips-deriva-centro-cover',
  },
];

beforeEach(() => {
  mockTracksData = DEFAULT_TRACKS;
  jest.clearAllMocks();
});

jest.mock('@/data/experiences', () => ({
  fetchThemes: jest.fn(() => Promise.resolve([])),
  fetchExperiences: jest.fn(() => Promise.resolve(mockTracksData)),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
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

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

import { useLocationStore } from '@/store/location-store';
import * as Location from 'expo-location';

jest.mock('@/store/location-store', () => ({
  useLocationStore: jest.fn(),
}));

jest.mock('@/hooks/use-translation', () => ({
  useAppTranslation: () => ({
    t: (k: string, params?: Record<string, unknown>) =>
      params ? `${k}-${JSON.stringify(params)}` : k,
  }),
}));

import TrackMap from '@/components/track-map';

describe('TrackMap native component', () => {
  beforeEach(() => {
    mockTracksData = DEFAULT_TRACKS;
    jest.clearAllMocks();
    (useLocationStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = { coords: null, accuracy: null, status: 'initializing', errorMsg: null };
      return selector ? selector(state) : state;
    });
  });

  it('renders track cards when tracks exist', async () => {
    const { getByText } = render(<TrackMap />);
    await waitFor(() => {
      expect(getByText('Umepay Bosque Antiguo')).toBeTruthy();
    });
    expect(getByText('Rio Claro Trail')).toBeTruthy();
  });

  it('renders view track link per track', async () => {
    const { getByTestId } = render(<TrackMap />);
    await waitFor(() => {
      expect(getByTestId('view-track-umepay-bosque')).toBeTruthy();
    });
    expect(getByTestId('view-track-rio-claro')).toBeTruthy();
  });

  it('renders empty state when no tracks', async () => {
    mockTracksData = [];
    const { getByText } = render(<TrackMap />);
    await waitFor(() => {
      expect(getByText('map.noTracksTitle')).toBeTruthy();
    });
  });

  it('renders instructions card', async () => {
    const { getByText } = render(<TrackMap />);
    await waitFor(() => {
      expect(getByText('map.instructionsTitle')).toBeTruthy();
    });
  });

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
      expect(getAllByText(/map\.distanceFromYou/).length).toBe(2);
    });
  });

  it('hides distance when location permission is denied', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: true,
    });

    const { queryByText, getByText } = render(<TrackMap />);
    await waitFor(() => {
      expect(getByText('Umepay Bosque Antiguo')).toBeTruthy();
    });
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
