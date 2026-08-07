import { render, fireEvent } from '@testing-library/react-native';

import TripDetailView from '@/components/trip-detail-view';
import type { TripExperience } from '@/data/experiences';

// ---------------------------------------------------------------------------
// Mocks — isolate the geofence gate from its data sources.
// ---------------------------------------------------------------------------
jest.mock('@/hooks/use-purchase', () => ({
  usePurchase: () => [
    {
      status: 'purchased',
      free: false,
      price: 15000,
      purchaseId: 'p-1',
      error: null,
      paying: false,
      restoring: false,
      polling: false,
    },
    { pay: jest.fn(), restore: jest.fn(), refresh: jest.fn(), checkStatus: jest.fn() },
  ],
}));

const geofenceCallArgs: unknown[] = [];
jest.mock('@/hooks/use-offline-geofence', () => ({
  useOfflineGeofence: (...args: unknown[]) => {
    geofenceCallArgs.push(args);
    return {
      isNearStart: false,
      gpsAccuracy: 12,
      gpsStatus: 'ready',
      distanceMeters: 250,
      requiredRadiusMeters: 50,
      userCoordinates: { latitude: -34.61, longitude: -58.39 },
      errorMsg: null,
    };
  },
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
    setMediaMetadata: jest.fn(),
  }),
}));

jest.mock('@/hooks/use-confirm', () => ({
  useConfirm: () => ({ confirm: jest.fn().mockResolvedValue(true), component: null }),
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
  }),
}));

jest.mock('@/store/remote-config-store', () => ({
  useRemoteConfigStore: (
    selector: (s: { config: { geofence: { bypassGeofence: boolean } } }) => unknown,
  ) => selector({ config: { geofence: { bypassGeofence: false } } }),
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

jest.mock('@/components/feedback-form', () => ({
  __esModule: true,
  default: () => null,
}));

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
  geoMode: 'type',
  radiusMeters: null,
  waypoints: [],
};

describe('TripDetailView geofence gate (post-purchase, too far)', () => {
  beforeEach(() => {
    geofenceCallArgs.length = 0;
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
    expect(lastCall[1]).toEqual({ format: 'trip', geoMode: 'type', radiusMeters: null });
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
});
