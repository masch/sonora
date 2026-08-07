import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { useTranslation } from 'react-i18next';

import TrackDetailScreen from '@/app/poetics/[id]';
import { type Experience } from '@/data/experiences';

const mockExperience: Experience = {
  id: 'a23baa7e-2c82-472f-9241-4f23e00c1732',
  slug: 'sendero-bosque',
  title: 'SENDERO DEL BOSQUE',
  description: 'Un sendero por el bosque, 2 secciones, 900mts',
  format: 'track',
  themeKey: 'birds',
  audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  durationSeconds: 900,
  latitude: -32.211913,
  longitude: -64.73809,
  free: true,
  price: null,
  imageKey: 'tracks-pajaros-chiricotes-cover',
  geofenceBypassable: false,
  geoMode: 'unrestricted',
  radiusMeters: null,
};

const mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: jest.fn(),
}));

jest.mock('@/data/experiences', () => ({
  fetchThemes: jest.fn(() => Promise.resolve([])),
  fetchExperiences: jest.fn(() => Promise.resolve([mockExperience])),
  USER_EXPERIENCE_FORMATS: ['track', 'trip'],
  isPlayableExperience: (track: unknown) => {
    const t = track as { format?: string };
    return t?.format ? ['track', 'trip'].includes(t.format) : false;
  },
}));

const mockGeoffences = {
  isNearStart: true,
  gpsAccuracy: null as number | null,
  gpsStatus: 'initializing',
  distanceMeters: null as number | null,
  requiredRadiusMeters: 50,
  userCoordinates: null as { latitude: number; longitude: number } | null,
  errorMsg: null as string | null,
};

// Record the arguments each useOfflineGeofence call receives so the test can
// assert TrackDetailView passes the track's own geoMode/radiusMeters + format.
const geofenceCallArgs: unknown[] = [];
jest.mock('@/hooks/use-offline-geofence', () => ({
  useOfflineGeofence: (...args: unknown[]) => {
    geofenceCallArgs.push(args);
    return mockGeoffences;
  },
}));

// Controllable bypass switch (from remote-config store).
const mockBypass = { current: false };
jest.mock('@/store/remote-config-store', () => ({
  useRemoteConfigStore: (selector: (s: unknown) => unknown) =>
    selector({ config: { geofence: { bypassGeofence: mockBypass.current } } }),
  useRemoteConfig: () => ({ config: { geofence: { bypassGeofence: mockBypass.current } } }),
}));

// Mock BottomModal — RN <Modal> crashes in test renderer (React 19)
jest.mock('@/components/ui/bottom-modal', () => {
  const MockBottomModal = ({
    visible,
    children,
  }: {
    children: React.ReactNode;
    visible: boolean;
  }) => (visible ? <>{children}</> : null);
  return { __esModule: true, default: MockBottomModal, BottomModal: MockBottomModal };
});

