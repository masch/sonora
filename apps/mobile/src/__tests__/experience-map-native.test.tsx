import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import type { StyleSpecification } from 'maplibre-gl';
import { en, es, type MapDocument } from '@sonora/shared';

import ExperienceMap from '@/components/map/experience-map';
import ExperienceMapSwitch from '@/components/map/experience-map-switch';
import type { TripExperience } from '@/data/experiences';
import { useMapArchiveFile } from '@/hooks/use-map-archive-file';
import { styleCacheKey } from '@/services/map-style-cache';
import { appStorage } from '@/storage/app-storage';
import { logger } from '@/utils/logger';

// The archive lives on the device: `use-map-archive-file` owns the download (and
// its own suite), so this suite only drives the states it hands back.
jest.mock('@/hooks/use-map-archive-file', () => ({ useMapArchiveFile: jest.fn() }));

// The asset store has its own suite (`map-styles.test.ts`): what this suite is about is
// the chain the map draws through, so the device side is a set of answers it can
// arrange — an asset pass that landed, an asset transfer that failed. The style
// *document* is not on the disk at all: it is cached by the client, as on the web.
jest.mock('@/services/map-styles', () => ({
  downloadStyleAssets: jest.fn(async () => {}),
  localizeStyle: jest.fn(async (style: unknown) => style),
}));

/**
 * The client's cache, in memory: `BaseApiClient` writes the body of a successful GET
 * here and reads it back when the request cannot answer, which is the one place a
 * style document is kept on either platform.
 */
const mockStorage: Record<string, string> = {};

jest.mock('@/storage/app-storage', () => {
  const actual = jest.requireActual('@/storage/app-storage');
  return {
    ...actual,
    appStorage: {
      getItem: jest.fn(async (key: string) => mockStorage[key] ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: jest.fn(async (key: string) => {
        delete mockStorage[key];
      }),
      clear: jest.fn(async () => {
        for (const key of Object.keys(mockStorage)) delete mockStorage[key];
      }),
    },
    getDeviceId: jest.fn(async () => 'test-device-id'),
  };
});

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

// The request layer keeps the detail of a failure for the log: what the screen shows
// is a code it translates, never a sentence a request produced.
jest.mock('@/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// `LoadingView` is what the spinner is: recording its renders is the only way to ask
// whether a mount ever passed through the loading branch, because `render()` from
// RTL-RN flushes effects and microtasks before an assertion can look at the tree. The
// double draws the same message the real component draws, so the stage names the other
// tests read stay readable.
jest.mock('@/components/loading-view', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  const { ThemedText } = jest.requireActual<typeof import('@/components/themed-text')>(
    '@/components/themed-text',
  );
  const loadingMessages: string[] = [];

  // Named as a component, because it is one: an anonymous arrow would be linted as a
  // plain function that calls a hook.
  const LoadingViewDouble = (props: { message?: string }) => {
    useEffect(() => {
      loadingMessages.push(props.message ?? '');
    }, [props.message]);
    return <ThemedText type="small">{props.message}</ThemedText>;
  };

  return { __esModule: true, loadingMessages, default: LoadingViewDouble };
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

/** The asset store's doubles, as this suite arranges them per test. */
const mockedStyleStore = jest.requireMock('@/services/map-styles') as {
  downloadStyleAssets: jest.Mock<Promise<void>, [unknown]>;
  localizeStyle: jest.Mock<Promise<unknown>, [unknown]>;
};

/** The client's cache, as jest sees it. */
const cacheStorage = appStorage as unknown as { getItem: jest.Mock; setItem: jest.Mock };

/** The document a previous run left in the client's cache, with a layer only it has. */
function cachedStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://api.example/media/public/glyphs/{fontstack}/{range}.pbf',
    sources: { basemap: { type: 'vector', url: ARCHIVE_URL } },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#ffffff' } },
      { id: 'cached-water', type: 'background', paint: { 'background-color': '#00f' } },
    ],
  } as StyleSpecification;
}

