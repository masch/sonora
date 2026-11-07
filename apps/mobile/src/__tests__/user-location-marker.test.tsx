import { render, waitFor } from '@testing-library/react-native';
import type { StyleSpecification } from 'maplibre-gl';
import type { MapDocument } from '@sonora/shared';

import ExperienceMap from '@/components/map/experience-map';
import { applyUserLocation } from '@/components/map/apply-user-location';
import type { MapHandle } from '@/components/map/use-web-map-instance';
import { useMapArchiveFile } from '@/hooks/use-map-archive-file';

import {
  mockGeoSources,
  mockLayers,
  mockMapProps,
  mockMapStyles,
  resetMapDouble,
} from '@/test-utils/maplibre-react-native-double';

// The archive lives on the device and owns its own suite: here it only has to be ready,
// so the renderer gets past its waits and hands the map a style.
jest.mock('@/hooks/use-map-archive-file', () => ({ useMapArchiveFile: jest.fn() }));

// The request layer keeps the detail of a failure for the log.
jest.mock('@/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockedUseMapArchiveFile = jest.mocked(useMapArchiveFile);

const ARCHIVE_URL = 'https://api.example/media/public/tiles/calamuchita/v1.pmtiles';
const ARCHIVE_URI =
  'pmtiles://file:///document/map-archives/d814a122-media-public-tiles-calamuchita-v1-pmtiles.pmtiles';

/** The style the R2 document serves, published by the payload as an inline fallback. */
function style(): StyleSpecification {
  return {
    version: 8,
    sources: { basemap: { type: 'vector', url: ARCHIVE_URL } },
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#fff' } }],
  } as StyleSpecification;
}

/** The same style with a glyphs source: the one thing a label layer needs to draw. */
function styleWithGlyphs(): StyleSpecification {
  return {
    ...style(),
    glyphs: 'https://api.example/media/public/glyphs/{fontstack}/{range}.pbf',
  } as StyleSpecification;
}

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

const WALKER = { latitude: -32.212, longitude: -64.738 };

/** The point the walker's own source was handed, or none when it was not drawn. */
function drawnUserLocation(featuresOf: typeof mockGeoSources): {
  geometry?: { coordinates?: number[] };
  properties?: Record<string, unknown>;
}[] {
  const source = featuresOf.find((candidate) => candidate.id === 'user-location');
  return (
    (source?.data as { features?: { geometry?: { coordinates?: number[] } }[] } | undefined)
      ?.features ?? []
  );
}

describe('the walker’s position on the native renderer', () => {
  beforeEach(() => {
    resetMapDouble();
    mockedUseMapArchiveFile.mockReset();
    mockedUseMapArchiveFile.mockReturnValue({ status: 'ready', uri: ARCHIVE_URI });
  });

  it('draws the device position as its own source, apart from the documents', async () => {
    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, style: style() }}
        overlays={[document]}
        userCoordinates={WALKER}
      />,
    );

    await waitFor(() => expect(mockMapProps).toHaveLength(1));

    // The point is where the walker is, in the order a map reads it, and it is the only
    // thing that source carries: nothing an experience draws is mixed into it.
    expect(drawnUserLocation(mockGeoSources)).toEqual([
      expect.objectContaining({
        geometry: expect.objectContaining({ coordinates: [WALKER.longitude, WALKER.latitude] }),
      }),
    ]);
    // The reference document is still its own source, so the two cannot be confused.
    expect(mockMapProps[0].mapStyle.sources).toHaveProperty('refs:umepay');
  });

  it('draws a halo under a white-ringed dot, and no label', async () => {
    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, style: style() }}
        overlays={[document]}
        userCoordinates={WALKER}
      />,
    );

    await waitFor(() => expect(mockLayers).toHaveLength(2));

    const drawn = mockLayers as { id: string; type: string; paint?: Record<string, unknown> }[];
    expect(drawn.map((layer) => layer.id)).toEqual(['user-location:halo', 'user-location:dot']);
    expect(drawn.every((layer) => layer.type === 'circle')).toBe(true);
    expect(drawn[1]?.paint).toMatchObject({ 'circle-stroke-color': '#ffffff' });
    // No symbol layer: the walker does not need a name for where they are.
    expect(drawn.some((layer) => layer.type === 'symbol')).toBe(false);
  });

  it('names the walker’s own point when the labels are on, and only then', async () => {
    const source = { archiveUrl: ARCHIVE_URL, style: styleWithGlyphs() };
    const view = await render(
      <ExperienceMap source={source} overlays={[document]} userCoordinates={WALKER} />,
    );

    await waitFor(() => expect(mockLayers).toHaveLength(3));

    const drawn = mockLayers as { id: string; type: string; layout?: Record<string, unknown> }[];
    expect(drawn.map((layer) => layer.id)).toEqual([
      'user-location:halo',
      'user-location:dot',
      'user-location:label',
    ]);
    // The text is read off the point, in the active language, not baked into the style.
    expect(drawn[2]?.layout).toMatchObject({ 'text-field': ['get', 'labelText'] });
    expect(drawnUserLocation(mockGeoSources)[0]?.properties).toEqual({
      labelText: 'map.userLocation',
    });

    // The walker switched the labels off: their own name goes with the others. The
    // recorder keeps every render, so it starts over for the second one.
    mockLayers.length = 0;
    view.rerender(
      <ExperienceMap
        source={source}
        overlays={[document]}
        userCoordinates={WALKER}
        showLabels={false}
      />,
    );

    await waitFor(() => expect(mockLayers).toHaveLength(2));
    expect(mockLayers.map((layer) => layer.id)).toEqual([
      'user-location:halo',
      'user-location:dot',
    ]);
  });

  it('draws no label when the style cannot serve glyphs', async () => {
    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, style: style() }}
        overlays={[document]}
        userCoordinates={WALKER}
      />,
    );

    await waitFor(() => expect(mockLayers).toHaveLength(2));

    // A symbol layer over a style with no glyphs draws nothing and reports it, so the
    // caller stops at the two circles it can actually draw.
    expect(mockLayers.map((layer) => layer.id)).toEqual([
      'user-location:halo',
      'user-location:dot',
    ]);
  });

  it('draws nothing when the device has no fix', async () => {
    await render(
      <ExperienceMap source={{ archiveUrl: ARCHIVE_URL, style: style() }} overlays={[document]} />,
    );

    await waitFor(() => expect(mockMapProps).toHaveLength(1));

    expect(mockGeoSources).toEqual([]);
    expect(mockLayers).toEqual([]);
  });

  it('does not rebuild the style when the position moves', async () => {
    const source = { archiveUrl: ARCHIVE_URL, style: style() };
    const view = await render(
      <ExperienceMap source={source} overlays={[document]} userCoordinates={WALKER} />,
    );

    await waitFor(() => expect(mockGeoSources).toHaveLength(1));
    const firstStyle = mockMapStyles[0];

    view.rerender(
      <ExperienceMap
        source={source}
        overlays={[document]}
        userCoordinates={{ latitude: -32.213, longitude: -64.739 }}
      />,
    );
    await waitFor(() => expect(mockMapStyles.length).toBeGreaterThan(1));

    // A new style on native re-applies it and re-fetches every tile: a fix every few
    // metres must only move the point, so both renders handed the map one style.
    expect(mockMapStyles[mockMapStyles.length - 1]).toBe(firstStyle);
    // And the point really moved: a regression that froze the first fix would keep the
    // style identical and pass everything above.
    const latest = mockGeoSources[mockGeoSources.length - 1];
    expect(drawnUserLocation([latest])[0]?.geometry?.coordinates).toEqual([-64.739, -32.213]);
  });

  it('draws one dot for a detail map, which hands the walker over as a position only', async () => {
    // What the trip and track screens do: the same `userCoordinates`, and an itinerary that
    // carries the stops of the walk and never the walker. One source, so one dot.
    const itinerary: MapDocument = {
      key: 'itinerary',
      scope: 'experience',
      collection: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-64.738, -32.212] },
            properties: { labelKey: 'map.point', labelIndex: 1 },
          },
        ],
      },
    };

    await render(
      <ExperienceMap
        source={{ archiveUrl: ARCHIVE_URL, style: style() }}
        overlays={[itinerary, document]}
        userCoordinates={WALKER}
      />,
    );

    await waitFor(() => expect(mockMapProps).toHaveLength(1));

    expect(mockGeoSources.map((source) => source.id)).toEqual(['user-location']);
    expect(drawnUserLocation(mockGeoSources)).toHaveLength(1);
    expect(mockLayers).toHaveLength(2);
  });
});

