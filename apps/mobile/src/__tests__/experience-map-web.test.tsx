import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import type { StyleSpecification } from 'maplibre-gl';
import type { MapDocument, MapLayerSelection } from '@sonora/shared';

// The double lives outside this file: the jest.mock factory cannot hold type
// annotations (it reads them as out-of-scope variables).
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the jest.mock factory is hoisted
jest.mock('maplibre-gl', () => require('@/test-utils/fake-maplibre').fakeMaplibreModule());

// The hook downloads the whole archive and reads it with PMTiles; this double replaces it.
const mockGetHeader = jest.fn();
const mockGetZxy = jest.fn();

jest.mock('pmtiles', () => ({
  PMTiles: class {
    getHeader = mockGetHeader;
    getZxy = mockGetZxy;
  },
}));

import ExperienceMap from '@/components/map/experience-map.web';
import { mockAddProtocol, mockMapInstances } from '@/test-utils/fake-maplibre';
import {
  documentKeyOfLayer,
  FOCUS_DURATION_MS,
  FOCUS_MIN_ZOOM,
} from '@/components/map/map-view.types';
const ARCHIVE = 'https://api.example/media/public/tiles/calamuchita/v1.pmtiles';
const STYLE_URL = 'https://api.example/media/public/styles/v1.json';
/** The archive registry is module-level: this test needs one that was never downloaded. */
const ARCHIVE_FAILING = 'https://api.example/media/public/tiles/missing/v1.pmtiles';
/** A style that cannot be fetched needs an archive that can: one url of its own each. */
const ARCHIVE_STYLE_FAILING = 'https://api.example/media/public/tiles/style-failing/v1.pmtiles';
const STYLE_FAILING = 'https://api.example/media/public/styles/failing.json';
/** The retry case downloads the same archive twice, so it needs one nobody else used. */
const ARCHIVE_RETRYING = 'https://api.example/media/public/tiles/retrying/v1.pmtiles';
const STYLE_RETRYING = 'https://api.example/media/public/styles/retrying.json';

const document: MapDocument = {
  key: 'umepay',
  scope: 'experience',
  collection: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-64.738, -32.212] },
        properties: { labelKey: 'map.references.taller' },
      },
    ],
  },
};

function styleWith(glyphs: boolean): StyleSpecification {
  return {
    version: 8,
    ...(glyphs ? { glyphs: 'https://example.com/{fontstack}/{range}.pbf' } : {}),
    sources: { basemap: { type: 'vector', url: ARCHIVE } },
    layers: [],
  };
}

/**
 * A style that actually draws basemap layers, named the way the published one names
 * them: the selector resolves a group from those ids (`layerIdsForGroup`), so a style
 * with no layers could prove nothing about what it touches.
 */
function styleWithBasemapLayers(): StyleSpecification {
  return {
    version: 8,
    sources: { basemap: { type: 'vector', url: ARCHIVE } },
    layers: [
      { id: 'background', type: 'background' },
      { id: 'earth', type: 'fill', source: 'basemap', 'source-layer': 'earth' },
      { id: 'water', type: 'fill', source: 'basemap', 'source-layer': 'water' },
      { id: 'roads_primary', type: 'line', source: 'basemap', 'source-layer': 'roads' },
      { id: 'buildings', type: 'fill', source: 'basemap', 'source-layer': 'buildings' },
    ],
  } as StyleSpecification;
}