/** Every `t` the mocked hook handed to a component, in call order. */
const { handedTranslate } = jest.requireMock('@/hooks/use-translation') as {
  handedTranslate: unknown[];
};

/** Every message the loading branch rendered, in order: the spinner's own record. */
const { loadingMessages } = jest.requireMock('@/components/loading-view') as {
  loadingMessages: string[];
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

/**
 * The same document with one layer per selector group, so a group the payload turns
 * off can be seen in the style the map is handed.
 */
function styleWithGroups(): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://api.example/media/public/glyphs/{fontstack}/{range}.pbf',
    sources: { basemap: { type: 'vector', url: ARCHIVE_URL } },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#ffffff' } },
      { id: 'water', type: 'fill', source: 'basemap', 'source-layer': 'water' },
      { id: 'water_label_ocean', type: 'symbol', source: 'basemap', 'source-layer': 'water' },
      { id: 'roads_minor', type: 'line', source: 'basemap', 'source-layer': 'roads' },
    ],
  } as StyleSpecification;
}

/**
 * A `fetch` double that honours its abort signal the way the platform does.
 *
 * The previous double ignored the signal, so a second request could hide behind an
 * assertion that claimed there was one: this one rejects with an `AbortError` the
 * moment its signal aborts, so an aborted transfer can never be mistaken for a live
 * one. The test resolves or rejects the response itself.
 */