describe('the walker’s position on the web renderer', () => {
  /** A live map, as small as the reconciler needs it: state kept in plain objects. */
  function fakeMap() {
    const sources = new Map<string, { setData: jest.Mock }>();
    const layers: { id: string }[] = [];
    /** Every removal, in order: MapLibre refuses to drop a source its layers still read. */
    const removals: string[] = [];

    const map: MapHandle = {
      on: jest.fn(),
      once: jest.fn(),
      remove: jest.fn(),
      getStyle: () => ({ layers: [...layers], sources: Object.fromEntries(sources) }),
      getSource: (id: string) => sources.get(id) as never,
      addSource: ((id: string, value: unknown) => {
        sources.set(id, { setData: jest.fn(), ...(value as object) } as never);
      }) as MapHandle['addSource'],
      removeSource: ((id: string) => {
        removals.push(`source:${id}`);
        sources.delete(id);
      }) as MapHandle['removeSource'],
      addLayer: ((layer: { id: string }) => {
        layers.push(layer);
      }) as MapHandle['addLayer'],
      removeLayer: ((id: string) => {
        removals.push(`layer:${id}`);
        const index = layers.findIndex((layer) => layer.id === id);
        if (index >= 0) layers.splice(index, 1);
      }) as MapHandle['removeLayer'],
      setLayoutProperty: jest.fn(),
      fitBounds: jest.fn(),
      flyTo: jest.fn(),
      getZoom: () => 14,
      queryRenderedFeatures: () => [],
    };

    return { map, sources, layers, removals };
  }

  it('adds the source and its two layers, halo first', () => {
    const { map, sources, layers } = fakeMap();

    applyUserLocation(map, WALKER);

    expect([...sources.keys()]).toEqual(['user-location']);
    expect(layers.map((layer) => layer.id)).toEqual(['user-location:halo', 'user-location:dot']);
  });

  it('pushes new data into the source it already drew, adding no second one', () => {
    const { map, sources, layers } = fakeMap();

    applyUserLocation(map, WALKER);
    const drawn = sources.get('user-location');

    applyUserLocation(map, { latitude: -32.213, longitude: -64.739 });

    expect([...sources.keys()]).toEqual(['user-location']);
    expect(layers).toHaveLength(2);
    expect(drawn?.setData).toHaveBeenCalledWith(
      expect.objectContaining({
        features: [
          expect.objectContaining({
            geometry: expect.objectContaining({
              coordinates: [-64.739, -32.213],
            }),
          }),
        ],
      }),
    );
  });

  it('adds the walker their own name, and takes it away again when labels go off', () => {
    const { map, sources, layers } = fakeMap();

    applyUserLocation(map, WALKER, { label: 'Tu ubicación', includeLabel: true });

    expect(layers.map((layer) => layer.id)).toEqual([
      'user-location:halo',
      'user-location:dot',
      'user-location:label',
    ]);
    // The first draw is the source's own data: the point carries the translated text.
    const drawn = sources.get('user-location') as unknown as {
      data?: { features?: { properties?: Record<string, unknown> }[] };
      setData: jest.Mock;
    };
    expect(drawn.data?.features?.[0]?.properties).toEqual({ labelText: 'Tu ubicación' });

    // The walker's name is the one layer they can switch off: the toggle reconciles the
    // drawn set instead of leaving a label with nothing to shut it up.
    applyUserLocation(map, WALKER, { includeLabel: false });

    expect(layers.map((layer) => layer.id)).toEqual(['user-location:halo', 'user-location:dot']);
    expect([...sources.keys()]).toEqual(['user-location']);
    expect(drawn.setData).toHaveBeenCalledWith(
      expect.objectContaining({
        features: [expect.objectContaining({ properties: {} })],
      }),
    );
  });

  it('clears the label with the rest when the fix is lost', () => {
    const { map, sources, layers } = fakeMap();

    applyUserLocation(map, WALKER, { label: 'Tu ubicación', includeLabel: true });
    applyUserLocation(map, null);

    expect(layers).toEqual([]);
    expect([...sources.keys()]).toEqual([]);
  });

  it('clears the layers before the source when the fix is lost', () => {
    const { map, sources, layers, removals } = fakeMap();

    applyUserLocation(map, WALKER, { label: 'Tu ubicación', includeLabel: true });
    removals.length = 0;
    applyUserLocation(map, null);

    expect([...sources.keys()]).toEqual([]);
    // The order is the assertion: MapLibre refuses to remove a source its layers still
    // read, and a fake that only checks the end state cannot tell the two apart.
    expect(removals).toEqual([
      'layer:user-location:halo',
      'layer:user-location:dot',
      'layer:user-location:label',
      'source:user-location',
    ]);
    expect(layers).toEqual([]);
  });

  it('does nothing twice when there was nothing drawn', () => {
    const { map, sources, layers } = fakeMap();

    applyUserLocation(map, null);

    expect(layers).toEqual([]);
    expect([...sources.keys()]).toEqual([]);
  });
});
