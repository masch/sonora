import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import type { StyleSpecification } from 'maplibre-gl';
import { en, es, type MapDocument } from '@sonora/shared';

import ExperienceMap from '@/components/map/experience-map';
import ExperienceMapSwitch from '@/components/map/experience-map-switch';
import type { TripExperience } from '@/data/experiences';
import { useMapArchiveFile } from '@/hooks/use-map-archive-file';

// The archive lives on the device: `use-map-archive-file` owns the download (and
// its own suite), so this suite only drives the states it hands back.
jest.mock('@/hooks/use-map-archive-file', () => ({ useMapArchiveFile: jest.fn() }));

// The switch still renders the Leaflet branch for `renderer="leaflet"`; its WebView
// is a native module and is not what this suite is about.
jest.mock('@/components/track-detail-map', () => ({ __esModule: true, default: () => null }));

// `use-app-translation` hands the component a brand-new `t` wrapper on every
// render (the hook wraps i18next's `t` in a new closure). The style must not be
// rebuilt by that, so the suite records every `t` it was given and hands the real
// hook through unchanged.
jest.mock('@/hooks/use-translation', () => {
  const actual = jest.requireActual('@/hooks/use-translation');
  const handed: unknown[] = [];
  return {
    ...actual,
    handedTranslate: handed,
    useAppTranslation: () => {
      const value = actual.useAppTranslation();
      handed.push(value.t);
      return value;
    },
  };
});

// `@maplibre/maplibre-react-native` is a native module; jest maps it to the
// `src/test-utils/maplibre-react-native-double.tsx` components, and the recorders
// the components write to — the style, the camera and the press handling the
// component hands to the map — live in the sibling `.ts` module.
import {
  mockCameraProps,
  mockHit,
  mockMapProps,
  mockMapStyles,
  mockQueryRenderedFeatures,
  resetMapDouble,
} from '@/test-utils/maplibre-react-native-double';

const mockedUseMapArchiveFile = jest.mocked(useMapArchiveFile);

/** Every `t` the mocked hook handed to a component, in call order. */
const { handedTranslate } = jest.requireMock('@/hooks/use-translation') as {
  handedTranslate: unknown[];
};

const ARCHIVE_URL = 'https://api.example/media/public/tiles/calamuchita/v1.pmtiles';
/** The file `use-map-archive-file` resolves for that archive, in its transport scheme. */
const ARCHIVE_URI =
  'pmtiles://file:///document/map-archives/d814a122-media-public-tiles-calamuchita-v1-pmtiles.pmtiles';
const STYLE_URL = 'https://api.example/media/public/styles/calamuchita/v1.json';

const document: MapDocument = {
  key: 'umepay',
  scope: 'experience',
  collection: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-64.738, -32.212] },
        properties: {
          labelKey: 'map.references.taller',
          descriptionKey: 'map.references.taller.description',
          imageUrl: 'https://api.example/media/public/reference-images/taller.jpg',
          linkUrl: 'https://www.instagram.com/sonora.derivapoetica',
        },
      },
    ],
  },
};

/** A style as the R2 document serves it: the basemap still points at the remote archive. */
function styleWith(glyphs: boolean): StyleSpecification {
  return {
    version: 8,
    ...(glyphs
      ? { glyphs: 'https://api.example/media/public/glyphs/{fontstack}/{range}.pbf' }
      : {}),
    sources: { basemap: { type: 'vector', url: ARCHIVE_URL } },
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#ffffff' } }],
  } as StyleSpecification;
}

/** The layer ids the map was told to draw, in draw order. */
function drawnLayerIds(index = 0): string[] {
  return (mockMapProps[index].mapStyle.layers ?? []).map((layer) => layer.id);
}

/** The GeoJSON data the style carries for a reference document. */
function drawnFeatures(documentKey: string) {
  const source = mockMapProps[0].mapStyle.sources?.[`refs:${documentKey}`] as
    { data?: { features?: { properties?: Record<string, unknown> }[] } } | undefined;
  return source?.data?.features ?? [];
}

