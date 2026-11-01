import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import {
  formatPrice,
  WORLD_PATH_PREFIX,
  WORLD_POINTS_DOCUMENT_KEY,
  type GeoBounds,
  type MapDocument,
  type MapReferenceFeature,
} from '@sonora/shared';

import WorldMap from '@/components/map/world-map';
import { FOCUS_SETTLE_FALLBACK_MS, type MapReferencePress } from '@/components/map/map-view.types';
import { fetchExperiences } from '@/data/experiences';
import type { Experience, TrackExperience, TripExperience } from '@/data/experiences';

/**
 * The world draws through the MapLibre renderer and nothing else: the seam is
 * `@/components/map/experience-map`, which is the MapLibre implementation on both
 * platforms, so recording what it receives is how this suite sees what is drawn.
 */
interface RecordedMapProps {
  source: unknown;
  overlays: MapDocument[];
  bounds?: GeoBounds | null;
  center?: [number, number];
  focus?: { latitude: number; longitude: number } | null;
  onFeaturePress?: (reference: MapReferencePress) => void;
  /** What the renderer calls when the flight it ran comes to rest. */
  onFocusSettled?: () => void;
}

const mockMapProps: RecordedMapProps[] = [];
jest.mock('@/components/map/experience-map', () => ({
  __esModule: true,
  default: (props: RecordedMapProps) => {
    mockMapProps.push(props);
    return null;
  },
}));

/**
 * Leaflet is deprecated and this feature must never reach it (S3). The double is
 * virtual because the package is not part of the build the feature ships in: the
 * only way it could be counted here is a module actually asking for it.
 */
const mockLeaflet = { loaded: 0 };
jest.mock(
  'leaflet',
  () => {
    mockLeaflet.loaded += 1;
    return {};
  },
  { virtual: true },
);

/**
 * Only the request is doubled: the payload's own playability rule stays the real
 * one, so what the world draws is what the lists would also accept.
 */
jest.mock('@/data/experiences', () => {
  const actual = jest.requireActual('@/data/experiences');
  return { ...actual, fetchExperiences: jest.fn() };
});

const mockedFetch = jest.mocked(fetchExperiences);

const TRIP_ID = '3f6f3d0a-5a6e-4a1c-9a5e-2f4f0c1d7b11';
const TRACK_ID = '8b1c2d3e-4f50-4a61-8b72-9c8d7e6f5a40';
const FEEDBACK_ID = 'c4a7f2b1-6d3e-4b8a-9c1f-0d2e3a4b5c6d';

/** A trip with two stops: it draws a point and its own path. */
const trip: TripExperience = {
  id: TRIP_ID,
  slug: 'deriva-centro',
  title: 'Deriva del centro',
  description: 'Una deriva por el centro de Umepay.',
  themeKey: 'urban',
  format: 'trip',
  durationSeconds: 2700,
  latitude: -32.212,
  longitude: -64.738,
  free: false,
  price: 1500000,
  currency: 'ARS',
  imageKey: 'trips-deriva-centro-cover',
  geoMode: 'formatDefaultRadius',
  radiusMeters: null,
  audioUrl: null,
  waypoints: [
    {
      id: 'w-1',
      experienceId: TRIP_ID,
      order: 1,
      latitude: -32.214,
      longitude: -64.74,
      radiusMeters: 50,
    },
    {
      id: 'w-2',
      experienceId: TRIP_ID,
      order: 2,
      latitude: -32.216,
      longitude: -64.742,
      radiusMeters: 50,
    },
  ],
};

/** A free track: one origin, no path. */
const track: TrackExperience = {
  id: TRACK_ID,
  slug: 'texto-maga',
  title: 'Texto maga',
  description: '',
  themeKey: 'poetry',
  format: 'track',
  durationSeconds: 45,
  latitude: -32.216,
  longitude: -64.734,
  free: true,
  price: null,
  currency: 'ARS',
  imageKey: 'tracks-texto-maga-cover',
  geoMode: 'unrestricted',
  radiusMeters: null,
  audioUrl: null,
};

