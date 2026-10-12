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
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  const MockBottomModal = ({
    visible,
    title,
    children,
    footer,
  }: {
    children: React.ReactNode;
    visible: boolean;
    title?: string;
    footer?: React.ReactNode;
  }) =>
    visible ? (
      <>
        {title ? React.createElement(Text, null, title) : null}
        {children}
        {footer}
      </>
    ) : null;
  return { __esModule: true, default: MockBottomModal, BottomModal: MockBottomModal };
});

const mockConfirmFn = jest.fn().mockResolvedValue(true);
jest.mock('@/hooks/use-confirm', () => ({
  useConfirm: () => ({ confirm: mockConfirmFn, component: null }),
}));

const mockStartDownload = jest.fn();
const mockDeleteTrackLocal = jest.fn();
let mockDownloadState = {
  status: 'idle',
  progress: 0,
  localAudioUri: null as string | null,
  errorMsg: null as string | null,
  startDownload: mockStartDownload,
  deleteTrackLocal: mockDeleteTrackLocal,
};
jest.mock('@/hooks/use-track-download', () => ({
  useTrackDownload: () => mockDownloadState,
}));

const mockPlayerPlay = jest.fn();
const mockPlayerPause = jest.fn();
const mockPlayerStop = jest.fn();
const mockPlayerSeekTo = jest.fn();
let mockPlayerState = {
  status: 'idle',
  positionMs: 0,
  durationMs: 0,
  errorMsg: null as string | null,
  play: mockPlayerPlay,
  pause: mockPlayerPause,
  stop: mockPlayerStop,
  seekTo: mockPlayerSeekTo,
};
jest.mock('@/hooks/use-immersion-player', () => ({
  useImmersionPlayer: () => mockPlayerState,
}));

jest.mock('@/hooks/use-audio-rewind', () => ({
  useAudioRewind: () => jest.fn(),
}));

const mockSubmitFeedback = jest.fn();
const mockDismissFeedback = jest.fn();
jest.mock('@/hooks/use-feedback-submit', () => ({
  useFeedbackSubmit: () => ({
    submitFeedback: mockSubmitFeedback,
    dismissFeedback: mockDismissFeedback,
    feedbackError: null,
    feedbackStatus: undefined,
  }),
}));

