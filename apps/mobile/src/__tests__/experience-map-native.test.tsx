import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react-native';

import type { ViewStateChangeEvent } from '@maplibre/maplibre-react-native';
import type { StyleSpecification } from 'maplibre-gl';
import type { NativeSyntheticEvent } from 'react-native';
import { en, es, type MapDocument } from '@sonora/shared';

import ExperienceMap from '@/components/map/experience-map';
import ExperienceMapSwitch from '@/components/map/experience-map-switch';
import { MapScrollScreenWrapper } from '@/components/map/map-scroll-lock';
import { ThemedText } from '@/components/themed-text';
import type { MapWaitState } from '@/components/map/map-view.types';
import { useNativeFocusFlight } from '@/components/map/use-native-focus-flight';
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
  mockCameraFlights,
  mockCameraProps,
  mockHit,
  mockMapProps,
  mockMapStyles,
  mockQueryRenderedFeatures,
  resetMapDouble,
  setMockMapZoom,
} from '@/test-utils/maplibre-react-native-double';
import { FOCUS_DURATION_MS, FOCUS_MIN_ZOOM } from '@/components/map/map-view.types';

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

/** The credit the published style carries, markup and all. */
const OSM_NOTICE =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** The same document publishing a credit, the way the published one does. */
function styleWithAttribution(attribution: string): StyleSpecification {
  return {
    ...styleWith(false),
    sources: { basemap: { type: 'vector', url: ARCHIVE_URL, attribution } },
  } as StyleSpecification;
}

