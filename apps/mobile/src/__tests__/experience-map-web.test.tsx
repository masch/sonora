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

// The failure of a drawn map is a log line: what a suite can see of an error the map
// survives is that it was reported to the log and that the map is still there.
jest.mock('@/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import ExperienceMap from '@/components/map/experience-map.web';
import { ThemedText } from '@/components/themed-text';
import { mockAddProtocol, mockMapInstances } from '@/test-utils/fake-maplibre';
import { logger } from '@/utils/logger';
import { foldAttribution } from '@/components/map/use-web-map-instance';
import {
  documentKeyOfLayer,
  FOCUS_DURATION_MS,
  FOCUS_MIN_ZOOM,
  type MapWaitState,
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
/** A transfer this suite holds open, so the wait it starts can be observed. */
const ARCHIVE_HELD = 'https://api.example/media/public/tiles/held/v1.pmtiles';
/** Three archives of their own, so the credit cases never share a registry entry. */
const ATTRIBUTED = 'https://api.example/media/public/tiles/attributed/v7.pmtiles';
const STYLE_ATTRIBUTED = 'https://api.example/media/public/styles/attributed.json';
/** A url the app cannot key by version, which is the resolved answer for an unknown one. */
const UNKEYED = 'https://api.example/media/public/tiles/unkeyed/basemap.pmtiles';
const UNATTRIBUTED = 'https://api.example/media/public/tiles/unattributed/v7.pmtiles';

/** The logger, as jest sees it: a drawn map's error is reported and nothing more. */
const mockedLogger = logger as unknown as { error: jest.Mock };

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

/** The notice the published style carries, markup and all. */
const OSM_NOTICE =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** A style that publishes a credit, the way the published one does. */
function styleWithAttribution(attribution: string): StyleSpecification {
  return {
    version: 8,
    sources: { basemap: { type: 'vector', url: ARCHIVE, attribution } },
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
    mockedLogger.error.mockClear();
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

  it('adds the drawn version to the credit the style document publishes', async () => {
    // The style is only a url here: the document is fetched like the published one, and
    // the notice is composed where the renderer already holds it.
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(2048),
      json: async () => styleWithAttribution(OSM_NOTICE),
    }) as unknown as typeof fetch;

    await render(
      <ExperienceMap
        source={{ archiveUrl: ATTRIBUTED, styleUrl: STYLE_ATTRIBUTED, archiveVersion: 'v7' }}
        overlays={[]}
      />,
    );

    await waitFor(() => expect(mockMapInstances).toHaveLength(1));

    const style = mockMapInstances[0].options.style as {
      sources: { basemap: { attribution?: string } };
    };
    // The style's own words, and the version of the archive this device is drawing.
    expect(style.sources.basemap.attribution).toBe(`${OSM_NOTICE} (v7)`);
  });

  it('leaves the credit as the style wrote it when the version is unknown', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(2048),
      json: async () => styleWithAttribution(OSM_NOTICE),
    }) as unknown as typeof fetch;

    await render(
      <ExperienceMap
        source={{
          archiveUrl: UNKEYED,
          archiveVersion: null,
          style: styleWithAttribution(OSM_NOTICE),
        }}
        overlays={[]}
      />,
    );

    await waitFor(() => expect(mockMapInstances).toHaveLength(1));

    const style = mockMapInstances[0].options.style as {
      sources: { basemap: { attribution?: string } };
    };
    // No `(v?)`, no `(v0)`: an answer nobody has is not printed.
    expect(style.sources.basemap.attribution).toBe(OSM_NOTICE);
  });

  it('fabricates no credit for a style that publishes none', async () => {
    await render(
      <ExperienceMap
        source={{ archiveUrl: UNATTRIBUTED, archiveVersion: 'v7', style: styleWith(false) }}
        overlays={[]}
      />,
    );

    await waitFor(() => expect(mockMapInstances).toHaveLength(1));

    const style = mockMapInstances[0].options.style as {
      sources: { basemap: Record<string, unknown> };
    };
    expect(style.sources.basemap).not.toHaveProperty('attribution');
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

  it('keeps drawing when an error arrives after the map has drawn', async () => {
    // MapLibre emits `error` for recoverable failures too: a sprite that 404s, a layer
    // whose source never arrived. The map is still drawing, so replacing it with the
    // error surface throws away a map that works. Only an error that arrives before the
    // map has ever reported `load` is a failure to draw — the distinction this code can
    // own, since the event carries no fatal flag.
    const view = await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE, style: styleWith(true) }}
        overlays={[document]}
      />,
    );
    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    const map = mockMapInstances[0];

    await act(async () => {
      map.emit('load');
    });

    const recoverable = new Error('sprite not found');
    await act(async () => {
      map.emit('error', { error: recoverable });
    });

    // The map stays exactly where it is: no error surface, no second instance, and the
    // documents it drew are still drawn.
    expect(view.queryByTestId('experience-map-error')).toBeNull();
    expect(mockMapInstances).toHaveLength(1);
    expect(map.layers.length).toBeGreaterThan(0);
    // What the walker cannot see is still reported, with the library's own error.
    expect(mockedLogger.error).toHaveBeenCalledWith('ExperienceMap error:', recoverable);
  });

  it('hands a rebuilt map the layer selection and the pending flight', async () => {
    // The rebuilt instance takes a false→true transition in `ready`, because the effects
    // that apply what does not belong to the map's creation — the layer selection and the
    // flight the caller asked for — only run while it passes through "not loaded yet".
    // The failure is raised before the map draws: an error after `load` is a map that is
    // still drawing, and it no longer rebuilds anything.
    const source = { archiveUrl: ARCHIVE, style: styleWithBasemapLayers() };
    const focus = { latitude: -32.212, longitude: -64.738 };
    const hidden: MapLayerSelection[] = [{ id: 'water', visible: false, declared: true }];

    const view = await render(
      <ExperienceMap source={source} overlays={[document]} focus={focus} layerSelection={hidden} />,
    );
    await waitFor(() => expect(mockMapInstances).toHaveLength(1));

    await act(async () => {
      mockMapInstances[0].emit('error', { error: new Error('WebGL context lost') });
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('experience-map-retry'));
    });
    await waitFor(() => expect(mockMapInstances).toHaveLength(2));

    const rebuilt = mockMapInstances[1];
    // Nothing has been drawn on it or asked of its camera yet: it has not loaded.
    expect(rebuilt.layoutProperties).toEqual([]);
    expect(rebuilt.flights).toEqual([]);

    await act(async () => {
      rebuilt.emit('load');
    });

    expect(rebuilt.layoutProperties).toEqual([
      { layerId: 'water', name: 'visibility', value: 'none' },
    ]);
    expect(rebuilt.flights).toEqual([
      {
        center: [focus.longitude, focus.latitude],
        duration: FOCUS_DURATION_MS,
        zoom: FOCUS_MIN_ZOOM,
      },
    ]);
  });

  it('keeps a replacement map not ready until it reports its own load', async () => {
    // A rebuild that is not a retry (here, a new camera frame) replaces the instance
    // while the build attempt stays the same. The replacement has drawn nothing, so it
    // has to pass through "not loaded yet" for the ready-gated effects to run against
    // it; taken as ready, it keeps drawing the groups the style authored instead of the
    // selection the walker made.
    const source = { archiveUrl: ARCHIVE, style: styleWithBasemapLayers() };
    const hidden: MapLayerSelection[] = [{ id: 'water', visible: false, declared: true }];
    const frame = { west: -64.83, south: -32.28, east: -64.66, north: -32.12 };

    const view = await render(
      <ExperienceMap
        source={source}
        overlays={[document]}
        bounds={frame}
        layerSelection={hidden}
      />,
    );
    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    await act(async () => {
      mockMapInstances[0].emit('load');
    });
    expect(mockMapInstances[0].layoutProperties).toEqual([
      { layerId: 'water', name: 'visibility', value: 'none' },
    ]);

    await act(async () => {
      view.rerender(
        <ExperienceMap
          source={source}
          overlays={[document]}
          bounds={{ ...frame, east: -64 }}
          layerSelection={hidden}
        />,
      );
    });
    await waitFor(() => expect(mockMapInstances).toHaveLength(2));

    const replacement = mockMapInstances[1];
    // Built and not drawn: nothing has been asked of its layers yet.
    expect(replacement.layoutProperties).toEqual([]);

    await act(async () => {
      replacement.emit('load');
    });

    expect(replacement.layoutProperties).toEqual([
      { layerId: 'water', name: 'visibility', value: 'none' },
    ]);
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

  it('draws the wait a caller hands it, and keeps the toolbar out until the map loads', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const body = {
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(2048),
      json: async () => styleWith(true),
    };
    globalThis.fetch = jest.fn((url: string) =>
      url === ARCHIVE_HELD ? gate.then(() => body) : Promise.resolve(body),
    ) as unknown as typeof fetch;

    const waits: MapWaitState[] = [];
    const view = await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_HELD, style: styleWith(true) }}
        overlays={[document]}
        renderPending={(wait) => {
          waits.push(wait);
          return (
            <ThemedText type="small" testID="caller-wait">
              {`caller:${wait.stage}`}
            </ThemedText>
          );
        }}
        toolbar={<ThemedText testID="caller-toolbar">toolbar</ThemedText>}
        overlay={<ThemedText testID="caller-overlay">overlay</ThemedText>}
      />,
    );

    // The archive is still arriving: the caller's node is what speaks, and the
    // renderer's own line is not drawn next to it.
    await waitFor(() =>
      expect(waits[waits.length - 1]).toEqual({
        stage: 'archive',
        downloading: false,
        progress: null,
      }),
    );
    expect(view.queryByTestId('caller-wait')).toBeTruthy();
    expect(view.queryByText('caller:archive')).toBeTruthy();
    expect(view.queryByText('map.loadingMap')).toBeNull();
    // A toolbar over a card that has not drawn a pixel is the flicker this change is
    // about, and the overlay belongs to the drawn map for the same reason.
    expect(view.queryByTestId('caller-toolbar')).toBeNull();
    expect(view.queryByTestId('caller-overlay')).toBeNull();
    expect(mockMapInstances).toHaveLength(0);

    await act(async () => {
      release();
      await gate;
    });
    await waitFor(() => expect(mockMapInstances).toHaveLength(1));

    // Built but not yet drawn: the map's own load is the last thing the wait waits for.
    expect(waits[waits.length - 1]).toEqual({ stage: 'map', downloading: false, progress: null });
    expect(view.queryByText('caller:map')).toBeTruthy();
    expect(view.queryByTestId('caller-toolbar')).toBeNull();

    await act(async () => {
      mockMapInstances[0].emit('load');
    });

    // Drawn: the slots land with the map, and the caller's pending node is gone.
    await waitFor(() => expect(view.queryByTestId('caller-toolbar')).toBeTruthy());
    expect(view.queryByTestId('caller-wait')).toBeNull();
    expect(view.queryByTestId('caller-overlay')).toBeTruthy();
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

  it('reports only the landing of the flight that is still in the air', async () => {
    // A second focus replaces a flight that has not landed yet. MapLibre stops the move
    // in progress, which reports the landing of the transition it just cut off, and the
    // listener the replaced flight registered is still there to receive it: consuming the
    // newest flight's report with it is what opened a card before its camera moved.
    const onFocusSettled = jest.fn();
    const source = { archiveUrl: ARCHIVE, style: styleWith(false) };
    const first = { latitude: -32.212, longitude: -64.738 };
    const second = { latitude: -31.9, longitude: -64.5 };

    const view = await render(
      <ExperienceMap source={source} overlays={[document]} onFocusSettled={onFocusSettled} />,
    );
    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    const map = mockMapInstances[0];
    await act(async () => {
      map.emit('load');
    });

    await act(async () => {
      view.rerender(
        <ExperienceMap
          source={source}
          overlays={[document]}
          focus={first}
          onFocusSettled={onFocusSettled}
        />,
      );
    });
    expect(map.flights).toHaveLength(1);

    await act(async () => {
      view.rerender(
        <ExperienceMap
          source={source}
          overlays={[document]}
          focus={second}
          onFocusSettled={onFocusSettled}
        />,
      );
    });

    // The second request cut the first flight off, and the double reports the landing of
    // the transition it cut off the way MapLibre does: to every listener registered at
    // that moment, the replaced flight's included. Nothing may be reported yet — the
    // camera has not even started towards `second`.
    expect(map.flights.map((flight) => flight.center)).toEqual([
      [first.longitude, first.latitude],
      [second.longitude, second.latitude],
    ]);
    expect(onFocusSettled).not.toHaveBeenCalled();

    await act(async () => {
      map.emit('moveend');
    });
    expect(onFocusSettled).toHaveBeenCalledTimes(1);

    await act(async () => {
      map.emit('moveend');
    });
    // The second flight is reported once, and only once.
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

describe('foldAttribution', () => {
  /** A container that hands back one control, and that control its summary. */
  function containerWith(control: {
    classList: { remove: jest.Mock };
    setAttribute: jest.Mock;
    summary?: { addEventListener: (event: string, handler: () => void) => void };
  }) {
    return {
      querySelector: jest.fn((selector: string) =>
        selector === '.maplibregl-ctrl-attrib.maplibregl-compact'
          ? {
              ...control,
              querySelector: (inner: string) => (inner === 'summary' ? control.summary : null),
            }
          : null,
      ),
    };
  }

  it('folds the credit wherever the attribution can appear, not only at creation', () => {
    // MapLibre opens the control when the first attribution arrives, not when it is
    // added: a fold at creation is too early and the credit ends up over the map.
    const element = { classList: { remove: jest.fn() }, setAttribute: jest.fn() };
    const handlers: Record<string, () => void> = {};
    const map = {
      on: jest.fn((event: string, handler: () => void) => (handlers[event] = handler)),
    };
    const container = containerWith(element);

    foldAttribution(map, container);

    expect(Object.keys(handlers).sort()).toEqual(['sourcedata', 'styledata']);
    expect(element.classList.remove).toHaveBeenCalledWith('maplibregl-compact-show');

    element.classList.remove.mockClear();
    handlers.styledata?.();
    handlers.sourcedata?.();
    expect(element.classList.remove).toHaveBeenCalledTimes(2);
  });

  it('leaves the credit alone once the walker opens it', () => {
    const element = {
      classList: { remove: jest.fn() },
      setAttribute: jest.fn(),
      summary: {
        addEventListener: (_event: string, handler: () => void) => {
          openByWalker = handler;
        },
      },
    };
    let openByWalker: (() => void) | undefined;
    const container = containerWith(element);
    const handlers: Record<string, () => void> = {};
    const map = { on: (event: string, handler: () => void) => (handlers[event] = handler) };

    foldAttribution(map, container);
    openByWalker?.();
    element.classList.remove.mockClear();

    handlers.sourcedata?.();
    // The credit is the walker's from the moment they ask for it.
    expect(element.classList.remove).not.toHaveBeenCalled();
  });

  it("binds the walker's click on the first fold that finds the control", () => {
    // The control arrives with the first attribution, not with the map: a listener bound
    // at creation never attaches, so the walker opens the credit and the next data event
    // folds it back.
    let summary: { addEventListener: (event: string, handler: () => void) => void } | null = null;
    let openByWalker: (() => void) | undefined;
    const element = {
      classList: { remove: jest.fn() },
      setAttribute: jest.fn(),
      querySelector: () => summary,
    };
    const container = { querySelector: () => element };
    const handlers: Record<string, () => void> = {};
    const map = { on: (event: string, handler: () => void) => (handlers[event] = handler) };

    foldAttribution(map, container);
    // Nothing to bind yet: the map has drawn no attribution.
    expect(element.classList.remove).toHaveBeenCalledTimes(1);

    summary = { addEventListener: (_event, handler) => (openByWalker = handler) };
    handlers.sourcedata?.();
    openByWalker?.();
    element.classList.remove.mockClear();

    handlers.styledata?.();
    handlers.sourcedata?.();
    // The credit is the walker's from the moment they ask for it.
    expect(element.classList.remove).not.toHaveBeenCalled();
  });

  it('does nothing when the node cannot be queried, as under test', () => {
    const map = { on: jest.fn() };
    expect(() => foldAttribution(map, {})).not.toThrow();
    expect(() => foldAttribution(map, null)).not.toThrow();
  });
});

/**
 * The hub's style as the published document draws it: the basemap's own names, which the
 * hub's markers must never cost.
 */
function styleWithBasemapLabels(): StyleSpecification {
  const layer = (id: string, type: 'symbol' | 'fill' | 'background', extra = {}) => ({
    id,
    type,
    ...(type === 'background' ? {} : { source: 'basemap' }),
    ...extra,
  });

  return {
    version: 8,
    glyphs: 'https://example.com/{fontstack}/{range}.pbf',
    sources: { basemap: { type: 'vector', url: ARCHIVE } },
    layers: [
      layer('background', 'background'),
      layer('water', 'fill'),
      layer('landuse_label', 'symbol', { minzoom: 11, layout: { 'text-field': ['get', 'name'] } }),
      layer('places_locality', 'symbol', { layout: { 'text-field': ['get', 'name'] } }),
      layer('roads_labels_major', 'symbol', { layout: { 'text-field': ['get', 'name'] } }),
    ],
  } as StyleSpecification;
}

describe('ExperienceMap (web) — bold references', () => {
  beforeEach(() => {
    mockMapInstances.length = 0;
    mockedLogger.error.mockClear();
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

  it('draws the basemap’s own names exactly as the document wrote them', async () => {
    const style = styleWithBasemapLabels();
    await render(
      <ExperienceMap source={{ archiveUrl: ARCHIVE, style }} overlays={[]} boldReferences={true} />,
    );

    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    const drawn = mockMapInstances[0].options.style as { layers: unknown[] };

    // Byte for byte: the weight belongs to the references and never to the names
    // underneath them, so a barrio is still named at the zoom the document names it.
    expect(drawn.layers).toEqual(style.layers);
  });

  it('draws the bold dot, the bigger label and a hit circle when the hub asks for it', async () => {
    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE, style: styleWith(true) }}
        overlays={[document]}
        boldReferences={true}
      />,
    );

    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    const map = mockMapInstances[0];
    await act(async () => {
      map.emit('load');
    });

    const added = map.layers as unknown as {
      id: string;
      paint?: Record<string, unknown>;
      layout?: Record<string, unknown>;
    }[];
    const layerWith = (id: string) => added.find((layer) => layer.id === id);

    // The target is added before the dot, because the map draws in insertion order.
    expect(added.map((layer) => layer.id)).toEqual([
      'refs:umepay:fill',
      'refs:umepay:line',
      'refs:umepay:circle-hit',
      'refs:umepay:circle',
      'refs:umepay:label',
    ]);
    expect(layerWith('refs:umepay:circle-hit')?.paint).toMatchObject({
      'circle-radius': 16,
      'circle-opacity': 0.01,
    });
    expect(layerWith('refs:umepay:circle')?.paint).toMatchObject({
      'circle-radius': 6,
      'circle-stroke-width': 2,
    });
    expect(layerWith('refs:umepay:label')?.layout?.['text-size']).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      13,
      12,
      15,
      13,
    ]);
    expect(layerWith('refs:umepay:label')?.paint?.['text-halo-width']).toBe(3);
  });

  it('reports the reference when the tap lands on the hit circle instead of the dot', async () => {
    // On the web renderer the press asks the map which reference layer is under the point,
    // so the transparent target has to answer with the same document the dot does.
    const onFeaturePress = jest.fn();
    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE, style: styleWith(false) }}
        overlays={[document]}
        boldReferences={true}
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
        { layer: { id: 'refs:umepay:circle-hit' }, properties: { experienceSlug: 'taller' } },
      ]);
    });

    expect(onFeaturePress).toHaveBeenCalledWith({
      documentKey: 'umepay',
      experienceSlug: 'taller',
    });
  });

  it('draws today’s reference layers when nothing is asked for', async () => {
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

    const added = mockMapInstances[0].layers as unknown as {
      id: string;
      paint?: Record<string, unknown>;
    }[];

    expect(added.map((layer) => layer.id)).toEqual([
      'refs:umepay:fill',
      'refs:umepay:line',
      'refs:umepay:circle',
    ]);
    expect(added.find((layer) => layer.id === 'refs:umepay:circle')?.paint).toMatchObject({
      'circle-radius': 6,
      'circle-stroke-width': 2,
    });
  });
});