describe('ExperienceMap (native)', () => {
  beforeEach(() => {
    resetMapDouble();
    mockedUseMapArchiveFile.mockReset();
    mockedUseMapArchiveFile.mockReturnValue({ status: 'ready', uri: ARCHIVE_URI });
  });

  it('draws the reference layers over the archive on disk', async () => {
    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, style: styleWith(true) }}
        overlays={[document]}
      />,
    );

    expect(mockMapProps).toHaveLength(1);
    expect(mockMapProps[0].mapStyle.sources?.basemap).toMatchObject({
      type: 'vector',
      url: ARCHIVE_URI,
    });
    // The base layers survive; the reference layers are added on top of them.
    expect(drawnLayerIds()).toEqual([
      'background',
      'refs:umepay:fill',
      'refs:umepay:line',
      'refs:umepay:circle',
      'refs:umepay:label',
    ]);
    // Labels are resolved before drawing: MapLibre cannot call the translation layer.
    expect(drawnFeatures('umepay')[0].properties?.label).toBe('map.references.taller');
  });

  it('adds and removes the label layer with the labels toggle', async () => {
    const source = { archiveUrl: ARCHIVE_URL, style: styleWith(true) };
    const view = await render(<ExperienceMap source={source} overlays={[document]} />);

    expect(drawnLayerIds()).toContain('refs:umepay:label');

    await act(async () => {
      view.rerender(<ExperienceMap source={source} overlays={[document]} showLabels={false} />);
    });

    expect(drawnLayerIds()).not.toContain('refs:umepay:label');
    expect(drawnLayerIds()).toContain('refs:umepay:circle');

    await act(async () => {
      view.rerender(<ExperienceMap source={source} overlays={[document]} showLabels />);
    });

    expect(drawnLayerIds()).toContain('refs:umepay:label');
  });

  it('keeps the style it drew across a re-render and rebuilds it for the labels toggle', async () => {
    const source = { archiveUrl: ARCHIVE_URL, style: styleWith(true) };
    const overlays = [document];
    const handedBefore = handedTranslate.length;

    const view = await render(<ExperienceMap source={source} overlays={overlays} />);

    expect(mockMapStyles).toHaveLength(1);
    const drawn = mockMapStyles[0];

    await act(async () => {
      // The switch rebuilds the itinerary document on every render, so the map is
      // handed a new array (and the hook a new `t`) with the same content.
      view.rerender(<ExperienceMap source={source} overlays={[{ ...document }]} />);
    });

    // A fresh `t` per render is what the app's hook does: it must not reach the style.
    expect(handedTranslate.length).toBeGreaterThanOrEqual(handedBefore + 2);
    expect(handedTranslate[handedTranslate.length - 1]).not.toBe(handedTranslate[handedBefore]);
    // A new style object makes MapLibre re-apply the style and re-fetch its tiles.
    expect(mockMapStyles).toHaveLength(2);
    expect(mockMapStyles[1]).toBe(drawn);

    await act(async () => {
      view.rerender(<ExperienceMap source={source} overlays={overlays} showLabels={false} />);
    });

    // The labels toggle is an input of the style, so that one does rebuild it.
    expect(mockMapStyles).toHaveLength(3);
    expect(mockMapStyles[2]).not.toBe(drawn);
    expect((mockMapStyles[2].layers ?? []).map((layer) => layer.id)).not.toContain(
      'refs:umepay:label',
    );
  });

  it('redraws a document whose content changed without a version bump', async () => {
    // The itinerary the switch derives carries no version: its content is the only
    // signal that the walker moved, so it has to reach the style.
    const source = { archiveUrl: ARCHIVE_URL, style: styleWith(true) };
    const view = await render(<ExperienceMap source={source} overlays={[document]} />);

    const moved: MapDocument = {
      ...document,
      collection: {
        ...document.collection,
        features: [
          {
            ...document.collection.features[0],
            geometry: { type: 'Point', coordinates: [-64.74, -32.21] },
          },
        ],
      },
    };

    await act(async () => {
      view.rerender(<ExperienceMap source={source} overlays={[moved]} />);
    });

    expect(mockMapStyles).toHaveLength(2);
    expect(mockMapStyles[1]).not.toBe(mockMapStyles[0]);
    expect(JSON.stringify(mockMapStyles[1].sources?.['refs:umepay'])).toContain('-64.74');
    expect(JSON.stringify(mockMapStyles[0].sources?.['refs:umepay'])).not.toContain('-64.74');
  });

  it('draws no label layer when the style provides no glyphs', async () => {
    // A symbol layer without a glyphs source fails to parse on the device.
    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, style: styleWith(false) }}
        overlays={[document]}
      />,
    );

    expect(drawnLayerIds()).toEqual([
      'background',
      'refs:umepay:fill',
      'refs:umepay:line',
      'refs:umepay:circle',
    ]);
  });

  it('shows the loading state while the archive is not ready', async () => {
    mockedUseMapArchiveFile.mockReturnValue({ status: 'loading' });

    const view = await render(
      <ExperienceMap source={{ archiveUrl: ARCHIVE_URL, style: styleWith(true) }} overlays={[]} />,
    );

    // The loader names the stage that is pending, so a screenshot answers the question.
    expect(view.queryByText('map.loadingArchive')).toBeTruthy();
    // Nothing can be drawn over an archive that does not exist yet.
    expect(mockMapProps).toHaveLength(0);
  });

  it('shows the error state when the archive fails', async () => {
    mockedUseMapArchiveFile.mockReturnValue({ status: 'error', error: 'archive download failed' });

    const view = await render(
      <ExperienceMap source={{ archiveUrl: ARCHIVE_URL, style: styleWith(true) }} overlays={[]} />,
    );

    expect(view.queryByTestId('experience-map-error')).toBeTruthy();
    expect(view.queryByText('archive download failed')).toBeTruthy();
    expect(mockMapProps).toHaveLength(0);
  });

  it('loads the configured style before handing it to the map', async () => {
    // The remote config only carries a style url, so the document is fetched.
    const fetchStyle = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => styleWith(true),
    });
    globalThis.fetch = fetchStyle as unknown as typeof fetch;

    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, styleUrl: STYLE_URL }}
        overlays={[document]}
      />,
    );

    await waitFor(() => expect(mockMapProps).toHaveLength(1));

    expect(fetchStyle).toHaveBeenCalledWith(STYLE_URL);
    expect(mockMapProps[0].mapStyle.sources?.basemap).toMatchObject({ url: ARCHIVE_URI });
    expect(drawnLayerIds()).toContain('refs:umepay:label');
  });

  it('shows the error state when the style cannot be fetched', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' }) as never;

    const view = await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, styleUrl: `${STYLE_URL}?broken` }}
        overlays={[]}
      />,
    );

    await waitFor(() => expect(view.queryByTestId('experience-map-error')).toBeTruthy());
    expect(mockMapProps).toHaveLength(0);
  });

  it('bounds the style wait and names the style when the request never resolves', async () => {
    jest.useFakeTimers();
    try {
      // A style request that never answers: the first-visit hang, where the only way
      // out of the spinner was leaving the screen and coming back.
      globalThis.fetch = jest.fn(() => new Promise(() => {})) as never;

      const view = await render(
        <ExperienceMap
          source={{ archiveUrl: ARCHIVE_URL, styleUrl: `${STYLE_URL}?hang` }}
          overlays={[]}
        />,
      );

      expect(view.queryByText('map.loadingStyle')).toBeTruthy();

      // Ten seconds, no more and no less: still waiting one millisecond short.
      await act(async () => {
        jest.advanceTimersByTime(9_999);
      });
      expect(view.queryByTestId('experience-map-error')).toBeNull();

      await act(async () => {
        jest.advanceTimersByTime(1);
      });

      expect(view.queryByTestId('experience-map-error')).toBeTruthy();
      // The message names the stage that stalled: the style, not the archive.
      expect(view.queryByText('the map style did not load')).toBeTruthy();
      expect(mockMapProps).toHaveLength(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('caches the style even when the screen remounts while it is loading', async () => {
    // The device bug: leaving and returning was the only way to see the map, because
    // each mount abandoned its own request before it could cache the style.
    let resolveStyle = (_response: unknown) => {};
    const pending = new Promise((resolve) => {
      resolveStyle = resolve;
    });
    globalThis.fetch = jest.fn().mockReturnValueOnce(pending) as never;

    const source = { archiveUrl: ARCHIVE_URL, styleUrl: `${STYLE_URL}?remount` };
    const first = await render(<ExperienceMap source={source} overlays={[]} />);
    await first.unmount();

    await render(<ExperienceMap source={source} overlays={[]} />);

    await act(async () => {
      resolveStyle({ ok: true, json: async () => styleWith(true) });
    });

    await waitFor(() => expect(mockMapProps.length).toBeGreaterThan(0));
    // One request for the page, not one per mount.
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries both waits from the error state and draws once they resolve', async () => {
    let resolveStyle = (_response: unknown) => {};
    const styleGate = new Promise((resolve) => {
      resolveStyle = resolve;
    });
    const fetchStyle = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Service Unavailable' })
      .mockReturnValueOnce(styleGate);
    globalThis.fetch = fetchStyle as unknown as typeof fetch;

    // The archive failed on the first attempt; the retry has to start it over, so
    // the double answers by attempt instead of always failing.
    mockedUseMapArchiveFile.mockImplementation((_archiveUrl, attempt) =>
      (attempt ?? 0) > 0
        ? { status: 'ready', uri: ARCHIVE_URI }
        : { status: 'error', error: 'UnableToDownload: 503 Service Unavailable' },
    );

    const view = await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, styleUrl: `${STYLE_URL}?retry` }}
        overlays={[document]}
      />,
    );

    await waitFor(() => expect(view.queryByTestId('experience-map-retry')).toBeTruthy());
    // The stage that failed stays visible next to the retry.
    expect(view.queryByText('UnableToDownload: 503 Service Unavailable')).toBeTruthy();
    expect(mockMapProps).toHaveLength(0);

    await act(async () => {
      fireEvent.press(view.getByTestId('experience-map-retry'));
    });

    // Back into loading, not into the failure that was just dismissed — and now the
    // stage that is pending is the style, because the archive came back on retry.
    expect(view.queryByText('map.loadingStyle')).toBeTruthy();
    expect(view.queryByTestId('experience-map-error')).toBeNull();

    await act(async () => {
      resolveStyle({ ok: true, json: async () => styleWith(true) });
      await styleGate;
    });

    await waitFor(() => expect(mockMapProps).toHaveLength(1));

    // Both waits really restarted: the style was fetched a second time and the
    // archive hook was asked again under a new attempt.
    expect(fetchStyle).toHaveBeenCalledTimes(2);
    expect(fetchStyle).toHaveBeenLastCalledWith(`${STYLE_URL}?retry`);
    expect(mockedUseMapArchiveFile).toHaveBeenLastCalledWith(ARCHIVE_URL, 1);
    expect(mockMapProps[0].mapStyle.sources?.basemap).toMatchObject({ url: ARCHIVE_URI });
  });

  it('restarts only the wait that failed', async () => {
    // A url of its own: the style cache is per page, so a url another case loaded
    // would answer from it instead of failing.
    const styleFetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Service Unavailable' })
      .mockResolvedValueOnce({ ok: true, json: async () => styleWith(true) });
    globalThis.fetch = styleFetch as unknown as typeof fetch;
    const source = { archiveUrl: ARCHIVE_URL, styleUrl: `${STYLE_URL}?s` };

    const view = await render(<ExperienceMap source={source} overlays={[document]} />);
    await waitFor(() => expect(view.queryByTestId('experience-map-retry')).toBeTruthy());
    await act(() => {
      fireEvent.press(view.getByTestId('experience-map-retry'));
    });

    // The style was asked again; the archive was never restarted.
    await waitFor(() => expect(mockMapProps).toHaveLength(1));
    expect(styleFetch).toHaveBeenCalledTimes(2);
    expect(mockedUseMapArchiveFile).toHaveBeenLastCalledWith(ARCHIVE_URL, 0);
  });

  it('reports the tapped reference with the same shape the web build emits', async () => {
    const onFeaturePress = jest.fn();
    mockHit('refs:umepay:circle', {
      labelKey: 'map.references.taller',
      descriptionKey: 'map.references.taller.description',
      imageUrl: 'https://api.example/media/public/reference-images/taller.jpg',
      linkUrl: 'https://www.instagram.com/sonora.derivapoetica',
      label: 'map.references.taller',
    });

    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, style: styleWith(true) }}
        overlays={[document]}
        onFeaturePress={onFeaturePress}
      />,
    );

    await act(async () => {
      await mockMapProps[0].onPress?.({ nativeEvent: { point: [40, 60], lngLat: [-64.7, -32.2] } });
    });

    expect(mockQueryRenderedFeatures).toHaveBeenCalled();
    expect(onFeaturePress).toHaveBeenCalledWith({
      documentKey: 'umepay',
      label: 'map.references.taller',
      labelKey: 'map.references.taller',
      descriptionKey: 'map.references.taller.description',
      imageUrl: 'https://api.example/media/public/reference-images/taller.jpg',
      linkUrl: 'https://www.instagram.com/sonora.derivapoetica',
    });
  });

  it('labels the loaded map itself instead of announcing a loading state', async () => {
    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, style: styleWith(true) }}
        overlays={[document]}
      />,
    );

    // A screen reader must not hear "loading map" over a map that already drew.
    expect(mockMapProps[0].accessibilityLabel).toBe('map.mapLabel');
    expect(mockMapProps[0].accessibilityLabel).not.toBe('map.loadingMap');
    // The label it names exists in both locales, spelled as the reader hears it.
    expect(es.map.mapLabel).toBe('Mapa');
    expect(en.map.mapLabel).toBe('Map');
  });

  it('asks the map for the features inside the 44x44 target around the press', async () => {
    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, style: styleWith(true) }}
        overlays={[document]}
        onFeaturePress={jest.fn()}
      />,
    );

    await act(async () => {
      await mockMapProps[0].onPress?.({ nativeEvent: { point: [40, 60], lngLat: [-64.7, -32.2] } });
    });

    // The box the real map is asked about: a 44x44 square around the press
    // (22 pixels each way), corners in [[top-left], [bottom-right]] order, for the
    // topmost reference layer first.
    expect(mockQueryRenderedFeatures.mock.calls[0][0]).toEqual([
      [18, 38],
      [62, 82],
    ]);
    expect(mockQueryRenderedFeatures.mock.calls[0][1]).toEqual({ layers: ['refs:umepay:label'] });
  });

  it('ignores a press that lands on no reference layer', async () => {
    const onFeaturePress = jest.fn();

    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, style: styleWith(true) }}
        overlays={[document]}
        onFeaturePress={onFeaturePress}
      />,
    );

    await act(async () => {
      await mockMapProps[0].onPress?.({ nativeEvent: { point: [1, 1], lngLat: [-64.7, -32.2] } });
    });

    // The layers were queried (a tap can land anywhere) but nothing was reported.
    expect(mockQueryRenderedFeatures).toHaveBeenCalled();
    expect(onFeaturePress).not.toHaveBeenCalled();
  });

  it('draws the trip itinerary the switch hands to the map', async () => {
    // Preserved from the Leaflet facade: the switch still hands the trip's own
    // waypoints and camera to whichever native renderer runs.
    await render(
      <ExperienceMapSwitch
        renderer="maplibre"
        source={{ archiveUrl: ARCHIVE_URL, style: styleWith(true) }}
        experience={trip}
        userCoordinates={{ latitude: -34.61, longitude: -58.39 }}
        showLabels={false}
      />,
    );

    expect(mockCameraProps[0]).toMatchObject({
      // MapLibre takes [longitude, latitude], the order the switch already uses.
      center: [-58.3816, -34.6037],
      zoom: 14,
    });
    // Origin, one numbered stop per waypoint, the path and the walker position.
    const itinerary = drawnFeatures('itinerary');
    expect(itinerary.map((feature) => feature.properties?.labelIndex ?? null)).toEqual([
      1,
      2,
      3,
      null,
      null,
    ]);
    expect(drawnLayerIds().filter((id) => id.endsWith(':label'))).toEqual([]);
  });
});

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
