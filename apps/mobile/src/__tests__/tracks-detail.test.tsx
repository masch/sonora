import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import TrackDetailScreen from '@/app/tracks/[id]';
import { type Experience } from '@/data/experiences';

const mockExperiences: Experience[] = [
  {
    id: 'a23baa7e-2c82-472f-9241-4f23e00c1732',
    slug: 'umepay-bosque',
    title: 'DERIVA POR EL CENTRO',
    description: 'Deriva por el centro, 3 secciones, 600mts',
    format: 'trip',
    themeKey: 'landscapes',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    durationSeconds: 2700,
    latitude: -32.211913,
    longitude: -64.73809,
    priceLabel: '15 mil $',
    imageKey: 'trips-deriva-centro-cover',
    waypoints: [
      {
        id: '1',
        experienceId: 'a23baa7e-2c82-472f-9241-4f23e00c1732',
        order: 1,
        latitude: -32.211913,
        longitude: -64.73809,
        radiusMeters: 50,
      },
    ],
  },
];

const mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@/data/experiences', () => ({
  fetchThemes: jest.fn(() => Promise.resolve([])),
  fetchExperiences: jest.fn(() => Promise.resolve(mockExperiences)),
  USER_EXPERIENCE_FORMATS: ['track', 'trip'],
  isPlayableExperience: (track: unknown) => {
    const t = track as { format?: string };
    return t?.format ? ['track', 'trip'].includes(t.format) : false;
  },
}));

const mockGeofence = {
  isNearStart: true,
  gpsAccuracy: null as number | null,
  gpsStatus: 'initializing',
  distanceMeters: null as number | null,
  requiredRadiusMeters: 50,
  errorMsg: null as string | null,
};
jest.mock('@/hooks/use-offline-geofence', () => ({
  useOfflineGeofence: () => mockGeofence,
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

const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const mockMap: Record<string, string> = {
  'experiences.notFound': 'Track not found',
  'experiences.duration': '45 min walk',
  'index.waitingForDownload': 'Download audio first to play it',
  'map.loadingMap': 'Loading map…',
  'experiences.geofenceBlocked.bannerTitle': "You're too far",
  'experiences.geofenceBlocked.bannerDescription': 'You need to be within {{radius}} meters',
  'experiences.geofenceBlocked.bannerDistance': 'Current distance: {{distance}}',
  'experiences.geofenceBlocked.blockedAlertTitle': "Can't play",
  'experiences.geofenceBlocked.blockedAlertMessage':
    'You need to be within {{radius}} meters. Current distance: {{distance}}.',
  'experiences.geofenceBlocked.blockedAlertOk': 'Got it',
};

beforeAll(() => {
  (useTranslation().t as unknown as jest.Mock).mockImplementation((k: string) => mockMap[k] ?? k);
});

beforeEach(() => {
  mockParams.id = 'umepay-bosque';
});

describe('TrackDetailScreen', () => {
  it('renders the track title from metadata', async () => {
    const { getByText } = render(<TrackDetailScreen />);
    await waitFor(() => {
      expect(getByText('DERIVA POR EL CENTRO')).toBeTruthy();
    });
  });

  it('renders the track description', async () => {
    const { getByText } = render(<TrackDetailScreen />);
    await waitFor(() => {
      expect(getByText('Deriva por el centro, 3 secciones, 600mts')).toBeTruthy();
    });
  });

  it('renders the duration from translation', async () => {
    const { getByText } = render(<TrackDetailScreen />);
    await waitFor(() => {
      expect(getByText('45 min walk')).toBeTruthy();
    });
  });

  it('renders download card', async () => {
    const { getByTestId } = render(<TrackDetailScreen />);
    await waitFor(() => {
      expect(getByTestId('unified-audio-controller-idle')).toBeTruthy();
    });
  });

  it('renders GPS badge for trip format', async () => {
    mockExperiences[0].format = 'trip';
    const { getByTestId } = render(<TrackDetailScreen />);
    await waitFor(() => {
      expect(getByTestId('gps-precision-badge')).toBeTruthy();
    });
  });

  it('renders experience details card layout and manual feedback button for track format', async () => {
    mockExperiences[0].format = 'track';
    mockExperiences[0].themeKey = 'birds';
    const { queryByTestId, getByTestId, getByText } = render(<TrackDetailScreen />);
    await waitFor(() => {
      expect(queryByTestId('gps-precision-badge')).toBeNull();
      expect(getByTestId('experience-title')).toBeTruthy();
      expect(getByTestId('experience-category')).toBeTruthy();
      expect(getByText('45:00')).toBeTruthy();
      expect(getByText('experiences.detail.registry')).toBeTruthy();
      expect(getByText('experiences.detail.location')).toBeTruthy();
      expect(getByTestId('feedback-manual-button')).toBeTruthy();
    });
    // Restore format
    mockExperiences[0].format = 'trip';
  });

  it('shows not-found for unknown track id', async () => {
    mockParams.id = 'unknown-track';
    const { getByText } = render(<TrackDetailScreen />);
    await waitFor(() => {
      expect(getByText('Track not found')).toBeTruthy();
    });
  });

  it('handles empty id gracefully', async () => {
    mockParams.id = '';
    const { getByText } = render(<TrackDetailScreen />);
    await waitFor(() => {
      expect(getByText('Track not found')).toBeTruthy();
    });
  });

  it('blocks playback if geofence is strict (bypassable false) and renders blocked banner', async () => {
    mockExperiences[0].geofenceBypassable = false;
    mockGeofence.isNearStart = false;
    const { getByTestId, getByText } = render(<TrackDetailScreen />);
    await waitFor(() => {
      expect(getByTestId('geofence-blocked-banner')).toBeTruthy();
      expect(getByText("You're too far")).toBeTruthy();
    });
    // Restore
    mockGeofence.isNearStart = true;
    mockExperiences[0].geofenceBypassable = undefined;
  });

  it('shows alert when download is tapped while geofence blocked', async () => {
    mockExperiences[0].geofenceBypassable = false;
    mockGeofence.isNearStart = false;
    mockGeofence.distanceMeters = 250;
    const { getByTestId } = render(<TrackDetailScreen />);
    await waitFor(() => {
      expect(getByTestId('unified-audio-controller-idle')).toBeTruthy();
    });

    fireEvent.press(getByTestId('play-download-button'));

    // The mock t() returns the key template literally (no interpolation),
    // so we check the alert was called with the right title and button text
    expect(mockAlert).toHaveBeenCalledWith(
      "Can't play",
      'You need to be within {{radius}} meters. Current distance: {{distance}}.',
      expect.arrayContaining([expect.objectContaining({ text: 'Got it' })]),
    );

    // Restore
    mockGeofence.isNearStart = true;
    mockGeofence.distanceMeters = null;
    mockExperiences[0].geofenceBypassable = undefined;
  });
});
