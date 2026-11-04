import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  type RenderResult,
} from '@testing-library/react-native';
import type { ReactNode } from 'react';

import {
  WORLD_PATH_PREFIX,
  WORLD_POINTS_DOCUMENT_KEY,
  type GeoBounds,
  type MapDocument,
  type MapReferenceFeature,
} from '@sonora/shared';

import WorldMap from '@/components/map/world-map';
import { useAppTranslation } from '@/hooks/use-translation';
import {
  FOCUS_SETTLE_FALLBACK_MS,
  type MapReferencePress,
  type MapWaitState,
} from '@/components/map/map-view.types';
import { fetchExperiences } from '@/data/experiences';
import type { Experience, TrackExperience, TripExperience } from '@/data/experiences';

/**
 * The translation adapter is the map's one input that can change without a language
 * change: `react-i18next` hands over a new `t` when resources are added and the language
 * is set again (`addResources` does exactly that). The double is the repository's own
 * manual mock — keys echoed, one language — with the one difference that the test can
 * replace `t`, because the adapter's identity is the thing being asked about.
 */
const mockSpecialKeys: Record<string, string> = {
  'components.mediaControls.timeSeparator': ' / ',
  // The one sentence with a number in it, spelled the way the locale spells it, so a
  // test can ask what the walker actually reads while a transfer runs.
  'map.loadingArchiveProgress': 'Downloading the map… {{progress}}%',
};
let mockT: (key: string, options?: Record<string, unknown>) => string = (key, options) => {
  const text = mockSpecialKeys[key] ?? key;
  if (!options) return text;
  return Object.entries(options).reduce(
    (sentence, [name, value]) => sentence.split(`{{${name}}}`).join(String(value)),
    text,
  );
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

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
  /** The hub asks for the references' own weight, which it and no other caller draws. */
  boldReferences?: boolean;
  /** Whether the reference labels draw; the walker can hide them from the filter row. */
  showLabels?: boolean;
  /** Drawn above the map, only once the map can draw. */
  toolbar?: ReactNode;
  /** The caller's own surface while the map cannot draw. */
  renderPending?: (wait: MapWaitState) => ReactNode;
  /** Drawn inside the map's own card, only once the map can draw. */
  overlay?: ReactNode;
  testID?: string;
}

/**
 * The wait the double is in, `null` being a map that can draw.
 *
 * A drawn map unless a test asks for a wait first: the real renderer draws its own
 * wait or the caller's slots, and its slots belong to a map that can already draw.
 * Setting this and re-rendering the world is how a test moves the card from one state
 * to the other, which is the render transition the real map reports.
 */
let mockWait: MapWaitState | null = null;

const mockMapProps: RecordedMapProps[] = [];
jest.mock('@/components/map/experience-map', () => {
  // The factory is hoisted above every import, so the runtime is required here: JSX
  // would reference a binding that does not exist yet.
  const { createElement, Fragment } = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: (props: RecordedMapProps) => {
      mockMapProps.push(props);
      // Drawn: the map owns the slots. Waiting: the caller owns the surface, and the
      // slots do not exist yet — the chips can never render before the map can draw.
      if (mockWait !== null) {
        return createElement(Fragment, null, props.renderPending?.(mockWait) ?? null);
      }
      return createElement(Fragment, null, props.toolbar ?? null, props.overlay ?? null);
    },
  };
});

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
  // The renderer has reported it can draw (the double does so on mount), and that
  // report is what releases the chips.
  await waitFor(() => expect(screen.getByTestId('world-map-filters')).toBeTruthy());
}

/** Draws the world in variant B, where a tap travels before the card opens. */
async function renderVariantB(): Promise<void> {
  mockedFetch.mockResolvedValue(PAYLOAD);
  await render(<WorldMap centerOnSelect />);
  await waitFor(() => expect(mockMapProps.length).toBeGreaterThan(0));
  await waitFor(() => expect(screen.getByTestId('world-map-filters')).toBeTruthy());
}

/**
 * Moves the renderer from the wait it is in to `wait`, as the real map does.
 *
 * The wait is an input of the renderer's card, not a report the parent mirrors, so the
 * card follows it on a render and never on a state write of its own.
 */
