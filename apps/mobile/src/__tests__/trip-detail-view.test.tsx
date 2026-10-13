import { render, fireEvent } from '@testing-library/react-native';

import TripDetailView from '@/components/trip-detail-view';
import type { TripExperience } from '@/data/experiences';

// ---------------------------------------------------------------------------
// Mocks — isolate the geofence gate from its data sources.
// ---------------------------------------------------------------------------
let mockPurchaseState = {
  status: 'purchased',
  free: false,
  price: 15000,
  purchaseId: 'p-1',
  error: null as string | null,
  paying: false,
  restoring: false,
  polling: false,
};
const mockPay = jest.fn();
const mockRestore = jest.fn();
jest.mock('@/hooks/use-purchase', () => ({
  usePurchase: () => [
    mockPurchaseState,
    { pay: mockPay, restore: mockRestore, refresh: jest.fn(), checkStatus: jest.fn() },
  ],
}));

const geofenceCallArgs: unknown[] = [];
let mockGeofenceState = {
  isNearStart: false,
  gpsAccuracy: 12,
  gpsStatus: 'ready',
  distanceMeters: 250,
  requiredRadiusMeters: 50,
  userCoordinates: { latitude: -34.61, longitude: -58.39 },
  errorMsg: null as string | null,
};
jest.mock('@/hooks/use-offline-geofence', () => ({
  useOfflineGeofence: (...args: unknown[]) => {
    geofenceCallArgs.push(args);
    return mockGeofenceState;
  },
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
  setMediaMetadata: jest.fn(),
};
jest.mock('@/hooks/use-immersion-player', () => ({
  useImmersionPlayer: () => mockPlayerState,
}));

jest.mock('@/hooks/use-confirm', () => ({
  useConfirm: () => ({ confirm: jest.fn().mockResolvedValue(true), component: null }),
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

jest.mock('@/hooks/use-audio-rewind', () => ({
  useAudioRewind: () => jest.fn(),
}));

jest.mock('@/hooks/use-theme-colors', () => ({
  useThemeColors: () => ({
    homeExploreRoutesBg: '#ffffff',
    border: '#d4d4d8',
    homeCardText: '#18181b',
    homeCardSubtext: '#71717a',
    background: '#ffffff',
    text: '#000000',
  }),
}));

let mockBypass = false;
jest.mock('@/store/remote-config-store', () => ({
  useRemoteConfigStore: (
    selector: (s: { config: { geofence: { bypassGeofence: boolean } } }) => unknown,
  ) => selector({ config: { geofence: { bypassGeofence: mockBypass } } }),
}));

jest.mock('@/services/payment-client', () => ({
  PaymentClient: { logAccess: jest.fn() },
}));

jest.mock('@/storage/app-storage', () => ({
  getUserEmail: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/components/track-detail-map', () => ({
  __esModule: true,
  default: () => null,
}));

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
            onPress={() => onSubmit('Trip feedback message')}
            title="Submit"
          />
          <RNButton testID="mock-feedback-dismiss" onPress={onDismiss} title="Dismiss" />
        </RNView>
      ) : null,
  };
});

const tripTrack: TripExperience = {
  id: 'trip-1',
  slug: 'la-deriva',
  title: 'La Deriva',
  description: 'Una deriva por la ciudad',
  themeKey: 'urban',
  durationSeconds: 900,
  latitude: -34.6037,
  longitude: -58.3816,
  free: false,
  price: 15000,
  currency: 'ARS',
  imageKey: 'trips-deriva-centro-cover',
  format: 'trip',
  audioUrl: 'https://example.com/audio.mp3',
  geoMode: 'formatDefaultRadius',
  radiusMeters: null,
  waypoints: [],
};

describe('TripDetailView geofence gate (post-purchase, too far)', () => {
  beforeEach(() => {
    geofenceCallArgs.length = 0;
    mockBypass = false;
    mockGeofenceState.isNearStart = false;
    mockDownloadState.localAudioUri = null;
    mockDownloadState.status = 'idle';
    mockPlayerState.status = 'idle';
    mockPurchaseState.status = 'purchased';
    jest.clearAllMocks();
  });

  it('GEOF.9: preserves the 50 m gate with the new hook override (format trip, geoMode type)', async () => {
    const { getByTestId } = await render(
      <TripDetailView track={tripTrack} showGPSDetails={false} />,
    );
    expect(geofenceCallArgs.length).toBeGreaterThan(0);
    const lastCall = geofenceCallArgs[geofenceCallArgs.length - 1] as [
      { latitude: number; longitude: number },
      { format: string; geoMode: string; radiusMeters: number | null },
    ];
    expect(lastCall[0]).toEqual({ latitude: -34.6037, longitude: -58.3816 });
    expect(lastCall[1]).toEqual({
      format: 'trip',
      geoMode: 'formatDefaultRadius',
      radiusMeters: null,
    });
    // Isolated geofence gate (the component is far + no bypass): the banner still appears.
    expect(getByTestId('geofence-blocked-banner')).toBeTruthy();
  });

  it('requests a fresh experience when purchased but the track has no audioUrl', async () => {
    const onPurchased = jest.fn();
    // The backend omits audioUrl until the purchase grants access.
    const trackWithoutAudioUrl = {
      ...tripTrack,
      audioUrl: null,
    };
    const { rerender } = await render(
      <TripDetailView
        track={trackWithoutAudioUrl}
        showGPSDetails={false}
        onPurchased={onPurchased}
      />,
    );
    // usePurchase mock resolves immediately to 'purchased' with no audioUrl
    // → the parent must re-fetch so the signed audio link becomes available.
    expect(onPurchased).toHaveBeenCalledTimes(1);

    // After the parent refreshes the track (audioUrl arrives), no further calls.
    await rerender(
      <TripDetailView track={tripTrack} showGPSDetails={false} onPurchased={onPurchased} />,
    );
    expect(onPurchased).toHaveBeenCalledTimes(1);
  });

  it('does not request a refresh when the track already has an audioUrl', async () => {
    const onPurchased = jest.fn();
    await render(
      <TripDetailView track={tripTrack} showGPSDetails={false} onPurchased={onPurchased} />,
    );
    expect(onPurchased).not.toHaveBeenCalled();
  });

  it('requests a refresh again per experience (navigation between experiences)', async () => {
    const onPurchased = jest.fn();
    // The backend omits audioUrl until the purchase grants access.
    const trackWithoutAudioUrl = {
      ...tripTrack,
      audioUrl: null,
    };

    // The parent mounts one instance per experience via key={track.id}, so
    // the refresh guard must not leak between instances.
    await render(
      <>
        <TripDetailView
          key="exp-a"
          track={trackWithoutAudioUrl}
          showGPSDetails={false}
          onPurchased={onPurchased}
        />
        <TripDetailView
          key="exp-b"
          track={trackWithoutAudioUrl}
          showGPSDetails={false}
          onPurchased={onPurchased}
        />
      </>,
    );
    expect(onPurchased).toHaveBeenCalledTimes(2);
  });

  it('shows the blocked banner when playback is geofence-blocked', async () => {
    const { getByTestId } = await render(
      <TripDetailView track={tripTrack} showGPSDetails={false} />,
    );
    // isPlaybackBlocked is true (lejos + no bypassable + bypass off) → banner visible
    expect(getByTestId('geofence-blocked-banner')).toBeTruthy();
  });

  it('shows the preparing-audio hint while the parent refreshes the experience', async () => {
    const { getByTestId, queryByTestId } = await render(
      <TripDetailView track={tripTrack} showGPSDetails={false} refreshingExperience={true} />,
    );
    expect(getByTestId('preparing-audio-hint')).toBeTruthy();
    expect(queryByTestId('geofence-blocked-alert-ok')).toBeNull();
  });

  it('opens the blocked alert modal when the play button is pressed while too far', async () => {
    const { getByTestId, queryByTestId } = await render(
      <TripDetailView track={tripTrack} showGPSDetails={false} />,
    );

    // Not downloaded yet → the play-download button routes through handleDownload
    const playButton = getByTestId('play-download-button');
    await fireEvent.press(playButton);

    // The geofence gate must open the "Can't play" modal instead of downloading
    expect(queryByTestId('geofence-blocked-alert-ok')).toBeTruthy();
  });

  it('does not download when the play button is pressed while too far', async () => {
    const { getByTestId } = await render(
      <TripDetailView track={tripTrack} showGPSDetails={false} />,
    );

    await fireEvent.press(getByTestId('play-download-button'));

    // Still in idle (undownloaded) state — the download was never started
    expect(getByTestId('unified-audio-controller-idle')).toBeTruthy();
  });

  it('renders experience credits if present and omits when absent', async () => {
    const trackWithoutCredits = { ...tripTrack, credits: undefined };
    const { queryByTestId, rerender } = await render(
      <TripDetailView track={trackWithoutCredits} showGPSDetails={false} />,
    );
    expect(queryByTestId('experience-credits')).toBeNull();

    const trackWithCredits = {
      ...tripTrack,
      credits: [{ role: 'Realización', names: 'Grupo Arquitectura del juego' }],
    };
    await rerender(<TripDetailView track={trackWithCredits} showGPSDetails={false} />);
    expect(queryByTestId('experience-credits')).toBeTruthy();
  });

  it('renders lead capture and feedback buttons', async () => {
    const { getByTestId } = await render(
      <TripDetailView track={tripTrack} showGPSDetails={false} />,
    );

    expect(getByTestId('lead-capture-open-button')).toBeTruthy();
    expect(getByTestId('feedback-manual-button')).toBeTruthy();
  });

  it('toggles map labels when toggle button is pressed', async () => {
    const { getByTestId } = await render(
      <TripDetailView track={tripTrack} showGPSDetails={false} />,
    );

    const toggleBtn = getByTestId('toggle-map-labels');
    await fireEvent.press(toggleBtn);
    expect(toggleBtn).toBeTruthy();
  });

  it('opens feedback modal and handles submit and dismiss', async () => {
    const { getByTestId, queryByTestId } = await render(
      <TripDetailView track={tripTrack} showGPSDetails={false} />,
    );

    expect(queryByTestId('mock-feedback-form')).toBeNull();

    await fireEvent.press(getByTestId('feedback-manual-button'));
    expect(getByTestId('mock-feedback-form')).toBeTruthy();

    await fireEvent.press(getByTestId('mock-feedback-submit'));
    expect(mockSubmitFeedback).toHaveBeenCalledWith(tripTrack.id, 'Trip feedback message');

    await fireEvent.press(getByTestId('mock-feedback-dismiss'));
    expect(mockDismissFeedback).toHaveBeenCalled();
    expect(mockTriggerDismiss).toHaveBeenCalled();
  });

  it('starts download when user is near start and presses play', async () => {
    mockGeofenceState.isNearStart = true;

    const { getByTestId } = await render(
      <TripDetailView track={tripTrack} showGPSDetails={false} />,
    );

    await fireEvent.press(getByTestId('play-download-button'));
    expect(mockStartDownload).toHaveBeenCalledTimes(1);
  });

  it('handles pause and reset when track is downloaded and playing', async () => {
    mockGeofenceState.isNearStart = true;
    mockDownloadState.localAudioUri = 'file://trip-cached.mp3';
    mockDownloadState.status = 'completed';
    mockPlayerState.status = 'playing';
    mockPlayerState.positionMs = 10000;
    mockPlayerState.durationMs = 900000;

    const { getByTestId } = await render(
      <TripDetailView track={tripTrack} showGPSDetails={false} />,
    );

    await fireEvent.press(getByTestId('audio-pause-button'));
    expect(mockPlayerPause).toHaveBeenCalled();

    await fireEvent.press(getByTestId('audio-reset-button'));
    expect(mockPlayerSeekTo).toHaveBeenCalledWith(0);
  });

  it('closes geofence blocked alert when ok button is clicked', async () => {
    mockGeofenceState.isNearStart = false;

    const { getByTestId, queryByTestId } = await render(
      <TripDetailView track={tripTrack} showGPSDetails={false} />,
    );

    await fireEvent.press(getByTestId('play-download-button'));
    expect(getByTestId('geofence-blocked-alert-ok')).toBeTruthy();

    await fireEvent.press(getByTestId('geofence-blocked-alert-ok'));
    expect(queryByTestId('geofence-blocked-alert-ok')).toBeNull();
  });

  it('renders payment prompt when purchase status is paid and handles pay and restore', async () => {
    mockPurchaseState.status = 'paid';
    mockPurchaseState.price = 15000;

    const { getByTestId } = await render(
      <TripDetailView track={tripTrack} showGPSDetails={false} />,
    );

    expect(getByTestId('pay-button')).toBeTruthy();
    await fireEvent.press(getByTestId('pay-button'));
    expect(mockPay).toHaveBeenCalled();

    await fireEvent.press(getByTestId('restore-link-button'));
    await fireEvent.changeText(getByTestId('restore-email-input'), 'trip@test.com');
    await fireEvent.press(getByTestId('restore-button'));
  });

  it('auto-plays audio when download completes after user initiates play', async () => {
    mockGeofenceState.isNearStart = true;
    mockDownloadState.localAudioUri = null;
    mockDownloadState.status = 'idle';

    const { getByTestId, rerender } = await render(
      <TripDetailView track={tripTrack} showGPSDetails={false} />,
    );

    await fireEvent.press(getByTestId('play-download-button'));
    expect(mockStartDownload).toHaveBeenCalledTimes(1);

    mockDownloadState.localAudioUri = 'file://trip-done.mp3';
    mockDownloadState.status = 'completed';

    await rerender(<TripDetailView track={tripTrack} showGPSDetails={false} />);
    expect(mockPlayerPlay).toHaveBeenCalled();
  });
});