/** A payload entry the app cannot open: it is not a place, so it is not a point. */
const feedback: Experience = {
  id: FEEDBACK_ID,
  slug: 'comentarios',
  title: 'Comentarios',
  description: '',
  themeKey: 'urban',
  format: 'general-feedback',
  durationSeconds: 0,
  latitude: -32.21,
  longitude: -64.73,
  free: true,
  imageKey: 'trips-deriva-centro-cover',
  geoMode: 'unrestricted',
  radiusMeters: null,
};

const PAYLOAD: Experience[] = [trip, track, feedback];

/** The props of the map as it was drawn last: one render is one record. */
function latestMap(): RecordedMapProps {
  const props = mockMapProps[mockMapProps.length - 1];
  if (!props) throw new Error('the world map was never drawn');
  return props;
}

function drawnFeatures(): MapReferenceFeature[] {
  return latestMap().overlays.flatMap((document) => document.collection.features);
}

/** The experiences the map is drawing a point for, in draw order. */
function drawnSlugs(): string[] {
  return drawnFeatures()
    .map((feature) => feature.properties.experienceSlug)
    .filter((slug): slug is string => typeof slug === 'string');
}

/** Draws the world once the payload has answered. */
async function renderWith(payload: Experience[]): Promise<void> {
  mockedFetch.mockResolvedValue(payload);
  await render(<WorldMap />);
  await waitFor(() => expect(mockMapProps.length).toBeGreaterThan(0));
}

/** Draws the world in variant B, where a tap travels before the card opens. */
async function renderVariantB(): Promise<void> {
  mockedFetch.mockResolvedValue(PAYLOAD);
  await render(<WorldMap centerOnSelect />);
  await waitFor(() => expect(mockMapProps.length).toBeGreaterThan(0));
}

/** Fires the tap a point makes, as the renderer reports it. */
async function tapPoint(slug: string): Promise<void> {
  await act(async () => {
    latestMap().onFeaturePress?.({
      documentKey: WORLD_POINTS_DOCUMENT_KEY,
      experienceSlug: slug,
    });
  });
}

/** Fires the camera's landing, as the renderer reports the flight it ran. */
async function landFlight(): Promise<void> {
  await act(async () => {
    latestMap().onFocusSettled?.();
  });
}