const mockTriggerDismiss = jest.fn();
jest.mock('@/hooks/use-feedback-trigger', () => ({
  useFeedbackTrigger: () => ({ showFeedback: false, dismiss: mockTriggerDismiss }),
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

const mockTrackDetailMapProps: unknown[] = [];
jest.mock('@/components/track-detail-map', () => {
  const MockTrackDetailMap = (props: unknown) => {
    mockTrackDetailMapProps.push(props);
    return null;
  };
  return { __esModule: true, default: MockTrackDetailMap };
});

jest.mock('@/components/feedback-form', () => {
  const React = jest.requireActual('react');
  const { View: RNView, Button: RNButton } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({
      visible,
      onSubmit,
      onDismiss,
    }: {
      visible: boolean;
      onSubmit: (msg: string) => void;
      onDismiss: () => void;
    }) =>
      visible ? (
        <RNView testID="mock-feedback-form">
          <RNButton
            testID="mock-feedback-submit"
            onPress={() => onSubmit('Feedback message')}
            title="Submit"
          />
          <RNButton testID="mock-feedback-dismiss" onPress={onDismiss} title="Dismiss" />
        </RNView>
      ) : null,
  };
});

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-symbols', () => ({ SymbolView: 'SymbolView' }));

const mockMap: Record<string, string> = {
  'experiences.notFound': 'Track not found',
  'experiences.duration': '{{minutes}} min walk',
  'map.loadingMap': 'Loading map…',
  'experiences.geofenceBlocked.bannerTitle': "You're too far",
  'experiences.geofenceBlocked.bannerDescription': 'You need to be within {{radius}}',
  'experiences.geofenceBlocked.bannerDistance': 'Current distance: {{distance}}',
  'experiences.geofenceBlocked.blockedAlertTitle': "Can't play",
  'experiences.geofenceBlocked.blockedAlertMessage':
    'You need to be within {{radius}}. Current distance: {{distance}}.',
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
  mockDownloadState.localAudioUri = null;
  mockDownloadState.status = 'idle';
  mockPlayerState.status = 'idle';
  geofenceCallArgs.length = 0;
  mockTrackDetailMapProps.length = 0;
  jest.clearAllMocks();
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
      expect(getByTestId('lead-capture-open-button')).toBeTruthy();
    });
  });

  it('passes userCoordinates from geofence to TrackDetailMap', async () => {
    mockGeoffences.userCoordinates = { latitude: -32.21, longitude: -64.73 };
    await render(<TrackDetailScreen />);
    await waitFor(() => {
      expect(mockTrackDetailMapProps.length).toBeGreaterThan(0);
    });
    const lastProps = mockTrackDetailMapProps[mockTrackDetailMapProps.length - 1] as {
      latitude: number;
      longitude: number;
      userLatitude?: number;
      userLongitude?: number;
    };
    expect(lastProps.latitude).toBe(-32.211913);
    expect(lastProps.longitude).toBe(-64.73809);
    expect(lastProps.userLatitude).toBe(-32.21);
    expect(lastProps.userLongitude).toBe(-64.73);
  });

  it('renders experience credits if present and omits when absent', async () => {
    mockExperience.credits = undefined;
    const { queryByTestId, rerender } = await render(<TrackDetailScreen />);
    await waitFor(() => {
      expect(queryByTestId('experience-credits')).toBeNull();
    });

    mockExperience.credits = [
      { role: 'Texto', names: 'Magali de Masi' },
      { role: 'Locución', names: 'Mara Ticach' },
    ];
    await rerender(<TrackDetailScreen />);
    await waitFor(() => {
      expect(queryByTestId('experience-credits')).toBeTruthy();
    });
  });

  it('opens feedback modal when feedback button is pressed and handles submit and dismiss', async () => {
    const { getByTestId, queryByTestId } = await render(<TrackDetailScreen />);
    await waitFor(() => {
      expect(getByTestId('feedback-manual-button')).toBeTruthy();
    });

    expect(queryByTestId('mock-feedback-form')).toBeNull();

    await fireEvent.press(getByTestId('feedback-manual-button'));
    expect(getByTestId('mock-feedback-form')).toBeTruthy();

    await fireEvent.press(getByTestId('mock-feedback-submit'));
    expect(mockSubmitFeedback).toHaveBeenCalledWith(mockExperience.id, 'Feedback message');

    await fireEvent.press(getByTestId('mock-feedback-dismiss'));
    expect(mockDismissFeedback).toHaveBeenCalled();
    expect(mockTriggerDismiss).toHaveBeenCalled();
  });

  it('starts download when play button is pressed on a track that is not yet downloaded', async () => {
    mockDownloadState.localAudioUri = null;
    mockDownloadState.status = 'idle';

    const { getByTestId } = await render(<TrackDetailScreen />);
    await waitFor(() => {
      expect(getByTestId('play-download-button')).toBeTruthy();
    });

    await fireEvent.press(getByTestId('play-download-button'));
    expect(mockStartDownload).toHaveBeenCalledTimes(1);
  });

  it('plays audio directly when play button is pressed and track is already downloaded', async () => {
    mockDownloadState.localAudioUri = 'file://cached-audio.mp3';
    mockDownloadState.status = 'completed';

    const { getByTestId } = await render(<TrackDetailScreen />);
    await waitFor(() => {
      expect(getByTestId('audio-play-button')).toBeTruthy();
    });

    await fireEvent.press(getByTestId('audio-play-button'));
    expect(mockPlayerPlay).toHaveBeenCalled();
  });

  it('closes geofence blocked modal when dismissed', async () => {
    mockExperience.geoMode = 'entityRadius';
    mockExperience.radiusMeters = 30;
    mockGeoffences.isNearStart = false;
    mockGeoffences.distanceMeters = 300;
    mockGeoffences.requiredRadiusMeters = 30;

    const { getByTestId, queryByTestId } = await render(<TrackDetailScreen />);
    await waitFor(() => {
      expect(getByTestId('play-download-button')).toBeTruthy();
    });

    await fireEvent.press(getByTestId('play-download-button'));

    await waitFor(() => {
      expect(getByTestId('geofence-blocked-alert-ok')).toBeTruthy();
    });

    await fireEvent.press(getByTestId('geofence-blocked-alert-ok'));

    await waitFor(() => {
      expect(queryByTestId('geofence-blocked-alert-ok')).toBeNull();
    });
  });

  it('automatically plays audio when download completes after user initiates play', async () => {
    mockDownloadState.localAudioUri = null;
    mockDownloadState.status = 'idle';

    const { getByTestId, rerender } = await render(<TrackDetailScreen />);
    await waitFor(() => {
      expect(getByTestId('play-download-button')).toBeTruthy();
    });

    await fireEvent.press(getByTestId('play-download-button'));
    expect(mockStartDownload).toHaveBeenCalledTimes(1);

    mockDownloadState.localAudioUri = 'file://downloaded.mp3';
    mockDownloadState.status = 'completed';

    await rerender(<TrackDetailScreen />);
    await waitFor(() => {
      expect(mockPlayerPlay).toHaveBeenCalled();
    });
  });

  it('handles pause and reset from media controls on downloaded track', async () => {
    mockDownloadState.localAudioUri = 'file://cached-audio.mp3';
    mockDownloadState.status = 'completed';
    mockPlayerState.status = 'playing';
    mockPlayerState.positionMs = 15000;
    mockPlayerState.durationMs = 900000;

    const { getByTestId } = await render(<TrackDetailScreen />);
    await waitFor(() => {
      expect(getByTestId('audio-pause-button')).toBeTruthy();
    });

    await fireEvent.press(getByTestId('audio-pause-button'));
    expect(mockPlayerPause).toHaveBeenCalled();

    await fireEvent.press(getByTestId('audio-reset-button'));
    expect(mockPlayerSeekTo).toHaveBeenCalledWith(0);
  });

  it('renders payment prompt when track is paid and handles purchase and restore', async () => {
    mockExperience.free = false;
    mockExperience.price = 1500000;

    const { getByTestId } = await render(<TrackDetailScreen />);
    await waitFor(() => {
      expect(getByTestId('pay-button')).toBeTruthy();
    });

    await fireEvent.press(getByTestId('pay-button'));

    await fireEvent.press(getByTestId('restore-link-button'));
    await fireEvent.changeText(getByTestId('restore-email-input'), 'user@test.com');
    await fireEvent.press(getByTestId('restore-button'));
  });
});
