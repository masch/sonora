import { act, render, waitFor } from '@testing-library/react-native';

import type { StyleSpecification } from 'maplibre-gl';
import type { MapDocument } from '@sonora/shared';

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
import { documentKeyOfLayer } from '@/components/map/map-view.types';
const ARCHIVE = 'https://api.example/media/public/tiles/calamuchita/v1.pmtiles';
const STYLE_URL = 'https://api.example/media/public/styles/v1.json';
/** The archive registry is module-level: this test needs one that was never downloaded. */
const ARCHIVE_FAILING = 'https://api.example/media/public/tiles/missing/v1.pmtiles';

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
    expect(globalThis.fetch).toHaveBeenCalledWith(STYLE_URL);

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
});

describe('documentKeyOfLayer', () => {
  it('reads the key out of a reference layer id and ignores foreign layers', () => {
    expect(documentKeyOfLayer('refs:umepay:circle')).toBe('umepay');
    expect(documentKeyOfLayer('water')).toBeNull();
    expect(documentKeyOfLayer('buildings')).toBeNull();
  });
});