/** The basemap source the map was handed: the archive on disk and the credit it shows. */
function drawnBasemap(index = 0): { attribution?: string; url?: string } | undefined {
  return mockMapProps[index].mapStyle.sources?.basemap as
    { attribution?: string; url?: string } | undefined;
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

/**
 * The camera's zoom, answered by the test one flight at a time.
 *
 * The hook asks for the zoom before it moves, so a zoom held open is the only way to put
 * a region change in the window where a flight has been asked for and has not started —
 * the window a flight that was replaced could report in.
 */
function deferredZoom() {
  const waiting: ((zoom: number) => void)[] = [];
  const answers: number[] = [];
  return {
    /** The answer to one `getZoom()` call, once the test gives it. */
    next: () => {
      if (answers.length > 0) return Promise.resolve(answers.shift() as number);
      return new Promise<number>((resolve) => {
        waiting.push(resolve);
      });
    },
    /** Answers the oldest unanswered `getZoom()` call, or the next one to be made. */
    answer: (zoom: number) => {
      const consumer = waiting.shift();
      if (consumer) consumer(zoom);
      else answers.push(zoom);
    },
  };
}

/** A region change the way the native map reports one: where the camera ended, and who moved it. */
function regionChange(center: [number, number], userInteraction = false) {
  // Only the two fields a flight reads: the event's framing is not what decides a landing.
  return {
    nativeEvent: { center, userInteraction },
  } as unknown as NativeSyntheticEvent<ViewStateChangeEvent>;
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

  it('draws the wait a caller hands it, and keeps its own message out of the card', async () => {
    // A first-time transfer, held open: the stage and the fraction are both real.
    mockedUseMapArchiveFile.mockReturnValue({ status: 'loading', download: { progress: 0.5 } });
    const waits: MapWaitState[] = [];

    const view = await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, style: styleWith(true) }}
        overlays={[]}
        renderPending={(wait) => {
          waits.push(wait);
          return (
            <ThemedText type="small" testID="caller-wait">
              {`caller:${wait.stage}:${wait.progress}`}
            </ThemedText>
          );
        }}
      />,
    );

    // The caller is handed the real wait, not a guess at it: the stage and the fraction
    // are the renderer's own.
    await waitFor(() =>
      expect(waits[waits.length - 1]).toEqual({
        stage: 'archive',
        downloading: true,
        progress: 0.5,
      }),
    );
    expect(view.queryByTestId('caller-wait')).toBeTruthy();
    expect(view.queryByText('caller:archive:0.5')).toBeTruthy();
    // The caller's card is the only thing speaking: a stage line here would be the
    // second message of the two the home used to show.
    expect(view.queryByText('map.loadingArchive')).toBeNull();
    expect(view.queryByText('map.loadingStyle')).toBeNull();
    expect(view.queryByText('map.loadingMap')).toBeNull();
    expect(loadingMessages).toEqual([]);
    // Nothing can be drawn over an archive that does not exist yet.
    expect(mockMapProps).toHaveLength(0);
  });

  it('draws the toolbar and the overlay only once it can draw', async () => {
    // Held on the archive: the map has no pixels yet, so neither slot can exist.
    mockedUseMapArchiveFile.mockReturnValue({ status: 'loading' });
    const source = { archiveUrl: ARCHIVE_URL, style: styleWith(true) };
    const slots = {
      toolbar: <ThemedText testID="caller-toolbar">toolbar</ThemedText>,
      overlay: <ThemedText testID="caller-overlay">overlay</ThemedText>,
      renderPending: (wait: MapWaitState) => (
        <ThemedText testID="caller-wait">{`caller:${wait.stage}`}</ThemedText>
      ),
    };

    const view = await render(<ExperienceMap source={source} overlays={[]} {...slots} />);

    // A control over a card that drew nothing is exactly what this change removes.
    expect(view.queryByTestId('caller-wait')).toBeTruthy();
    expect(view.queryByTestId('caller-toolbar')).toBeNull();
    expect(view.queryByTestId('caller-overlay')).toBeNull();
    expect(mockMapProps).toHaveLength(0);

    // The archive lands, so the map can finally draw.
    mockedUseMapArchiveFile.mockReturnValue({ status: 'ready', uri: ARCHIVE_URI });
    await act(async () => {
      view.rerender(<ExperienceMap source={source} overlays={[]} {...slots} />);
    });

    await waitFor(() => expect(mockMapProps).toHaveLength(1));
    // Drawn: the caller's slots are there, the wait is gone, and the map was handed the
    // style it draws.
    expect(view.queryByTestId('caller-wait')).toBeNull();
    expect(view.queryByTestId('caller-toolbar')).toBeTruthy();
    expect(view.queryByTestId('caller-overlay')).toBeTruthy();
    expect(mockMapProps[0].mapStyle).toBeTruthy();
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

  it('adds the drawn version to the credit the style document publishes', async () => {
    // The document is only a url on a device, so it is fetched: the credit is composed
    // where the renderer holds both the document and the archive it is drawing, and the
    // notice MapLibre shows is the one this style was handed.
    const styleUrl = `${STYLE_URL}?attribution`;
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => styleWithAttribution(OSM_NOTICE) }) as never;

    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, archiveVersion: 'v7', styleUrl }}
        overlays={[]}
      />,
    );

    await waitFor(() => expect(mockMapProps).toHaveLength(1));

    // The style's own words, and the version of the artifact this device draws — one
    // notice, with the suffix after the link rather than inside it.
    expect(drawnBasemap()).toMatchObject({
      attribution: `${OSM_NOTICE} (v7)`,
      url: ARCHIVE_URI,
    });
  });

  it('leaves the credit as the style wrote it when the version is unknown', async () => {
    await render(
      <ExperienceMap
        source={{
          archiveUrl: ARCHIVE_URL,
          archiveVersion: null,
          style: styleWithAttribution(OSM_NOTICE),
        }}
        overlays={[]}
      />,
    );

    await waitFor(() => expect(mockMapProps).toHaveLength(1));

    // No `(v?)`, no `(v0)`: the resolved answer for an unkeyable archive is that there
    // is no version, not a version nobody parsed.
    expect(drawnBasemap()?.attribution).toBe(OSM_NOTICE);
  });

  it('fabricates no credit for a style that publishes none', async () => {
    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, archiveVersion: 'v7', style: styleWith(false) }}
        overlays={[]}
      />,
    );

    await waitFor(() => expect(mockMapProps).toHaveLength(1));

    // A version with nothing to append it to adds nothing, and never invents a notice.
    expect(drawnBasemap()).not.toHaveProperty('attribution');
  });

  it('declares every gesture the card map answers', async () => {
    // Not decoration: on Android the native view only asks its parent not to
    // intercept the touch when pan is declared, and without it the vertical page
    // scroll takes the pinch away mid-gesture (the map never receives its release).
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => styleWith(true) }) as never;

    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, styleUrl: STYLE_URL }}
        overlays={[document]}
      />,
    );

    await waitFor(() => expect(mockMapProps).toHaveLength(1));

    expect(mockMapProps[0]).toMatchObject({
      dragPan: true,
      touchZoom: true,
      doubleTapZoom: true,
      doubleTapHoldZoom: true,
      touchRotate: true,
      touchPitch: true,
    });
  });

  it('freezes the page scroll while a finger is on the card', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => styleWith(true) }) as never;

    const view = await render(
      <MapScrollScreenWrapper>
        <ExperienceMap
          source={{ archiveUrl: ARCHIVE_URL, styleUrl: STYLE_URL }}
          overlays={[document]}
        />
      </MapScrollScreenWrapper>,
    );

    await waitFor(() => expect(mockMapProps).toHaveLength(1));

    // The container the card draws inside.
    const pageScroll = view.getByTestId('screen-scroll');
    const card = view.getByTestId('experience-map');

    expect(pageScroll.props.scrollEnabled).toBe(true);

    await fireEvent(card, 'touchStart');
    expect(pageScroll.props.scrollEnabled).toBe(false);

    await fireEvent(card, 'touchEnd');
    expect(pageScroll.props.scrollEnabled).toBe(true);
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

  it('flies to the tapped point at the closest zoom a place is still a place at', async () => {
    // The world opens further out than the floor. A flight without `zoom` keeps the
    // map's own, so the point would stay a pixel among labels crowded together:
    // this is the native half of the asymmetry the web renderer never had.
    setMockMapZoom(12);

    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, style: styleWith(false) }}
        overlays={[document]}
        focus={{ latitude: -32.212, longitude: -64.738 }}
      />,
    );

    await waitFor(() => expect(mockCameraFlights).toHaveLength(1));
    expect(mockCameraFlights[0]).toEqual({
      center: [-64.738, -32.212],
      duration: FOCUS_DURATION_MS,
      zoom: FOCUS_MIN_ZOOM,
      easing: 'fly',
    });
  });

  it('keeps a closer zoom than the floor when the map is already closer', async () => {
    const closer = FOCUS_MIN_ZOOM + 1.5;
    setMockMapZoom(closer);

    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, style: styleWith(false) }}
        overlays={[document]}
        focus={{ latitude: -32.212, longitude: -64.738 }}
      />,
    );

    await waitFor(() => expect(mockCameraFlights).toHaveLength(1));
    // The floor is a minimum, not a destination: a walker already zoomed in is not
    // pulled back out by tapping a point.
    expect(mockCameraFlights[0]?.zoom).toBe(closer);
  });

  it('still flies at the floor when the camera refuses to say its zoom', async () => {
    // `getZoom()` is a promise to the native map, and a promise can reject: a camera not
    // attached yet, or one that answers an error. The zoom is a refinement of the flight,
    // never its condition — a tap that does nothing because a query failed is worse than
    // a flight that chooses the close-up, which is what the hook's own contract says.
    // Driven on the hook, because the double's `getZoom()` always answers.
    const onSettled = jest.fn();
    const flyTo = jest.fn();
    const mapRef = { current: { getZoom: () => Promise.reject(new Error('camera not ready')) } };
    const cameraRef = { current: { flyTo } };

    await renderHook(() =>
      useNativeFocusFlight({
        focus: { latitude: -32.212, longitude: -64.738 },
        mapRef,
        cameraRef,
        onSettled,
        durationMs: FOCUS_DURATION_MS,
        minZoom: FOCUS_MIN_ZOOM,
      }),
    );

    await waitFor(() => expect(flyTo).toHaveBeenCalledTimes(1));
    expect(flyTo.mock.calls[0]?.[0]).toEqual({
      center: [-64.738, -32.212],
      duration: FOCUS_DURATION_MS,
      zoom: FOCUS_MIN_ZOOM,
      easing: 'fly',
    });
  });

  it('reports the landing of the flight it started', async () => {
    // The map reports every camera move; the caller opens its card on the one it
    // asked for, so the flight has to be reported once and only when it ends.
    const onFocusSettled = jest.fn();

    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, style: styleWith(false) }}
        overlays={[document]}
        focus={{ latitude: -32.212, longitude: -64.738 }}
        onFocusSettled={onFocusSettled}
      />,
    );

    await waitFor(() => expect(mockCameraFlights).toHaveLength(1));
    // The camera is on its way: nothing has come to rest yet.
    expect(onFocusSettled).not.toHaveBeenCalled();

    await act(async () => {
      mockMapProps[0].onRegionDidChange?.(regionChange([-64.738, -32.212]));
    });
    expect(onFocusSettled).toHaveBeenCalledTimes(1);

    await act(async () => {
      mockMapProps[0].onRegionDidChange?.(regionChange([-64.738, -32.212]));
    });
    // The flight landed once, so it is reported once.
    expect(onFocusSettled).toHaveBeenCalledTimes(1);
  });

  it('reports the arrival at the requested centre, and nothing for a move that ended elsewhere', async () => {
    const onFocusSettled = jest.fn();

    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, style: styleWith(false) }}
        overlays={[document]}
        focus={{ latitude: -32.212, longitude: -64.738 }}
        onFocusSettled={onFocusSettled}
      />,
    );

    await waitFor(() => expect(mockCameraFlights).toHaveLength(1));
    const requested = mockCameraFlights[0].center;

    // A move that ended somewhere else arrives through the same callback the landing
    // does, and it is not this arrival — nor a reason to disarm while the flight is
    // still on its way.
    await act(async () => {
      mockMapProps[0].onRegionDidChange?.(regionChange([-64.5, -31.9]));
    });
    expect(onFocusSettled).not.toHaveBeenCalled();

    // Where the camera came to rest is what decides, not who moved it: a landing at the
    // requested centre reports even when the platform calls it a user interaction. That
    // flag was the previous discriminator, and it is a question about MapLibre's native
    // implementations rather than about this hook.
    await act(async () => {
      mockMapProps[0].onRegionDidChange?.(regionChange(requested, true));
    });
    expect(onFocusSettled).toHaveBeenCalledTimes(1);
  });

  it('reports nothing for the region change the replaced flight left behind', async () => {
    // The next point replaces a flight that is still in the air. The camera is asked for
    // its zoom before it moves, so the region change of the interrupted flight can arrive
    // while the new one has not started: it belongs to a flight that was replaced, and
    // reporting it would open the new point's card before its camera moved. Driven on the
    // hook, because only a zoom the test holds open puts the region change in that window.
    const zoom = deferredZoom();
    const onSettled = jest.fn();
    const flyTo = jest.fn();
    const mapRef = { current: { getZoom: () => zoom.next() } };
    const cameraRef = { current: { flyTo } };
    const first = { latitude: -32.212, longitude: -64.738 };
    const second = { latitude: -31.9, longitude: -64.5 };

    const view = await renderHook(
      ({ focus }: { focus: { latitude: number; longitude: number } }) =>
        useNativeFocusFlight({
          focus,
          mapRef,
          cameraRef,
          onSettled,
          durationMs: FOCUS_DURATION_MS,
          minZoom: FOCUS_MIN_ZOOM,
        }),
      { initialProps: { focus: first } },
    );

    await act(async () => {
      zoom.answer(12);
    });
    expect(flyTo).toHaveBeenCalledTimes(1);

    // The replacement is asked for while the first flight is still unreported, and the
    // camera's zoom for it has not answered yet: nothing has moved.
    await view.rerender({ focus: second });
    expect(flyTo).toHaveBeenCalledTimes(1);

    await act(async () => {
      view.result.current(regionChange([first.longitude, first.latitude]));
    });
    // The region change of the flight that was replaced reports nothing.
    expect(onSettled).not.toHaveBeenCalled();

    await act(async () => {
      zoom.answer(12);
    });
    expect(flyTo).toHaveBeenCalledTimes(2);
    expect(flyTo.mock.calls[1]?.[0]).toMatchObject({
      center: [second.longitude, second.latitude],
    });

    await act(async () => {
      view.result.current(regionChange([second.longitude, second.latitude]));
    });
    // The flight that really moved is reported once, and only once.
    expect(onSettled).toHaveBeenCalledTimes(1);

    await act(async () => {
      view.result.current(regionChange([second.longitude, second.latitude]));
    });
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('reports nothing for a camera move the walker made', async () => {
    const onFocusSettled = jest.fn();

    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, style: styleWith(false) }}
        overlays={[document]}
        onFocusSettled={onFocusSettled}
      />,
    );

    await act(async () => {
      mockMapProps[0].onRegionDidChange?.(regionChange([-64.738, -32.212], true));
    });

    // No flight was started, so no move this map made is a landing to report.
    expect(onFocusSettled).not.toHaveBeenCalled();
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

/**
 * A style document that carries the basemap's own names, which the hub's markers must
 * never cost, plus the neighbours it must leave alone.
 */
function styleWithBasemapLabels(): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://api.example/media/public/glyphs/{fontstack}/{range}.pbf',
    sources: { basemap: { type: 'vector', url: ARCHIVE_URL } },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#ffffff' } },
      { id: 'water', type: 'fill', source: 'basemap', 'source-layer': 'water' },
      {
        id: 'landuse_label',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'landuse',
        minzoom: 11,
        layout: { 'text-field': ['get', 'name'] },
      },
      {
        id: 'places_locality',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'places',
        layout: { 'text-field': ['get', 'name'] },
      },
      {
        id: 'roads_labels_major',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'roads',
        layout: { 'text-field': ['get', 'name'] },
      },
    ],
  } as StyleSpecification;
}

