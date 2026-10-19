import { render } from '@testing-library/react-native';

import ExperienceMapSwitch from '@/components/map/experience-map-switch';
import type { TripExperience } from '@/data/experiences';

// `@/components/map/experience-map` resolves to the native facade
// (`experience-map.tsx`) under jest; the web component is always imported as
// `@/components/map/experience-map.web`. The switch is mounted for real and only
// its Leaflet leaf is recorded, so this suite proves what the native facade
// forwards once the switch routes a trip through the maplibre branch.
const mockTrackDetailMapProps: Record<string, unknown>[] = [];
jest.mock('@/components/track-detail-map', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockTrackDetailMapProps.push(props);
    return null;
  },
}));

const source = { archiveUrl: 'https://api.example/media/public/tiles/x/v1.pmtiles' };
const userCoordinates = { latitude: -34.61, longitude: -58.39 };

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

describe('native ExperienceMap facade', () => {
  beforeEach(() => {
    mockTrackDetailMapProps.length = 0;
  });

  it('forwards the trip waypoints and label toggle to the leaflet map on the maplibre branch', async () => {
    await render(
      <ExperienceMapSwitch
        renderer="maplibre"
        source={source}
        experience={trip}
        userCoordinates={userCoordinates}
        showLabels={false}
      />,
    );

    expect(mockTrackDetailMapProps).toHaveLength(1);
    expect(mockTrackDetailMapProps[0]).toMatchObject({
      latitude: -34.6037,
      longitude: -58.3816,
      userLatitude: -34.61,
      userLongitude: -58.39,
      showLabels: false,
    });
    const waypoints = mockTrackDetailMapProps[0].waypoints as {
      latitude: number;
      longitude: number;
    }[];
    expect(waypoints.map(({ latitude, longitude }) => ({ latitude, longitude }))).toEqual([
      { latitude: -34.6038, longitude: -58.3817 },
      { latitude: -34.6039, longitude: -58.3818 },
    ]);
  });
});