describe('ExperienceMap (web)', () => {
  beforeEach(() => {
    mockMapInstances.length = 0;
    mockAddProtocol.mockClear();
    mockGetHeader.mockReset().mockResolvedValue({
      minZoom: 0,
      maxZoom: 15,
      minLon: -64.83,
      minLat: -32.28,
      maxLon: -64.66,
      maxLat: -32.12,
    });
    mockGetZxy.mockReset();
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(2048),
      json: async () => styleWith(true),
    }) as unknown as typeof fetch;
  });

  it('points MapLibre at the worker published by the build', async () => {
    // The metro web build does not emit MapLibre's worker; without this URL the map
    // dies on load with "Worker failed to load" (L37).
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- a jest.mock factory cannot read an import
    const { mockSetWorkerUrl } = require('@/test-utils/fake-maplibre') as {
      mockSetWorkerUrl: jest.Mock;
    };

    expect(mockSetWorkerUrl).toHaveBeenCalledWith('/maplibre-gl-worker.js');
  });

  it('downloads the archive whole and points the style at the local source', async () => {
    await render(
      <ExperienceMap source={{ archiveUrl: ARCHIVE, styleUrl: STYLE_URL }} overlays={[]} />,
    );

    await waitFor(() => expect(mockMapInstances).toHaveLength(1));

    expect(globalThis.fetch).toHaveBeenCalledWith(ARCHIVE);
    // The style travels through ApiClient so its cacheKey applies (L7): one fetch call,
    // with the client's method and headers.
    expect(globalThis.fetch).toHaveBeenCalledWith(
      STYLE_URL,
      expect.objectContaining({ method: 'GET' }),
    );

    const style = mockMapInstances[0].options.style as {
      sources: { basemap: { url: string; type: string } };
    };
    // Not the remote url: the archive lives in memory and the local protocol serves it.
    expect(style.sources.basemap.url).toMatch(/^sonora:\/\//);
    expect(style.sources.basemap.type).toBe('vector');
    expect(mockAddProtocol).toHaveBeenCalledWith('sonora', expect.anything());
  });

  it('applies the reference documents once the map is loaded', async () => {
    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE, style: styleWith(false) }}
        overlays={[document]}
      />,
    );

    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    const map = mockMapInstances[0];
    expect(map.layers).toHaveLength(0);

    await act(async () => {
      map.emit('load');
    });

    expect(map.layers.map((layer: { id: string }) => layer.id)).toEqual([
      'refs:umepay:fill',
      'refs:umepay:line',
      'refs:umepay:circle',
    ]);
    expect(Object.keys(map.sources)).toContain('refs:umepay');
  });

  it('adds the label layer only when the style provides glyphs', async () => {
    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE, style: styleWith(true) }}
        overlays={[document]}
      />,
    );

    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    await act(async () => {
      mockMapInstances[0].emit('load');
    });

    expect(mockMapInstances[0].layers.map((layer: { id: string }) => layer.id)).toContain(
      'refs:umepay:label',
    );
  });

  it('adds and removes the label layer with the labels toggle', async () => {
    // A stable source keeps the map instance alive across the toggle.
    const source = { archiveUrl: ARCHIVE, style: styleWith(true) };
    const view = await render(<ExperienceMap source={source} overlays={[document]} />);

    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    await act(async () => {
      mockMapInstances[0].emit('load');
    });
    expect(mockMapInstances[0].layers.map((layer: { id: string }) => layer.id)).toContain(
      'refs:umepay:label',
    );

    await act(async () => {
      view.rerender(<ExperienceMap source={source} overlays={[document]} showLabels={false} />);
    });
    expect(mockMapInstances[0].layers.map((layer: { id: string }) => layer.id)).not.toContain(
      'refs:umepay:label',
    );
    expect(mockMapInstances[0].layers.map((layer: { id: string }) => layer.id)).toContain(
      'refs:umepay:circle',
    );

    await act(async () => {
      view.rerender(<ExperienceMap source={source} overlays={[document]} showLabels />);
    });
    expect(mockMapInstances[0].layers.map((layer: { id: string }) => layer.id)).toContain(
      'refs:umepay:label',
    );
  });

  it('reports the tapped reference with its document key', async () => {
    const onFeaturePress = jest.fn();
    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE, style: styleWith(false) }}
        overlays={[document]}
        onFeaturePress={onFeaturePress}
      />,
    );

    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    const map = mockMapInstances[0];
    await act(async () => {
      map.emit('load');
    });
    await act(async () => {
      map.emitTap([
        {
          layer: { id: 'refs:umepay:circle' },
          properties: {
            labelKey: 'map.references.taller',
            linkUrl: 'https://www.instagram.com/sonora.derivapoetica',
          },
        },
      ]);
    });

    expect(onFeaturePress).toHaveBeenCalledWith({
      documentKey: 'umepay',
      labelKey: 'map.references.taller',
      linkUrl: 'https://www.instagram.com/sonora.derivapoetica',
    });
  });

  it('ignores a tap that lands on a basemap feature', async () => {
    const onFeaturePress = jest.fn();
    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE, style: styleWith(false) }}
        overlays={[document]}
        onFeaturePress={onFeaturePress}
      />,
    );

    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    const map = mockMapInstances[0];
    await act(async () => {
      map.emit('load');
    });
    await act(async () => {
      map.emitTap([{ layer: { id: 'water' }, properties: {} }]);
    });

    expect(onFeaturePress).not.toHaveBeenCalled();
  });

  it('shows the failure instead of a blank canvas when the archive cannot be downloaded', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' }) as never;

    const view = await render(
      <ExperienceMap source={{ archiveUrl: ARCHIVE_FAILING }} overlays={[]} />,
    );

    await waitFor(() => expect(view.queryByTestId('experience-map-error')).toBeTruthy());
    expect(mockMapInstances).toHaveLength(0);
  });

  it('draws translated copy for the failed stage, and nothing a request produced', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' }) as never;

    const view = await render(
      <ExperienceMap source={{ archiveUrl: ARCHIVE_FAILING }} overlays={[]} />,
    );

    await waitFor(() => expect(view.queryByTestId('experience-map-error')).toBeTruthy());
    // The sentence is ours, translated at the edge from a stable code…
    expect(view.queryByText('map.errors.archiveUnavailable')).toBeTruthy();
    // …and the status line the server answered with stays in the log.
    expect(view.queryByText(/500/)).toBeNull();
    expect(view.queryByText(/Server Error/)).toBeNull();
  });

  it('names the style as the stage that failed', async () => {
    globalThis.fetch = jest.fn((url: string) => {
      if (url === ARCHIVE_STYLE_FAILING) {
        return Promise.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(2048) });
      }
      return Promise.reject(new TypeError('Network request failed'));
    }) as unknown as typeof fetch;

    const view = await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_STYLE_FAILING, styleUrl: STYLE_FAILING }}
        overlays={[]}
      />,
    );

    await waitFor(() => expect(view.queryByTestId('experience-map-error')).toBeTruthy());
    // A style that could not be fetched is not an archive that could not be downloaded.
    expect(view.queryByText('map.errors.styleUnavailable')).toBeTruthy();
    expect(view.queryByText('map.errors.archiveUnavailable')).toBeNull();
    expect(view.queryByText(/Network request failed/)).toBeNull();
  });

  it('retries the failed wait from the error state and draws once it lands', async () => {
    let releaseRetry: (response: unknown) => void = () => {};
    const retryGate = new Promise((resolve) => {
      releaseRetry = resolve;
    });
    let downloads = 0;
    const fetchMock = jest.fn((url: string) => {
      if (url === ARCHIVE_RETRYING) {
        downloads += 1;
        // The first attempt fails; the retry is held in flight so the wait it starts is
        // observable instead of settling inside the same act.
        return downloads === 1
          ? Promise.resolve({ ok: false, status: 503, statusText: 'Service Unavailable' })
          : retryGate;
      }
      if (url === STYLE_RETRYING) {
        return Promise.resolve({ ok: true, json: async () => styleWith(true) });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const view = await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_RETRYING, styleUrl: STYLE_RETRYING }}
        overlays={[document]}
      />,
    );

    await waitFor(() => expect(view.queryByTestId('experience-map-retry')).toBeTruthy());
    expect(view.queryByText('map.errors.archiveUnavailable')).toBeTruthy();
    expect(mockMapInstances).toHaveLength(0);

    await act(async () => {
      fireEvent.press(view.getByTestId('experience-map-retry'));
    });

    // Back into the wait, not into the failure that was just dismissed.
    expect(view.queryByTestId('experience-map-error')).toBeNull();
    expect(view.queryByText('map.loadingMap')).toBeTruthy();

    await act(async () => {
      releaseRetry({ ok: true, arrayBuffer: async () => new ArrayBuffer(2048) });
      await retryGate;
    });

    await waitFor(() => expect(mockMapInstances).toHaveLength(1));

    // The archive really restarted, and the style that had already loaded was not paid for
    // a second time: each wait has its own attempt.
    expect(downloads).toBe(2);
    expect(fetchMock.mock.calls.filter(([url]) => url === STYLE_RETRYING)).toHaveLength(1);
  });

  it('translates a map that failed to draw, and rebuilds it on retry', async () => {
    const view = await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE, style: styleWith(false) }}
        overlays={[document]}
      />,
    );
    await waitFor(() => expect(mockMapInstances).toHaveLength(1));

    await act(async () => {
      mockMapInstances[0].emit('error', { error: new Error('WebGL context lost') });
    });

    expect(view.queryByText('map.errors.mapUnavailable')).toBeTruthy();
    // The renderer's own message is a log line, never copy.
    expect(view.queryByText(/WebGL/)).toBeNull();

    await act(async () => {
      fireEvent.press(view.getByTestId('experience-map-retry'));
    });

    // The failure is withdrawn and the map is built again: this screen is not a dead end.
    expect(view.queryByTestId('experience-map-error')).toBeNull();
    await waitFor(() => expect(mockMapInstances).toHaveLength(2));
  });

  it('gives the interactive map surface a name and a test hook', async () => {
    const view = await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE, style: styleWith(false) }}
        overlays={[document]}
      />,
    );
    await waitFor(() => expect(mockMapInstances).toHaveLength(1));

    // The div that owns the click handler is the surface a screen reader announces and a
    // test reaches the map through — the same pair the native map carries.
    expect(view.getByLabelText('map.mapLabel')).toBeTruthy();
    expect(
      view.container.queryAll((node) => node.props['data-testid'] === 'experience-map-map'),
    ).toHaveLength(1);
  });

  it('does not rebuild the map when it finishes loading', async () => {
    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE, style: styleWith(false) }}
        overlays={[document]}
      />,
    );
    await waitFor(() => expect(mockMapInstances).toHaveLength(1));

    await act(async () => {
      mockMapInstances[0].emit('load');
    });

    expect(mockMapInstances).toHaveLength(1);
  });

  it('travels to a focused point once, without rebuilding the map when the world filters', async () => {
    // The world hands the map its documents and nothing else when a chip is pressed:
    // the frame stays the whole place, so only `overlays` changes. A rebuilt map would
    // re-fetch its style and tiles and fire `load` again, which is what this pins.
    const path: MapDocument = {
      key: 'world-path-deriva-centro',
      scope: 'experience',
      zIndex: -1,
      collection: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [-64.738, -32.212],
                [-64.74, -32.214],
              ],
            },
            properties: {},
          },
        ],
      },
    };
    const source = { archiveUrl: ARCHIVE, style: styleWith(false) };
    const focus = { latitude: -32.212, longitude: -64.738 };

    const view = await render(<ExperienceMap source={source} overlays={[document, path]} />);
    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    const map = mockMapInstances[0];
    await act(async () => {
      map.emit('load');
    });
    expect(map.flights).toEqual([]);

    await act(async () => {
      view.rerender(<ExperienceMap source={source} overlays={[document, path]} focus={focus} />);
    });

    // One flight, to the point, at the closest zoom a place is still a place at.
    // The shape is MapLibre's own — a single options object — because the real
    // `flyTo(options)` ignores a second argument, which is how a positional call
    // could pass a fake that mirrored it and still never move the camera.
    expect(map.flights).toEqual([
      {
        center: [focus.longitude, focus.latitude],
        duration: FOCUS_DURATION_MS,
        zoom: FOCUS_MIN_ZOOM,
      },
    ]);

    await act(async () => {
      view.rerender(<ExperienceMap source={source} overlays={[document]} focus={focus} />);
    });

    expect(mockMapInstances).toHaveLength(1);
    expect(mockMapInstances[0]).toBe(map);
    // Nothing moved the camera a second time: the same point was already reached.
    expect(map.flights).toHaveLength(1);
  });

  it('reports the landing of the flight it started, and only of that one', async () => {
    // `moveend` fires for every camera move, the walker's own pan included: the
    // caller sequences UI on the flight it asked for, so a move nobody requested
    // must report nothing, and a flight moves the camera once.
    const onFocusSettled = jest.fn();
    const source = { archiveUrl: ARCHIVE, style: styleWith(false) };
    const focus = { latitude: -32.212, longitude: -64.738 };

    const view = await render(
      <ExperienceMap source={source} overlays={[document]} onFocusSettled={onFocusSettled} />,
    );
    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    const map = mockMapInstances[0];
    await act(async () => {
      map.emit('load');
    });

    await act(async () => {
      map.emit('moveend');
    });
    expect(onFocusSettled).not.toHaveBeenCalled();

    await act(async () => {
      view.rerender(
        <ExperienceMap
          source={source}
          overlays={[document]}
          focus={focus}
          onFocusSettled={onFocusSettled}
        />,
      );
    });
    expect(map.flights).toHaveLength(1);
    // The camera is still travelling: nothing has landed yet.
    expect(onFocusSettled).not.toHaveBeenCalled();

    await act(async () => {
      map.emit('moveend');
    });
    expect(onFocusSettled).toHaveBeenCalledTimes(1);

    await act(async () => {
      map.emit('moveend');
    });
    // One flight, one report: a second landing belongs to a move nobody asked for.
    expect(onFocusSettled).toHaveBeenCalledTimes(1);
  });

  it('removes the map instance on unmount', async () => {
    const first = await render(
      <ExperienceMap source={{ archiveUrl: ARCHIVE, style: styleWith(false) }} overlays={[]} />,
    );
    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    const remove = jest.spyOn(mockMapInstances[0] as unknown as { remove: () => void }, 'remove');

    await act(async () => {
      await first.unmount();
    });

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('writes a declared group onto the layers the style already drew', async () => {
    const hidden: MapLayerSelection[] = [
      { id: 'water', visible: false, declared: true },
      // Silent: never named by anyone, so the style keeps its own decision.
      { id: 'roads', visible: true, declared: false },
    ];

    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE, style: styleWithBasemapLayers() }}
        overlays={[]}
        layerSelection={hidden}
      />,
    );

    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    await act(async () => {
      mockMapInstances[0].emit('load');
    });

    // One call, for the group that was named: the canvas (`background`, `earth`) and
    // the sibling group stay exactly as the style authored them.
    expect(mockMapInstances[0].layoutProperties).toEqual([
      { layerId: 'water', name: 'visibility', value: 'none' },
    ]);
  });

  it('leaves every layer as authored when no group is declared', async () => {
    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE, style: styleWithBasemapLayers() }}
        overlays={[]}
      />,
    );

    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    await act(async () => {
      mockMapInstances[0].emit('load');
    });

    expect(mockMapInstances[0].layoutProperties).toEqual([]);
  });

  it('honours the groups the source names when no selection is passed', async () => {
    // The native renderer's fallback: a caller that mounts the renderer directly and
    // passes only `source.layers` must draw the same map on both platforms.
    await render(
      <ExperienceMap
        source={{
          archiveUrl: ARCHIVE,
          style: styleWithBasemapLayers(),
          layers: [{ id: 'water', defaultVisible: false }],
        }}
        overlays={[]}
      />,
    );

    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    await act(async () => {
      mockMapInstances[0].emit('load');
    });

    expect(mockMapInstances[0].layoutProperties).toEqual([
      { layerId: 'water', name: 'visibility', value: 'none' },
    ]);
  });

  it('re-applies a toggle without rebuilding the map or its style', async () => {
    const source = { archiveUrl: ARCHIVE, style: styleWithBasemapLayers() };
    const hidden: MapLayerSelection[] = [{ id: 'water', visible: false, declared: true }];
    const shown: MapLayerSelection[] = [{ id: 'water', visible: true, declared: true }];

    const view = await render(
      <ExperienceMap source={source} overlays={[document]} layerSelection={hidden} />,
    );
    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    const map = mockMapInstances[0];
    await act(async () => {
      map.emit('load');
    });
    const styleAsLoaded = map.options.style;

    expect(map.layoutProperties).toEqual([{ layerId: 'water', name: 'visibility', value: 'none' }]);

    await act(async () => {
      view.rerender(<ExperienceMap source={source} overlays={[document]} layerSelection={shown} />);
    });

    // The toggle wrote the decision onto the layers that are already drawn. A style
    // reload would have answered the same question by re-fetching every tile, and the
    // double exposes no `setStyle` at all: the only way to reach this assertion is
    // `setLayoutProperty`. One map instance and one unchanged style object prove the
    // map was never rebuilt.
    expect(mockMapInstances).toHaveLength(1);
    expect(map.options.style).toBe(styleAsLoaded);
    expect(map.layoutProperties).toEqual([
      { layerId: 'water', name: 'visibility', value: 'none' },
      { layerId: 'water', name: 'visibility', value: 'visible' },
    ]);
  });

  it('never touches the reference layers a document owns', async () => {
    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE, style: styleWithBasemapLayers() }}
        overlays={[document]}
        layerSelection={[
          { id: 'water', visible: false, declared: true },
          { id: 'buildings', visible: false, declared: true },
        ]}
      />,
    );

    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    await act(async () => {
      mockMapInstances[0].emit('load');
    });

    expect(mockMapInstances[0].layoutProperties).toEqual([
      { layerId: 'water', name: 'visibility', value: 'none' },
      { layerId: 'buildings', name: 'visibility', value: 'none' },
    ]);
  });
});

describe('documentKeyOfLayer', () => {
  it('reads the key out of a reference layer id and ignores foreign layers', () => {
    expect(documentKeyOfLayer('refs:umepay:circle')).toBe('umepay');
    expect(documentKeyOfLayer('water')).toBeNull();
    expect(documentKeyOfLayer('buildings')).toBeNull();
  });
});