/** The `minzoom` the map was handed for one layer, or `undefined` when it carries none. */
function drawnMinZoom(layerId: string): number | undefined {
  const layers = (mockMapProps[0].mapStyle.layers ?? []) as { id: string; minzoom?: number }[];
  return layers.find((layer) => layer.id === layerId)?.minzoom;
}

/** The drawn reference layer with this id, as the style spec the double recorded. */
function drawnReferenceLayer(layerId: string) {
  const layers = (mockMapProps[0].mapStyle.layers ?? []) as {
    id: string;
    paint?: Record<string, unknown>;
    layout?: Record<string, unknown>;
  }[];
  return layers.find((layer) => layer.id === layerId);
}

describe('ExperienceMap — bold references', () => {
  beforeEach(() => {
    resetMapDouble();
    mockedUseMapArchiveFile.mockReturnValue({
      status: 'ready',
      uri: ARCHIVE_URI,
    } as ReturnType<typeof useMapArchiveFile>);
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => styleWith(true),
    }) as never;
  });

  it('draws the basemap’s own names exactly as the document wrote them', async () => {
    const style = styleWithBasemapLabels();
    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, style }}
        overlays={[]}
        boldReferences={true}
      />,
    );

    // Byte for byte: the weight belongs to the references and never to the names
    // underneath them, so a barrio is still named at the zoom the document names it.
    expect(mockMapProps[0].mapStyle.layers).toEqual(style.layers);
    expect(drawnMinZoom('landuse_label')).toBe(11);
    expect(drawnMinZoom('places_locality')).toBeUndefined();
  });

  it('draws the bold dot, the bigger label and a hit circle when the hub asks for it', async () => {
    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, style: styleWith(true) }}
        overlays={[document]}
        boldReferences={true}
      />,
    );

    const ids = drawnLayerIds();
    // The transparent target is drawn first, so the marker the walker reads sits on top.
    expect(ids.indexOf('refs:umepay:circle-hit')).toBeLessThan(ids.indexOf('refs:umepay:circle'));
    expect(drawnReferenceLayer('refs:umepay:circle-hit')?.paint).toMatchObject({
      'circle-radius': 16,
      'circle-opacity': 0.01,
    });
    expect(drawnReferenceLayer('refs:umepay:circle')?.paint).toMatchObject({
      'circle-radius': 11,
      'circle-stroke-width': 3,
    });
    expect(drawnReferenceLayer('refs:umepay:label')?.layout?.['text-size']).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      13,
      14,
      15,
      16,
    ]);
    expect(drawnReferenceLayer('refs:umepay:label')?.paint?.['text-halo-width']).toBe(3);
  });

  it('reports the reference when the press lands on the hit circle instead of the dot', async () => {
    // The native renderer queries each reference layer in turn, so the target has to be
    // one of them and has to report the same document the dot does.
    const onFeaturePress = jest.fn();
    mockHit('refs:umepay:circle-hit', { experienceSlug: 'taller' });

    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, style: styleWith(true) }}
        overlays={[document]}
        boldReferences={true}
        onFeaturePress={onFeaturePress}
      />,
    );

    await act(async () => {
      await mockMapProps[0].onPress?.({ nativeEvent: { point: [40, 60], lngLat: [-64.7, -32.2] } });
    });

    expect(onFeaturePress).toHaveBeenCalledWith({
      documentKey: 'umepay',
      experienceSlug: 'taller',
    });
  });

  it('draws today’s reference layers and basemap zooms when nothing is asked for', async () => {
    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, style: styleWithBasemapLabels() }}
        overlays={[document]}
      />,
    );

    expect(drawnLayerIds()).not.toContain('refs:umepay:circle-hit');
    expect(drawnReferenceLayer('refs:umepay:circle')?.paint).toMatchObject({
      'circle-radius': 6,
      'circle-stroke-width': 2,
    });
    expect(drawnReferenceLayer('refs:umepay:label')?.layout?.['text-size']).toBe(12);
    expect(drawnMinZoom('landuse_label')).toBe(11);
    expect(drawnMinZoom('places_locality')).toBeUndefined();
  });

  it('leaves the experience’s own map on today’s markers', async () => {
    await render(
      <ExperienceMapSwitch
        renderer="maplibre"
        source={{ archiveUrl: ARCHIVE_URL, style: styleWith(true) }}
        experience={trip}
      />,
    );

    // The switch draws the detail map, which asks for no weight: the emphasis belongs to
    // the hub, where the names crowd each other, and a place the walker is already
    // reading does not have to shout over the basemap it is drawn on.
    expect(drawnLayerIds()).toContain('refs:itinerary:circle');
    expect(drawnLayerIds()).not.toContain('refs:itinerary:circle-hit');
    expect(drawnLayerIds()).not.toContain('refs:referencias:circle-hit');
  });
});
