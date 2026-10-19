import { act, fireEvent, render } from '@testing-library/react-native';

import type { MapDocument } from '@sonora/shared';

import type { MapReferencePress } from '@/components/map/map-view.types';
import ExperienceMapSwitch from '@/components/map/experience-map-switch';
import TripDetailView from '@/components/trip-detail-view';
import type { TrackExperience, TripExperience } from '@/data/experiences';

// Recorders for the two renderers the switch can mount. The names start with
// `mock` because the jest.mock factories are hoisted above the declarations.
const mockExperienceMapProps: Record<string, unknown>[] = [];
jest.mock('@/components/map/experience-map', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockExperienceMapProps.push(props);
    return null;
  },
}));

const mockTrackDetailMapProps: Record<string, unknown>[] = [];
jest.mock('@/components/track-detail-map', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockTrackDetailMapProps.push(props);
    return null;
  },
}));

// ---------------------------------------------------------------------------
// TripDetailView dependencies (mirrors the geofence-gate suite).
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
jest.mock('@/hooks/use-purchase', () => ({
  usePurchase: () => [
    mockPurchaseState,
    { pay: jest.fn(), restore: jest.fn(), refresh: jest.fn(), checkStatus: jest.fn() },
  ],
}));

const mockGeofenceState = {
  isNearStart: false,
  gpsAccuracy: 12,
  gpsStatus: 'ready',
  distanceMeters: 250,
  requiredRadiusMeters: 50,
  userCoordinates: { latitude: -34.61, longitude: -58.39 } as {
    latitude: number;
    longitude: number;
  } | null,
  errorMsg: null as string | null,
};
jest.mock('@/hooks/use-offline-geofence', () => ({
  useOfflineGeofence: () => mockGeofenceState,
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

jest.mock('@/hooks/use-audio-rewind', () => ({ useAudioRewind: () => jest.fn() }));
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
jest.mock('@/store/remote-config-store', () => ({
  useRemoteConfigStore: (selector: (state: unknown) => unknown) =>
    selector({ config: { geofence: { bypassGeofence: false }, map: undefined } }),
}));
jest.mock('@/services/payment-client', () => ({ PaymentClient: { logAccess: jest.fn() } }));
jest.mock('@/storage/app-storage', () => ({ getUserEmail: jest.fn().mockResolvedValue(null) }));
jest.mock('@/components/feedback-form', () => ({ __esModule: true, default: () => null }));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const source = { archiveUrl: 'https://api.example/media/public/tiles/x/v1.pmtiles' };
const userCoordinates = { latitude: -34.61, longitude: -58.39 };

const track: TrackExperience = {
  id: 'track-1',
  slug: 'sendero-uno',
  title: 'Sendero',
  description: '',
  themeKey: 'birds',
  durationSeconds: 900,
  latitude: -32.211913,
  longitude: -64.73809,
  free: true,
  price: null,
  imageKey: 'tracks-pajaros-chiricotes-cover',
  format: 'track',
  audioUrl: null,
  geoMode: 'unrestricted',
  radiusMeters: null,
};

const trip: TripExperience = {
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
  audioUrl: null,
  geoMode: 'formatDefaultRadius',
  radiusMeters: null,
  waypoints: [
    {
      id: 'w1',
      experienceId: 'trip-1',
      order: 1,
      latitude: -34.6038,
      longitude: -58.3817,
      radiusMeters: 50,
    },
    {
      id: 'w2',
      experienceId: 'trip-1',
      order: 2,
      latitude: -34.6039,
      longitude: -58.3818,
      radiusMeters: 50,
    },
  ],
  mapDocuments: [
    {
      key: 'referencias',
      scope: 'experience',
      collection: { type: 'FeatureCollection', features: [] },
    },
  ],
};

describe('ExperienceMapSwitch', () => {
  beforeEach(() => {
    mockExperienceMapProps.length = 0;
    mockTrackDetailMapProps.length = 0;
  });

  it('draws the itinerary plus the experience documents with the maplibre renderer', async () => {
    await render(
      <ExperienceMapSwitch
        renderer="maplibre"
        source={source}
        experience={trip}
        userCoordinates={userCoordinates}
        showLabels={false}
      />,
    );

    expect(mockTrackDetailMapProps).toHaveLength(0);
    expect(mockExperienceMapProps).toHaveLength(1);
    const props = mockExperienceMapProps[0];
    const overlays = props.overlays as MapDocument[];

    expect(overlays.map((overlay) => overlay.key)).toEqual(['itinerary', 'referencias']);
    expect(props.source).toBe(source);
    expect(props.showLabels).toBe(false);
    expect(props.userCoordinates).toEqual(userCoordinates);

    const features = overlays[0].collection.features;
    // origin + two waypoints + the walker position
    expect(features.filter((feature) => feature.geometry.type === 'Point')).toHaveLength(4);
    const line = features.find((feature) => feature.geometry.type === 'LineString');
    expect(line?.geometry.coordinates).toEqual([
      [-58.3816, -34.6037],
      [-58.3817, -34.6038],
      [-58.3818, -34.6039],
    ]);
  });

  it('forwards the experience geo data to the leaflet renderer', async () => {
    await render(
      <ExperienceMapSwitch
        renderer="leaflet"
        source={source}
        experience={trip}
        userCoordinates={userCoordinates}
        showLabels={false}
      />,
    );

    expect(mockExperienceMapProps).toHaveLength(0);
    expect(mockTrackDetailMapProps).toHaveLength(1);
    expect(mockTrackDetailMapProps[0]).toMatchObject({
      latitude: -34.6037,
      longitude: -58.3816,
      userLatitude: -34.61,
      userLongitude: -58.39,
      showLabels: false,
    });
    expect(mockTrackDetailMapProps[0].waypoints).toHaveLength(2);
  });

  it('draws only the origin for a track with no waypoints', async () => {
    await render(<ExperienceMapSwitch renderer="maplibre" source={source} experience={track} />);

    const overlays = mockExperienceMapProps[0].overlays as MapDocument[];
    const features = overlays[0].collection.features;

    expect(features.filter((feature) => feature.geometry.type === 'Point')).toHaveLength(1);
    expect(features.some((feature) => feature.geometry.type === 'LineString')).toBe(false);
  });
});

describe('TripDetailView map', () => {
  beforeEach(() => {
    mockExperienceMapProps.length = 0;
    mockTrackDetailMapProps.length = 0;
    mockGeofenceState.userCoordinates = { latitude: -34.61, longitude: -58.39 };
  });

  it('mounts the switch with the trip waypoints and keeps the labels toggle', async () => {
    const view = await render(<TripDetailView track={trip} showGPSDetails={false} />);

    expect(mockTrackDetailMapProps).toHaveLength(1);
    expect(mockTrackDetailMapProps[0].waypoints).toHaveLength(2);
    expect(mockTrackDetailMapProps[0].showLabels).toBe(true);
    // The Leaflet map gets the walker position so it can draw and fit it.
    expect(mockTrackDetailMapProps[0].userLatitude).toBe(-34.61);

    const toggle = view.getByTestId('toggle-map-labels');
    await fireEvent.press(toggle);

    const last = mockTrackDetailMapProps[mockTrackDetailMapProps.length - 1];
    expect(last.showLabels).toBe(false);
  });

  it('opens the reference card when the map reports a tap on a reference', async () => {
    const view = await render(
      <ExperienceMapSwitch renderer="maplibre" source={source} experience={trip} />,
    );

    expect(view.queryByTestId('reference-card')).toBeNull();

    const onFeaturePress = mockExperienceMapProps[0].onFeaturePress as (
      reference: MapReferencePress,
    ) => void;
    await act(async () => {
      onFeaturePress({
        documentKey: 'referencias',
        label: 'Centro Umepay',
        // Cards need content, not just a label (D8): a label-only feature is
        // drawing, so this fixture carries the description a real one has.
        descriptionKey: 'map.centroUmepay.description',
      });
    });

    expect(view.getByTestId('reference-card')).toBeTruthy();
    expect(view.getByText('Centro Umepay')).toBeTruthy();
  });

  it('closes the card when it is dismissed and reopens it with the next tapped reference', async () => {
    const view = await render(
      <ExperienceMapSwitch renderer="maplibre" source={source} experience={trip} />,
    );

    const onFeaturePress = mockExperienceMapProps[0].onFeaturePress as (
      reference: MapReferencePress,
    ) => void;
    await act(async () => {
      onFeaturePress({
        documentKey: 'referencias',
        label: 'Centro Umepay',
        descriptionKey: 'map.centroUmepay.description',
      });
    });

    expect(view.getByTestId('reference-card')).toBeTruthy();
    expect(view.getByText('Centro Umepay')).toBeTruthy();

    await fireEvent.press(view.getByTestId('bottom-modal-dismiss-button'));

    // Dismissing must clear the switch's state, not just hide the shell.
    expect(view.queryByTestId('reference-card')).toBeNull();
    expect(view.queryByText('Centro Umepay')).toBeNull();

    await act(async () => {
      onFeaturePress({
        documentKey: 'referencias',
        label: 'Taller',
        descriptionKey: 'map.taller.description',
      });
    });

    // A later tap opens the card again, showing the new reference and only it.
    expect(view.getByTestId('reference-card')).toBeTruthy();
    expect(view.getByText('Taller')).toBeTruthy();
    expect(view.queryByText('Centro Umepay')).toBeNull();
  });

  it('ignores a tap on the itinerary, which is drawing and not a reference', async () => {
    const view = await render(
      <ExperienceMapSwitch renderer="maplibre" source={source} experience={trip} />,
    );

    const onFeaturePress = mockExperienceMapProps[0].onFeaturePress as (
      reference: MapReferencePress,
    ) => void;
    await act(async () => {
      // The itinerary document carries a label and nothing else, so this press
      // also carries real card content: with a description in place the card's
      // own content rule would open it, and only the switch guard keeps it shut.
      onFeaturePress({
        documentKey: 'itinerary',
        label: 'Pt 1',
        labelKey: 'map.point',
        descriptionKey: 'map.centroUmepay.description',
      });
    });

    expect(view.queryByTestId('reference-card')).toBeNull();
  });
});