async function reportWait(view: RenderResult, wait: MapWaitState | null): Promise<void> {
  mockWait = wait;
  await act(async () => {
    view.rerender(<WorldMap />);
  });
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
    mockWait = null;
    mockedFetch.mockReset();
  });

  it('shows the map is loading until the payload answers', async () => {
    // A request that never settles: the world has nothing to draw and says so.
    mockedFetch.mockReturnValue(new Promise<never>(() => {}));

    await render(<WorldMap />);

    expect(screen.getByTestId('world-map-loading')).toBeTruthy();
    expect(mockMapProps).toHaveLength(0);
    // The card's surface (`bg-backgroundElement`, the one the map's own pending overlay
    // paints) is not observable here: `TwView` resolves `className` into a style the
    // test renderer does not keep. The parity it buys is checked on a device.
    // Nothing to filter yet: the row does not exist, visually or for a screen reader.
    expect(screen.queryByTestId('world-map-filters')).toBeNull();
    expect(screen.queryByLabelText('map.world.filterAll')).toBeNull();
  });

  it('keeps the chips out of the card until the map can draw', async () => {
    mockWait = { stage: 'style', downloading: false, progress: null };
    mockedFetch.mockResolvedValue(PAYLOAD);

    const view = await render(<WorldMap />);
    await waitFor(() => expect(mockMapProps.length).toBeGreaterThan(0));

    // One wait in the card, and no filter row over a card that drew nothing.
    expect(screen.getByTestId('world-map-loading')).toBeTruthy();
    expect(screen.getByText('map.loadingMap')).toBeTruthy();
    expect(screen.queryByTestId('world-map-filters')).toBeNull();
    expect(screen.queryByLabelText('map.world.filterAll')).toBeNull();
    // The stage's own words are the diagnostic's, never the happy path's.
    expect(screen.queryByText('map.loadingStyle')).toBeNull();
    expect(screen.queryByText('map.loadingArchive')).toBeNull();

    await reportWait(view, null);

    // Chips and canvas land together, and the wait is gone.
    expect(screen.queryByTestId('world-map-loading')).toBeNull();
    expect(screen.getByTestId('world-map-filters')).toBeTruthy();
    expect(latestMap().testID).toBe('world-map-canvas');
  });

  it('names a first-time transfer and the progress the platform reports', async () => {
    mockWait = { stage: 'archive', downloading: true, progress: null };
    mockedFetch.mockResolvedValue(PAYLOAD);

    const view = await render(<WorldMap />);
    await waitFor(() => expect(mockMapProps.length).toBeGreaterThan(0));

    // A real transfer with no length yet: the sentence names it and invents no number.
    expect(screen.getByText('map.loadingArchive')).toBeTruthy();
    expect(screen.queryByText('map.loadingMap')).toBeNull();

    await reportWait(view, { stage: 'archive', downloading: true, progress: 0.42 });

    expect(screen.getByText('Downloading the map… 42%')).toBeTruthy();
    expect(screen.queryByTestId('world-map-filters')).toBeNull();
  });

  it('shows one wait and one sentence from the payload to the first drawn tile', async () => {
    // The cache check is pending, which is also the archive stage: same wait, same words.
    mockWait = { stage: 'archive', downloading: false, progress: null };
    mockedFetch.mockResolvedValue(PAYLOAD);

    const view = await render(<WorldMap />);
    await waitFor(() => expect(mockMapProps.length).toBeGreaterThan(0));

    // Exactly one message on screen, and it is the walker's, not a stage's.
    const messages = screen.getAllByText(/map\.loading/);
    expect(messages).toHaveLength(1);
    expect(messages[0].props.children).toBe('map.loadingMap');

    await reportWait(view, null);

    expect(screen.queryByText(/map\.loading/)).toBeNull();
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

  it('says the world has nothing of this format instead of nothing at all', async () => {
    // The payload has places; it is the *filter* that has nothing. Telling the walker
    // "no experiences are published on the map yet" over a world that drew places a
    // moment ago is a sentence about the wrong thing, so the bare map owns a line of
    // its own.
    await renderWith([track]);

    fireEvent.press(screen.getByTestId('world-filter-trip'));

    await waitFor(() => expect(screen.getByTestId('world-map-filtered-empty')).toBeTruthy());
    expect(screen.getByText('map.world.filteredEmpty')).toBeTruthy();
    // Not the world-empty line: that one is the state of a place with nothing published.
    expect(screen.queryByText('map.world.empty')).toBeNull();
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
    // The point names the experience and nothing else: duration and price belong to the
    // preview, where there is room for them.
    expect(points[0].properties.label?.en).toBe(trip.title);
  });

  it('asks its map for the bold reference markers, and for nothing else', async () => {
    await renderWith(PAYLOAD);

    // The hub is the one screen where the experiences have to be told apart from the
    // names they sit among, so it asks for the heavier markers; the basemap's own names
    // are left to the document, not raised or silenced by a switch here.
    expect(latestMap().boldReferences).toBe(true);
    // The flag that used to decide this is gone: no screen selects a look at runtime.
    expect(latestMap()).not.toHaveProperty('labelHierarchy');
  });

  it('hides the experience names when the walker toggles the labels off, and back on', async () => {
    await renderWith(PAYLOAD);

    // The names are on until the walker asks to declutter the crowded frame.
    expect(latestMap().showLabels).toBe(true);

    fireEvent.press(screen.getByTestId('toggle-map-labels'));
    await waitFor(() => expect(latestMap().showLabels).toBe(false));

    fireEvent.press(screen.getByTestId('toggle-map-labels'));
    await waitFor(() => expect(latestMap().showLabels).toBe(true));
  });

  it('draws only through the MapLibre map component and never loads Leaflet', async () => {
    await renderWith(PAYLOAD);

    // The record counts renders, and the wait flipping to drawn is one of them: what
    // this asks is that the run drew through MapLibre and never reached Leaflet.
    expect(mockMapProps.length).toBeGreaterThan(0);
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

    // The reading order of the row: everything, then the guided walks, then the short
    // pieces — a filter row is a reading order, not the format catalogue's order.
    expect(screen.getAllByRole('button').map((chip) => String(chip.props.testID))).toEqual(
      expect.arrayContaining(['world-filter-all', 'world-filter-trip', 'world-filter-track']),
    );
    const chipOrder = screen
      .getAllByRole('button')
      .map((chip) => String(chip.props.testID))
      .filter((id) => id.startsWith('world-filter-'));
    expect(chipOrder).toEqual(['world-filter-all', 'world-filter-trip', 'world-filter-track']);

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

describe('useAppTranslation', () => {
  const emptyKey = 'map.world.empty';

  beforeEach(() => {
    mockT = (key) => mockSpecialKeys[key] ?? key;
  });

  it('follows the text when react-i18next hands over a new t', async () => {
    // The adapter is memoized on what produced the text, and the language is not the
    // only thing that produces it: `addResources` + `changeLanguage` replaces the
    // resources without the language moving, and i18next hands over a new `t`. An
    // adapter memoized on the language alone keeps translating with the `t` it was
    // built on — stale text on a map that was rebuilt for nothing.
    mockT = (key) => `first:${key}`;
    // A render counter as the prop: it changes nothing the adapter reads, so a new
    // identity can only come from the text, and each `rerender` really is a render.
    const view = await renderHook(({ tick }: { tick: number }) => useAppTranslation(), {
      initialProps: { tick: 1 },
    });

    const before = view.result.current.translateKey;
    expect(before(emptyKey)).toBe(`first:${emptyKey}`);

    // Same language, new resources: the text really did change.
    mockT = (key) => `second:${key}`;
    await view.rerender({ tick: 2 });

    expect(view.result.current.translateKey(emptyKey)).toBe(`second:${emptyKey}`);
    // A new adapter, which is what the map's memoized derivations read to know the
    // labels changed.
    expect(view.result.current.translateKey).not.toBe(before);

    // And it does not churn on every render: i18next returns one stable `t` per language
    // and namespace, so a re-render that changed nothing keeps one identity — a new one
    // per render would rebuild the map's style on every render.
    const stable = view.result.current.translateKey;
    await view.rerender({ tick: 3 });
    expect(view.result.current.translateKey).toBe(stable);
  });
});