function abortAwareFetch(): {
  fetchMock: jest.Mock;
  signals: AbortSignal[];
  urls: string[];
  resolve: (response: unknown) => void;
} {
  const signals: AbortSignal[] = [];
  const urls: string[] = [];
  let settle: ((value: unknown) => void) | null = null;

  const fetchMock = jest.fn((url: string, init?: { signal?: AbortSignal }) => {
    urls.push(url);
    const signal = init?.signal;
    if (!signal) throw new Error('the style was fetched without a cancellable signal');
    signals.push(signal);

    return new Promise((resolve, reject) => {
      settle = resolve;
      signal.addEventListener('abort', () => {
        reject(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' }));
      });
    });
  });

  return { fetchMock, signals, urls, resolve: (response) => settle?.(response) };
}

/** The layer ids the map was told to draw, in draw order. */
function drawnLayerIds(index = 0): string[] {
  return (mockMapProps[index].mapStyle.layers ?? []).map((layer) => layer.id);
}

/** The `layout` the map was handed for one layer, or `undefined` when it carries none. */
function drawnLayout(layerId: string, index = 0): Record<string, unknown> | undefined {
  // The style spec's layer union does not carry `layout` on every member (a
  // background layer has none), so the double's own shape is what is read here.
  const layers = (mockMapProps[index].mapStyle.layers ?? []) as {
    id: string;
    layout?: Record<string, unknown>;
  }[];
  return layers.find((candidate) => candidate.id === layerId)?.layout;
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
    loadingMessages.length = 0;
    for (const key of Object.keys(mockStorage)) delete mockStorage[key];
    cacheStorage.getItem.mockClear();
    cacheStorage.setItem.mockClear();
    mockedStyleStore.downloadStyleAssets.mockReset().mockResolvedValue(undefined);
    mockedStyleStore.localizeStyle.mockReset().mockImplementation(async (style) => style);
  });

  it('draws the style the client cached when the request fails (R12)', async () => {
    // The cold start R12 is about: no network, an archive on the device, and the
    // document the last run left in the client's cache — the same storage the
    // experiences list already survives offline with.
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('offline')) as never;
    const styleUrl = `${STYLE_URL}?cached`;
    mockStorage[styleCacheKey(styleUrl)] = JSON.stringify(cachedStyle());

    const view = await render(
      <ExperienceMap source={{ archiveUrl: ARCHIVE_URL, styleUrl }} overlays={[document]} />,
    );

    await waitFor(() => expect(mockMapProps).toHaveLength(1));

    // The map draws, and it draws the document from storage, not the fallback style:
    // the base layer only the cached document carries is there. Nothing on this
    // device's filesystem holds a document, so nothing else could have answered.
    expect(view.queryByTestId('experience-map-error')).toBeNull();
    expect(drawnLayerIds()).toEqual(expect.arrayContaining(['background', 'cached-water']));
    expect(mockMapProps[0].mapStyle.sources?.basemap).toMatchObject({ url: ARCHIVE_URI });
    // Read under the url this map asked for, through the client's own fallback.
    expect(cacheStorage.getItem).toHaveBeenCalledWith(styleCacheKey(styleUrl));
    expect(globalThis.fetch).toHaveBeenCalledWith(
      styleUrl,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('reports the style failure when the cache holds nothing for this url', async () => {
    // The cache adds a rung before the failure, it does not remove it: a style that
    // never arrived is still a map that says so and can be retried.
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('offline')) as never;

    const view = await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, styleUrl: `${STYLE_URL}?nothing-cached` }}
        overlays={[document]}
      />,
    );

    await waitFor(() => expect(view.queryByTestId('experience-map-error')).toBeTruthy());
    expect(view.queryByText('map.errors.styleUnavailable')).toBeTruthy();
    expect(view.queryByTestId('experience-map-retry')).toBeTruthy();
    expect(mockMapProps).toHaveLength(0);
    // Nothing was handed to MapLibre, so there was nothing to download assets for.
    expect(mockedStyleStore.downloadStyleAssets).not.toHaveBeenCalled();
  });

  it('treats a cached document without a version as absent, not as a style', async () => {
    // A body without the `version` MapLibre reads first cannot be drawn, and the
    // client's cache is the only place it survives: reporting it as absent is what
    // keeps a poisoned cold start retryable instead of a permanently blank map.
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('offline')) as never;
    const styleUrl = `${STYLE_URL}?undrawable-cached`;
    mockStorage[styleCacheKey(styleUrl)] = JSON.stringify({
      sources: {},
      layers: [{ id: 'land' }],
    });

    const view = await render(
      <ExperienceMap source={{ archiveUrl: ARCHIVE_URL, styleUrl }} overlays={[document]} />,
    );

    await waitFor(() => expect(view.queryByTestId('experience-map-error')).toBeTruthy());
    expect(view.queryByText('map.errors.styleUnavailable')).toBeTruthy();
    expect(mockMapProps).toHaveLength(0);
    expect(mockedStyleStore.downloadStyleAssets).not.toHaveBeenCalled();
  });

  it('keeps a fetched document in the client cache, and draws the localized style', async () => {
    const styleUrl = `${STYLE_URL}?keep`;
    const fetched = styleWith(true);
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => fetched }) as never;
    // The store answers with the document pointed at the files it found on the device.
    mockedStyleStore.localizeStyle.mockImplementation(async (style) => ({
      ...(style as StyleSpecification),
      glyphs: `file:///document/map-styles/glyphs/{fontstack}/{range}.pbf`,
    }));

    await render(
      <ExperienceMap source={{ archiveUrl: ARCHIVE_URL, styleUrl }} overlays={[document]} />,
    );

    await waitFor(() => expect(mockMapProps).toHaveLength(1));

    // The document the next cold start reads is the client's, under this url's key —
    // the same bytes, on the same platform storage the web renderer writes to.
    await waitFor(() => expect(mockStorage[styleCacheKey(styleUrl)]).toBe(JSON.stringify(fetched)));
    expect(mockedStyleStore.localizeStyle).toHaveBeenCalledWith(fetched);
    // And the map was handed the localized document, never the published urls.
    expect(mockMapProps[0].mapStyle.glyphs).toBe(
      'file:///document/map-styles/glyphs/{fontstack}/{range}.pbf',
    );
  });

  it('draws the map even when the asset transfer fails', async () => {
    // Best effort is the whole contract of the asset pass: a font range that cannot be
    // downloaded leaves the published urls in place and never costs the map.
    const styleUrl = `${STYLE_URL}?asset-failure`;
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => styleWith(true) }) as never;
    mockedStyleStore.downloadStyleAssets.mockRejectedValue(new Error('disk is full'));

    const view = await render(
      <ExperienceMap source={{ archiveUrl: ARCHIVE_URL, styleUrl }} overlays={[document]} />,
    );

    await waitFor(() => expect(mockMapProps).toHaveLength(1));
    expect(view.queryByTestId('experience-map-error')).toBeNull();
    expect(drawnLayerIds()).toContain('refs:umepay:label');
    // The failure is reported where a failure belongs: the log, not the screen.
    await waitFor(() => expect(logger.warn).toHaveBeenCalled());
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
    expect(drawnFeatures('umepay')[0].properties?.labelText).toBe('map.references.taller');
  });

  it('hands the map the group the view turned off, and nothing else', async () => {
    // The selection is the view's decision (the switch resolves the payload and hands
    // the result down); the renderer only applies what it is given. The style handed
    // to MapLibre is where that decision lands — the renderer is declarative, so the
    // adapter is a transform of the style, not a call on a map handle.
    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, style: styleWithGroups() }}
        overlays={[document]}
        layerSelection={[
          { id: 'water', visible: false, declared: true },
          { id: 'roads', visible: true, declared: false },
        ]}
      />,
    );

    expect(mockMapProps).toHaveLength(1);
    // Every layer the group owns is switched off in the style itself...
    expect(drawnLayout('water')).toEqual({ visibility: 'none' });
    expect(drawnLayout('water_label_ocean')).toEqual({ visibility: 'none' });
    // ...the layers no group turned off are drawn as the document wrote them...
    expect(drawnLayout('roads_minor')).toBeUndefined();
    expect(drawnLayout('background')).toBeUndefined();
    // ...and our own documents are out of reach of any group: they are appended
    // after the transform, so no group can ever blank them.
    for (const layerId of ['refs:umepay:fill']) {
      expect(drawnLayout(layerId)).toBeUndefined();
    }
    // The label layer keeps the layout the shared builder wrote, and no group key in it.
    expect(drawnLayout('refs:umepay:label')).not.toHaveProperty('visibility');
    expect(drawnLayerIds()).toContain('refs:umepay:label');
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
    expect(drawnFeatures('umepay')[0].properties?.labelText).toBe('map.references.taller');
  });

  it('draws the base layers as the document wrote them when no group is configured', async () => {
    // The default payload names no group, so the selector changes nothing: the style
    // is the one this map drew before the selector existed.
    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, style: styleWithGroups() }}
        overlays={[document]}
      />,
    );

    expect(drawnLayerIds()).toEqual([
      'background',
      'water',
      'water_label_ocean',
      'roads_minor',
      'refs:umepay:fill',
      'refs:umepay:line',
      'refs:umepay:circle',
      'refs:umepay:label',
    ]);
    for (const layerId of ['background', 'water', 'water_label_ocean', 'roads_minor']) {
      expect(drawnLayout(layerId)).toBeUndefined();
    }
  });

  it('applies the selection it is given over the groups the source carries', async () => {
    // A payload that says "hide water" cannot beat the walker's own choice in the
    // control: the renderer applies the selection and never resolves one itself.
    await render(
      <ExperienceMap
        source={{
          archiveUrl: ARCHIVE_URL,
          style: styleWithGroups(),
          layers: [{ id: 'water', defaultVisible: false }],
        }}
        overlays={[document]}
        layerSelection={[{ id: 'water', visible: true, declared: true }]}
      />,
    );

    expect(drawnLayout('water')).toBeUndefined();
    expect(drawnLayout('water_label_ocean')).toBeUndefined();
  });

  it('draws the groups the source names when the view hands it no selection', async () => {
    // A caller that mounts the renderer directly keeps the baseline behaviour: the
    // payload on the source is applied instead of being silently dropped because an
    // optional prop was omitted.
    await render(
      <ExperienceMap
        source={{
          archiveUrl: ARCHIVE_URL,
          style: styleWithGroups(),
          layers: [{ id: 'water', defaultVisible: false }],
        }}
        overlays={[document]}
      />,
    );

    expect(drawnLayout('water')).toEqual({ visibility: 'none' });
    expect(drawnLayout('water_label_ocean')).toEqual({ visibility: 'none' });
    expect(drawnLayout('roads_minor')).toBeUndefined();
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

  it('draws the reference plane and says the point belongs to no region', async () => {
    const view = await render(
      <ExperienceMap
        source={{ regionKey: null, archiveUrl: '', style: styleWith(true) }}
        overlays={[document]}
      />,
    );

    // The honest line, not the "no map is configured" error: the map is not broken,
    // this point simply belongs to no published region (S1, T-B).
    expect(view.queryByText('map.noRegion')).toBeTruthy();
    expect(view.queryByText('map.errors.archiveMissing')).toBeNull();
    expect(view.queryByTestId('experience-map-error')).toBeNull();
    // No archive means no download: the source handed to the hook names none.
    expect(mockedUseMapArchiveFile.mock.calls[0][0]).toMatchObject({
      archiveUrl: '',
      regionKey: null,
    });
    // The reference plane still draws, over a style that carries no basemap.
    expect(mockMapProps[0].mapStyle.sources?.basemap).toBeUndefined();
    expect(drawnLayerIds()).toContain('refs:umepay:circle');
    // And the line is real copy in both locales, not a key left untranslated.
    expect(es.map.noRegion).not.toBe('map.noRegion');
    expect(en.map.noRegion).not.toBe('map.noRegion');
  });

  it('keeps the no-region line even when the style cannot be fetched', async () => {
    // The reference plane needs no style document, so a style failure is not the
    // reason this map looks the way it does: the honest line stays on screen.
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' }) as never;

    const view = await render(
      <ExperienceMap
        source={{ regionKey: null, archiveUrl: '', styleUrl: `${STYLE_URL}?no-region` }}
        overlays={[document]}
      />,
    );

    await waitFor(() => expect(view.queryByText('map.noRegion')).toBeTruthy());
    expect(view.queryByTestId('experience-map-error')).toBeNull();
    expect(mockMapProps[0].mapStyle.sources?.basemap).toBeUndefined();
  });

  it('still reports a missing archive as a failure when the region is known', async () => {
    // The region resolved but its archive is gone: that is a broken map, not a point
    // outside the catalog, and the two reasons never collapse into one message.
    mockedUseMapArchiveFile.mockReturnValue({ status: 'error', error: 'archiveMissing' });

    const view = await render(
      <ExperienceMap
        source={{ regionKey: 'calamuchita', archiveUrl: '', style: styleWith(true) }}
        overlays={[document]}
      />,
    );

    expect(view.queryByText('map.errors.archiveMissing')).toBeTruthy();
    expect(view.queryByText('map.noRegion')).toBeNull();
    expect(mockMapProps).toHaveLength(0);
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
    mockedUseMapArchiveFile.mockReturnValue({ status: 'error', error: 'archiveDownloadFailed' });

    const view = await render(
      <ExperienceMap source={{ archiveUrl: ARCHIVE_URL, style: styleWith(true) }} overlays={[]} />,
    );

    expect(view.queryByTestId('experience-map-error')).toBeTruthy();
    // The hook reports a code and the view translates it: the sentence on screen is
    // ours, and it is a key in both locales rather than prose from a transfer.
    expect(view.queryByText('map.errors.archiveUnavailable')).toBeTruthy();
    expect(view.queryByText('archiveDownloadFailed')).toBeNull();
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

    // The transfer is cancellable, and the archive file is what the style points at.
    expect(fetchStyle).toHaveBeenCalledWith(
      STYLE_URL,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
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
      // The message names the stage that stalled: the style, not the archive, and it
      // is the translated message that code selects instead of the hook's sentence.
      expect(view.queryByText('map.errors.styleTimeout')).toBeTruthy();
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
        : { status: 'error', error: 'archiveDownloadFailed' },
    );

    const view = await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, styleUrl: `${STYLE_URL}?retry` }}
        overlays={[document]}
      />,
    );

    await waitFor(() => expect(view.queryByTestId('experience-map-retry')).toBeTruthy());
    // The stage that failed stays visible next to the retry.
    expect(view.queryByText('map.errors.archiveUnavailable')).toBeTruthy();
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
    expect(fetchStyle).toHaveBeenLastCalledWith(
      `${STYLE_URL}?retry`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(mockedUseMapArchiveFile).toHaveBeenLastCalledWith(
      expect.objectContaining({ archiveUrl: ARCHIVE_URL }),
      1,
    );
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
    expect(mockedUseMapArchiveFile).toHaveBeenLastCalledWith(
      expect.objectContaining({ archiveUrl: ARCHIVE_URL }),
      0,
    );
  });

  it('draws a style already in the page cache on its first render, with no second transfer', async () => {
    const fetchStyle = jest.fn().mockResolvedValue({ ok: true, json: async () => styleWith(true) });
    globalThis.fetch = fetchStyle as unknown as typeof fetch;
    const source = { archiveUrl: ARCHIVE_URL, styleUrl: `${STYLE_URL}?warm` };

    // A page-level load that already finished: this is the instant second visit.
    const first = await render(<ExperienceMap source={source} overlays={[document]} />);
    await waitFor(() => expect(mockMapProps).toHaveLength(1));
    expect(fetchStyle).toHaveBeenCalledTimes(1);
    await first.unmount();

    const second = await render(<ExperienceMap source={source} overlays={[document]} />);

    // The document is already on the page, so the very first render draws: the map is
    // there, the spinner never appears, and the transfer is not repeated.
    expect(second.queryByTestId('experience-map-map')).toBeTruthy();
    expect(second.queryByText('map.loadingStyle')).toBeNull();
    expect(fetchStyle).toHaveBeenCalledTimes(1);
  });

  it('never caches a body that is not a style, so a later mount still draws', async () => {
    // A 200 carrying an error document instead of a style. The page cache is what the
    // first render of every later mount draws from, so an entry that cannot be drawn
    // would poison the page: the map would be handed a body with no layers on every
    // visit, with no failure to see and nothing to retry.
    const fetchStyle = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: 'not found' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => styleWith(true) });
    globalThis.fetch = fetchStyle as unknown as typeof fetch;
    const source = { archiveUrl: ARCHIVE_URL, styleUrl: `${STYLE_URL}?poisoned` };

    const first = await render(<ExperienceMap source={source} overlays={[document]} />);

    await waitFor(() => expect(first.queryByTestId('experience-map-error')).toBeTruthy());
    // Nothing was handed to MapLibre for a document that is not a style.
    expect(mockMapProps).toHaveLength(0);
    await first.unmount();

    const second = await render(<ExperienceMap source={source} overlays={[document]} />);

    await waitFor(() => expect(second.queryByTestId('experience-map-map')).toBeTruthy());
    // The drawable document, with the base layers the style carries.
    expect(drawnLayerIds()).toContain('background');
    expect(fetchStyle).toHaveBeenCalledTimes(2);
  });

  it('turns a style that cannot be drawn into a retryable failure, not a permanent wait', async () => {
    let resolveStyle = (_response: unknown) => {};
    const gate = new Promise((resolve) => {
      resolveStyle = resolve;
    });
    const fetchStyle = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => null })
      .mockReturnValueOnce(gate);
    globalThis.fetch = fetchStyle as unknown as typeof fetch;
    const source = { archiveUrl: ARCHIVE_URL, styleUrl: `${STYLE_URL}?undrawable` };

    const view = await render(<ExperienceMap source={source} overlays={[document]} />);

    // An empty body is a failure the screen reports and can retry, not a spinner that
    // never ends: nothing about this observation may become permanent.
    await waitFor(() => expect(view.queryByTestId('experience-map-error')).toBeTruthy());
    expect(view.queryByText('map.errors.styleUnavailable')).toBeTruthy();
    expect(mockMapProps).toHaveLength(0);

    await act(async () => {
      fireEvent.press(view.getByTestId('experience-map-retry'));
    });

    // Waiting again, never replaying the failure of the attempt that was given up.
    expect(view.queryByText('map.loadingStyle')).toBeTruthy();
    expect(view.queryByTestId('experience-map-error')).toBeNull();

    await act(async () => {
      resolveStyle({ ok: true, json: async () => styleWith(true) });
      await gate;
    });

    await waitFor(() => expect(mockMapProps).toHaveLength(1));
    expect(fetchStyle).toHaveBeenCalledTimes(2);
  });

  it('cancels the style transfer when the bound is reached, and on the retry after it', async () => {
    jest.useFakeTimers();
    try {
      const signals: AbortSignal[] = [];
      globalThis.fetch = jest.fn((_url: string, init?: { signal?: AbortSignal }) => {
        if (init?.signal) signals.push(init.signal);
        return new Promise(() => {});
      }) as never;

      const view = await render(
        <ExperienceMap
          source={{ archiveUrl: ARCHIVE_URL, styleUrl: `${STYLE_URL}?bounded` }}
          overlays={[]}
        />,
      );

      // The transfer is cancellable from the start, which is what the bound uses.
      expect(signals).toHaveLength(1);
      expect(signals[0].aborted).toBe(false);

      await act(async () => {
        jest.advanceTimersByTime(10_000);
      });

      // The transfer itself was cancelled, not only the wait for it.
      expect(signals[0].aborted).toBe(true);
      expect(view.queryByTestId('experience-map-error')).toBeTruthy();

      await act(async () => {
        fireEvent.press(view.getByTestId('experience-map-retry'));
      });

      // The retry owns its own transfer: the cancelled one is not left alive next to it.
      expect(signals).toHaveLength(2);
      expect(signals[0].aborted).toBe(true);
      expect(signals[1].aborted).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('draws a style already in the page cache without the spinner ever rendering', async () => {
    const fetchStyle = jest.fn().mockResolvedValue({ ok: true, json: async () => styleWith(true) });
    globalThis.fetch = fetchStyle as unknown as typeof fetch;
    const source = { archiveUrl: ARCHIVE_URL, styleUrl: `${STYLE_URL}?warm-spinner` };

    // A cold page does show the spinner, which is what makes the next reading mean
    // something: the recorder really does see the loading branch when it renders.
    const first = await render(<ExperienceMap source={source} overlays={[document]} />);
    await waitFor(() => expect(mockMapProps).toHaveLength(1));
    expect(loadingMessages).toEqual(['map.loadingStyle']);
    await first.unmount();

    loadingMessages.length = 0;
    const second = await render(<ExperienceMap source={source} overlays={[document]} />);

    // The document is already on the page, so the mount draws on its first commit and
    // never renders the spinner — not even for the commit the fetch used to need.
    expect(second.queryByTestId('experience-map-map')).toBeTruthy();
    expect(loadingMessages).toEqual([]);
    expect(fetchStyle).toHaveBeenCalledTimes(1);
  });

  it('keeps one transfer for the page when the screen remounts mid-flight', async () => {
    const page = abortAwareFetch();
    globalThis.fetch = page.fetchMock as unknown as typeof fetch;
    const source = { archiveUrl: ARCHIVE_URL, styleUrl: `${STYLE_URL}?one-transfer` };

    const first = await render(<ExperienceMap source={source} overlays={[document]} />);
    expect(page.signals).toHaveLength(1);

    await act(async () => {
      first.unmount();
    });

    // The cleanup of the effect does not cancel the transfer: a remount of the same
    // page must not pay a second request for a document the page is already fetching.
    expect(page.signals[0].aborted).toBe(false);

    const second = await render(<ExperienceMap source={source} overlays={[document]} />);
    expect(page.fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      page.resolve({ ok: true, json: async () => styleWith(true) });
    });

    await waitFor(() => expect(mockMapProps).toHaveLength(1));
    // One request answered both runs, and neither of them landed on an error.
    expect(page.fetchMock).toHaveBeenCalledTimes(1);
    expect(second.queryByTestId('experience-map-error')).toBeNull();
  });

  it('cancels the shared transfer at the bound and reports the timeout to the run that adopted it', async () => {
    jest.useFakeTimers();
    try {
      const page = abortAwareFetch();
      globalThis.fetch = page.fetchMock as unknown as typeof fetch;
      const source = { archiveUrl: ARCHIVE_URL, styleUrl: `${STYLE_URL}?shared-bound` };

      // Two runs, one transfer: the first leaves mid-flight and the second adopts it.
      const first = await render(<ExperienceMap source={source} overlays={[]} />);
      expect(page.signals).toHaveLength(1);
      await act(async () => {
        first.unmount();
      });

      const second = await render(<ExperienceMap source={source} overlays={[]} />);
      // The adopted transfer is the page's single request, not a second one.
      expect(page.fetchMock).toHaveBeenCalledTimes(1);
      expect(second.queryByText('map.loadingStyle')).toBeTruthy();

      await act(async () => {
        jest.advanceTimersByTime(10_000);
      });

      // The bound cancels the shared transfer and settles it, so the run that adopted
      // it gets the timeout it can retry instead of a dead request that never answers.
      expect(page.signals[0].aborted).toBe(true);
      expect(second.queryByText('map.errors.styleTimeout')).toBeTruthy();

      // And whoever comes later starts a new one: the settled entry is gone.
      await act(async () => {
        fireEvent.press(second.getByTestId('experience-map-retry'));
      });
      expect(page.fetchMock).toHaveBeenCalledTimes(2);
      expect(page.signals[1].aborted).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows a translated code instead of the English sentence the request layer produced', async () => {
    jest.useFakeTimers();
    try {
      globalThis.fetch = jest.fn(() => new Promise(() => {})) as never;

      const view = await render(
        <ExperienceMap
          source={{ archiveUrl: ARCHIVE_URL, styleUrl: `${STYLE_URL}?english` }}
          overlays={[]}
        />,
      );

      await act(async () => {
        jest.advanceTimersByTime(10_000);
      });

      // The sentence the hook used to hand over never reaches the screen.
      expect(view.queryByText('the map style did not load')).toBeNull();
      // What does is the key of a translated message, chosen from a stable code.
      expect(view.queryByText('map.errors.styleTimeout')).toBeTruthy();
      // And that key carries real copy in both locales.
      expect(es.map.errors.styleTimeout).not.toBe('map.errors.styleTimeout');
      expect(en.map.errors.styleTimeout).not.toBe('map.errors.styleTimeout');
    } finally {
      jest.useRealTimers();
    }
  });

  it('reports the tapped reference with the same shape the web build emits', async () => {
    const onFeaturePress = jest.fn();
    mockHit('refs:umepay:circle', {
      labelKey: 'map.references.taller',
      descriptionKey: 'map.references.taller.description',
      imageUrl: 'https://api.example/media/public/reference-images/taller.jpg',
      linkUrl: 'https://www.instagram.com/sonora.derivapoetica',
      labelText: 'map.references.taller',
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
      labelText: 'map.references.taller',
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
    // Labels are part of every surface now, so the itinerary's own label layer is
    // there; switching them off is the control's job and is pinned in the switch's
    // own suite, where pressing it is the thing being tested.
    expect(drawnLayerIds()).toContain('refs:itinerary:label');
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