jest.mock('@/hooks/use-confirm', () => ({
  useConfirm: () => ({ confirm: jest.fn().mockResolvedValue(true), component: null }),
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

jest.mock('@/hooks/use-audio-rewind', () => ({
  useAudioRewind: () => jest.fn(),
}));

jest.mock('@/hooks/use-feedback-submit', () => ({
  useFeedbackSubmit: () => ({
    submitFeedback: jest.fn(),
    dismissFeedback: jest.fn(),
    feedbackError: null,
    feedbackStatus: undefined,
  }),
}));

jest.mock('@/hooks/use-feedback-trigger', () => ({
  useFeedbackTrigger: () => ({ showFeedback: false, dismiss: jest.fn() }),
}));

jest.mock('@/services/payment-client', () => ({
  PaymentClient: { logAccess: jest.fn() },
}));

jest.mock('@/storage/app-storage', () => ({
  getUserEmail: jest.fn().mockResolvedValue(null),
}));

jest.mock('react-native-webview', () => ({
  WebView: 'WebView',
}));

jest.mock('@/components/track-detail-map', () => {
  const MockTrackDetailMap = () => null;
  return { __esModule: true, default: MockTrackDetailMap };
});

jest.mock('@/components/feedback-form', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-symbols', () => ({ SymbolView: 'SymbolView' }));

const mockMap: Record<string, string> = {
  'experiences.notFound': 'Track not found',
  'experiences.duration': '{{minutes}} min walk',
  'map.loadingMap': 'Loading map…',
  'experiences.geofenceBlocked.bannerTitle': "You're too far",
  'experiences.geofenceBlocked.bannerDescription': 'You need to be within {{radius}} meters',
  'experiences.geofenceBlocked.bannerDistance': 'Current distance: {{distance}}',
  'experiences.geofenceBlocked.blockedAlertTitle': "Can't play",
  'experiences.geofenceBlocked.blockedAlertMessage':
    'You need to be within {{radius}} meters. Current distance: {{distance}}.',
  'experiences.geofenceBlocked.blockedAlertOk': 'Got it',
  'experiences.geofenceBlocked.notAvailable': 'not available',
  'experiences.categories.birds': 'Birds',
  'feedback.form.title': 'Feedback',
};

beforeAll(() => {
  (useTranslation().t as unknown as jest.Mock).mockImplementation((k: string) => mockMap[k] ?? k);
});

beforeEach(() => {
  mockParams.id = 'sendero-bosque';
  mockGeoffences.isNearStart = true;
  mockGeoffences.distanceMeters = null;
  mockGeoffences.requiredRadiusMeters = 50;
  mockBypass.current = false;
  mockExperience.geoMode = 'unrestricted';
  mockExperience.radiusMeters = null;
  geofenceCallArgs.length = 0;
});

describe('TrackDetailView (via TrackDetail screen)', () => {
  it('renders the track title from metadata', async () => {
    const { getByText } = await render(<TrackDetailScreen />);
    await waitFor(() => {
      expect(getByText('SENDERO DEL BOSQUE')).toBeTruthy();
    });
  });

  it('renders the track description', async () => {
    const { getByText } = await render(<TrackDetailScreen />);
    await waitFor(() => {
      expect(getByText('Un sendero por el bosque, 2 secciones, 900mts')).toBeTruthy();
    });
  });

  it('passes the track own geo data + format to useOfflineGeofence', async () => {
    mockExperience.geoMode = 'entityRadius';
    mockExperience.radiusMeters = 30;
    await render(<TrackDetailScreen />);
    await waitFor(() => {
      expect(geofenceCallArgs.length).toBeGreaterThan(0);
    });
    const lastCall = geofenceCallArgs[geofenceCallArgs.length - 1] as [
      { latitude: number; longitude: number },
      { format: string; geoMode: string; radiusMeters: number | null },
    ];
    const [coords, override] = lastCall;
    expect(coords).toEqual({ latitude: -32.211913, longitude: -64.73809 });
    expect(override).toEqual({ format: 'track', geoMode: 'entityRadius', radiusMeters: 30 });
  });

  it('GEOF.8: keeps an any-mode track always playable — no geofence banner', async () => {
    mockExperience.geoMode = 'unrestricted';
    // "far away / not near" would normally gate, but any-mode resolves un-gated.
    mockGeoffences.isNearStart = true;
    const { queryByTestId } = await render(<TrackDetailScreen />);
    await waitFor(() => {
      expect(queryByTestId('geofence-blocked-banner')).toBeNull();
    });
  });

  it('GEOF.8: entity/type track far away is blocked and shows banner + blocked alert on play', async () => {
    mockExperience.geoMode = 'entityRadius';
    mockExperience.radiusMeters = 30;
    mockGeoffences.isNearStart = false;
    mockGeoffences.distanceMeters = 250;
    mockGeoffences.requiredRadiusMeters = 30;
    const { getByTestId, queryByTestId, getByText } = await render(<TrackDetailScreen />);
    await waitFor(() => {
      expect(getByTestId('geofence-blocked-banner')).toBeTruthy();
      expect(getByText("You're too far")).toBeTruthy();
    });

    // Blocked modal should not be visible before tapping
    expect(queryByTestId('geofence-blocked-alert-ok')).toBeNull();

    await fireEvent.press(getByTestId('play-download-button'));

    // Blocked alert is now visible
    await waitFor(() => {
      expect(getByTestId('geofence-blocked-alert-ok')).toBeTruthy();
    });
  });

  it('GEOF.8: bypass still wins on a gating track (playable from anywhere)', async () => {
    mockExperience.geoMode = 'formatDefaultRadius';
    mockGeoffences.isNearStart = false;
    mockBypass.current = true;
    const { queryByTestId, getByTestId } = await render(<TrackDetailScreen />);
    await waitFor(() => {
      // No banner despite being far — the global bypass overrides the entityRadius gate.
      expect(queryByTestId('geofence-blocked-banner')).toBeNull();
    });
    // Play/download is not gated.
    await fireEvent.press(getByTestId('play-download-button'));
    await waitFor(() => {
      expect(queryByTestId('geofence-blocked-alert-ok')).toBeNull();
    });
  });

  it('shows not-found for unknown track id', async () => {
    mockParams.id = 'unknown-track';
    const { getByText } = await render(<TrackDetailScreen />);
    await waitFor(() => {
      expect(getByText('Track not found')).toBeTruthy();
    });
  });

  it('handles empty id gracefully', async () => {
    mockParams.id = '';
    const { getByText } = await render(<TrackDetailScreen />);
    await waitFor(() => {
      expect(getByText('Track not found')).toBeTruthy();
    });
  });

  it('renders detail card + manual feedback for a track', async () => {
    const { queryByTestId, getByTestId } = await render(<TrackDetailScreen />);
    await waitFor(() => {
      expect(queryByTestId('gps-precision-badge')).toBeNull();
      expect(getByTestId('experience-title')).toBeTruthy();
      expect(getByTestId('experience-category')).toBeTruthy();
      expect(getByTestId('track-detail-map')).toBeTruthy();
      expect(getByTestId('feedback-manual-button')).toBeTruthy();
    });
  });
});