describe('WorldMap', () => {
  beforeEach(() => {
    mockMapProps.length = 0;
    mockLeaflet.loaded = 0;
    mockedFetch.mockReset();
  });

  it('shows the map is loading until the payload answers', async () => {
    // A request that never settles: the world has nothing to draw and says so.
    mockedFetch.mockReturnValue(new Promise<never>(() => {}));

    await render(<WorldMap />);

    expect(screen.getByTestId('world-map-loading')).toBeTruthy();
    expect(mockMapProps).toHaveLength(0);
  });

  it('says the world could not load and fetches again on retry', async () => {
    mockedFetch.mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce(PAYLOAD);

    await render(<WorldMap />);

    await waitFor(() => expect(screen.getByTestId('world-map-error')).toBeTruthy());
    expect(mockMapProps).toHaveLength(0);

    fireEvent.press(screen.getByTestId('world-map-retry'));

    await waitFor(() => expect(mockMapProps.length).toBeGreaterThan(0));
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    expect(drawnSlugs()).toEqual([trip.slug, track.slug]);
  });

  it('says the place has nothing published instead of drawing an empty canvas', async () => {
    mockedFetch.mockResolvedValue([]);

    await render(<WorldMap />);

    await waitFor(() => expect(screen.getByTestId('world-map-empty')).toBeTruthy());
    expect(screen.getByText('map.world.empty')).toBeTruthy();
    expect(mockMapProps).toHaveLength(0);
  });

  it('draws one point per openable experience and a path for each trip', async () => {
    await renderWith(PAYLOAD);

    expect(screen.getByTestId('world-map')).toBeTruthy();
    // The `general-feedback` entry is not a place the app can open, so it is no point.
    expect(drawnSlugs()).toEqual([trip.slug, track.slug]);
    expect(latestMap().overlays.map((document) => document.key)).toEqual([
      WORLD_POINTS_DOCUMENT_KEY,
      `${WORLD_PATH_PREFIX}${trip.slug}`,
    ]);

    // The points carry their position and the format's colour, and every label is a
    // single line with the title, the duration and the price.
    const points = drawnFeatures().filter((feature) => feature.geometry.type === 'Point');
    expect(points.map((feature) => feature.geometry.coordinates)).toEqual([
      [trip.longitude, trip.latitude],
      [track.longitude, track.latitude],
    ]);
    expect(points[0].properties.label?.en).toBe(
      [trip.title, 'map.world.labelDuration', formatPrice(1500000, 'ARS')].join(' · '),
    );
  });

  it('draws only through the MapLibre map component and never loads Leaflet', async () => {
    await renderWith(PAYLOAD);

    expect(mockMapProps).toHaveLength(1);
    expect(mockLeaflet.loaded).toBe(0);
  });

  it('filters what the map draws by format without moving the camera', async () => {
    await renderWith(PAYLOAD);

    const boundsBefore = latestMap().bounds;
    expect(boundsBefore).not.toBeNull();

    // The three chips, in the words the app uses for them.
    expect(screen.getByLabelText('map.world.filterAll')).toBeTruthy();
    // A format is named once, by the keys the list screens use; the world only owns
    // the words of its own "everything" chip.
    expect(screen.getByLabelText('experiences.types.trip')).toBeTruthy();
    expect(screen.getByLabelText('experiences.types.track')).toBeTruthy();

    fireEvent.press(screen.getByTestId('world-filter-track'));

    await waitFor(() => expect(drawnSlugs()).toEqual([track.slug]));
    // A trip's path is drawn by the trip, so a track-only world has no line at all.
    expect(drawnFeatures().some((feature) => feature.geometry.type === 'LineString')).toBe(false);
    // The frame is the whole world's, not the filtered slice: it never changes under
    // the walker's thumb (and on the web renderer a new box would rebuild the map).
    expect(latestMap().bounds).toEqual(boundsBefore);
    // Still the whole place: the track sits inside a box that also covers the trip.
    const bounds = boundsBefore as GeoBounds;
    expect(bounds.south).toBeLessThanOrEqual(track.latitude);
    expect(bounds.north).toBeGreaterThanOrEqual(trip.latitude);
    expect(bounds.west).toBeLessThanOrEqual(trip.longitude);
    expect(bounds.east).toBeGreaterThanOrEqual(track.longitude);
  });

  it('opens the preview of the experience a tap names', async () => {
    await renderWith(PAYLOAD);

    await act(async () => {
      latestMap().onFeaturePress?.({
        documentKey: WORLD_POINTS_DOCUMENT_KEY,
        experienceSlug: track.slug,
      });
    });

    expect(screen.getByTestId('experience-preview-card')).toBeTruthy();
    expect(screen.getAllByText(track.title).length).toBeGreaterThan(0);
  });

  it('opens nothing for a tap that names no experience, such as a trip path', async () => {
    await renderWith(PAYLOAD);

    await act(async () => {
      latestMap().onFeaturePress?.({ documentKey: `${WORLD_PATH_PREFIX}${trip.slug}` });
    });

    expect(screen.queryByTestId('experience-preview-card')).toBeNull();
  });

  it('travels to the selected point only when the variant asks for it', async () => {
    mockedFetch.mockResolvedValue(PAYLOAD);
    await render(<WorldMap centerOnSelect />);
    await waitFor(() => expect(mockMapProps.length).toBeGreaterThan(0));

    await act(async () => {
      latestMap().onFeaturePress?.({
        documentKey: WORLD_POINTS_DOCUMENT_KEY,
        experienceSlug: track.slug,
      });
    });

    expect(latestMap().focus).toEqual({ latitude: track.latitude, longitude: track.longitude });
  });

  it('opens the card when the flight it started reports its landing', async () => {
    // Variant B is "travel, then show": the card must not cover the camera move it
    // just asked for, and it must arrive when that move is over — on the camera's
    // own signal, never on a clock.
    await renderVariantB();
    jest.useFakeTimers();
    try {
      await tapPoint(track.slug);

      expect(latestMap().focus).toEqual({ latitude: track.latitude, longitude: track.longitude });
      expect(screen.queryByTestId('experience-preview-card')).toBeNull();

      // Time passing is not the signal: just short of the dead-man bound, the card
      // is still waiting for the camera. A walker who pans or pinches during the
      // flight gets the card when the flight lands, not when a timer says so.
      await act(async () => {
        jest.advanceTimersByTime(FOCUS_SETTLE_FALLBACK_MS - 1);
      });
      expect(screen.queryByTestId('experience-preview-card')).toBeNull();

      await landFlight();

      expect(screen.getByTestId('experience-preview-card')).toBeTruthy();
      expect(screen.getAllByText(track.title).length).toBeGreaterThan(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('still opens the card when the renderer never reports the landing', async () => {
    // A renderer that never reports would otherwise eat the tap: the fallback bounds
    // the wait, and it is longer than any flight so it can never race one.
    await renderVariantB();
    jest.useFakeTimers();
    try {
      await tapPoint(track.slug);

      await act(async () => {
        jest.advanceTimersByTime(FOCUS_SETTLE_FALLBACK_MS);
      });

      expect(screen.getByTestId('experience-preview-card')).toBeTruthy();
      expect(screen.getAllByText(track.title).length).toBeGreaterThan(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('replaces the wait when a second tap names another point', async () => {
    await renderVariantB();
    jest.useFakeTimers();
    try {
      await tapPoint(track.slug);
      await tapPoint(trip.slug);

      // The camera is now travelling to the second point, and the wait with it: the
      // walker never gets the card of the point they did not choose last.
      expect(latestMap().focus).toEqual({ latitude: trip.latitude, longitude: trip.longitude });
      await act(async () => {
        jest.advanceTimersByTime(FOCUS_SETTLE_FALLBACK_MS - 1);
      });
      expect(screen.queryByTestId('experience-preview-card')).toBeNull();
      expect(screen.queryByText(track.title)).toBeNull();

      await landFlight();

      expect(screen.getAllByText(trip.title).length).toBeGreaterThan(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('clears the flight and the card on dismiss, and travels again for the same point', async () => {
    await renderVariantB();
    await tapPoint(track.slug);
    await landFlight();
    expect(screen.getByTestId('experience-preview-card')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('experience-preview-close'));
    });

    expect(screen.queryByTestId('experience-preview-card')).toBeNull();
    // Dismissed is not pending: the camera owes nothing, so a walker's own pan is
    // not mistaken for a landing.
    expect(latestMap().focus).toBeNull();

    // The same point again is a new request: the id is what keeps it from looking
    // like no change at all.
    await tapPoint(track.slug);
    expect(latestMap().focus).toEqual({ latitude: track.latitude, longitude: track.longitude });
    expect(screen.queryByTestId('experience-preview-card')).toBeNull();

    await landFlight();

    expect(screen.getByTestId('experience-preview-card')).toBeTruthy();
  });

  it('leaves the camera alone when the variant does not ask for it', async () => {
    await renderWith(PAYLOAD);

    await act(async () => {
      latestMap().onFeaturePress?.({
        documentKey: WORLD_POINTS_DOCUMENT_KEY,
        experienceSlug: track.slug,
      });
    });

    expect(latestMap().focus).toBeNull();
  });
});
